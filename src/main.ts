/**
 * Plugin entry point: wires settings, i18n, the Immich client, the ribbon
 * icon, the command, and the photo picker modal together.
 *
 * The command uses a plain `callback` (not `editorCallback`) on purpose so it
 * also works from the mobile toolbar and without an open editor — the insert
 * pipeline falls back to appending at the end of the file in that case.
 */

import { MarkdownView, Notice, Plugin, moment } from "obsidian";
import { ImmichClient } from "./api/immichClient";
import { t, initI18n, resolveLocale } from "./i18n";
import { insertAssets } from "./insert/pipeline";
import { DEFAULT_SETTINGS } from "./settings/defaults";
import { migrateEmbedSettings, LegacyEmbedFields } from "./settings/migrate";
import { ImmichJournalSettingTab, SettingsHost } from "./settings/SettingsTab";
import type { ImmichAsset, PluginSettings } from "./types";
import { PhotoPickerModal } from "./ui/PhotoPickerModal";
import { resolveNoteDate } from "./util/resolveDate";

export default class ImmichJournalPlugin
	extends Plugin
	implements SettingsHost
{
	pluginSettings!: PluginSettings;
	client!: ImmichClient;

	async onload(): Promise<void> {
		const loaded = ((await this.loadData()) ?? {}) as Partial<PluginSettings> &
			LegacyEmbedFields & {
				gridColsDesktop?: number;
			};
		// Migration: the column setting was named `gridColsDesktop` until 0.1.1
		// even though it applies on mobile too. Carry a stored value over only
		// when it differs from that era's default (4) — an untouched old
		// default should pick up the new default (3) instead.
		if (
			loaded.gridCols === undefined &&
			loaded.gridColsDesktop !== undefined &&
			loaded.gridColsDesktop !== 4
		) {
			loaded.gridCols = loaded.gridColsDesktop;
		}
		delete loaded.gridColsDesktop;
		// Migration: embedStyle/linkToImmich/captionTemplate → embedPreset (0.2.0).
		migrateEmbedSettings(loaded);
		this.pluginSettings = Object.assign({}, DEFAULT_SETTINGS, loaded);
		initI18n(resolveLocale(this.pluginSettings.languageOverride));

		// The config getter reads live settings, so URL/key changes in the
		// settings tab apply to the very next request without a reload.
		this.client = new ImmichClient(() => ({
			serverUrl: this.pluginSettings.serverUrl,
			apiKey: this.pluginSettings.apiKey,
		}));

		this.addSettingTab(new ImmichJournalSettingTab(this.app, this));

		this.addRibbonIcon("image", t("ribbon.tooltip"), () => {
			this.openPhotoPicker();
		});

		this.addCommand({
			id: "insert-photos-of-this-day",
			name: t("command.insertPhotos"),
			callback: () => {
				this.openPhotoPicker();
			},
		});
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.pluginSettings);
	}

	/**
	 * Opens the photo picker for the active note. Without an active file there
	 * is nothing to insert into, so a Notice is shown instead. When the note's
	 * date cannot be resolved the modal opens on the most recent day that has
	 * photos (with the date input as a direct-jump fallback).
	 */
	private openPhotoPicker(): void {
		const file = this.app.workspace.getActiveFile();
		if (!file) {
			new Notice(t("notice.noActiveFile"));
			return;
		}

		const { date } = resolveNoteDate(
			{
				basename: file.basename,
				frontmatter:
					this.app.metadataCache.getFileCache(file)?.frontmatter,
				titleFormat: this.pluginSettings.titleDateFormat,
				frontmatterField: this.pluginSettings.frontmatterField,
			},
			moment
		);
		// No resolvable date is not an error: the modal then starts on the
		// most recent day that has photos and lets the user navigate.
		new PhotoPickerModal(this.app, {
			client: this.client,
			settings: this.pluginSettings,
			initialDate: date,
			openSettings: () => {
				// `app.setting` is not part of the public typings but is the
				// established way to deep-link into a plugin's settings tab.
				const setting = (
					this.app as unknown as {
						setting: {
							open(): void;
							openTabById(id: string): void;
						};
					}
				).setting;
				setting.open();
				setting.openTabById(this.manifest.id);
			},
			onInsert: async (assets: ImmichAsset[]) => {
				// Insert at the cursor only when the active editor is showing
				// exactly the file the modal was opened for; otherwise append
				// to the end of that file.
				const view =
					this.app.workspace.getActiveViewOfType(MarkdownView);
				const editor =
					view && view.file === file ? view.editor : null;
				await insertAssets(
					{
						app: this.app,
						client: this.client,
						settings: this.pluginSettings,
					},
					assets,
					{ editor, file }
				);
			},
		}).open();
	}

	onunload(): void {
		// Nothing to clean up here: observers and object URLs are owned and
		// released by the modal, and Obsidian unregisters UI elements itself.
	}
}
