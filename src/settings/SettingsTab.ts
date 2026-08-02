/**
 * Plugin settings UI (Obsidian settings tab).
 *
 * Sections follow concept §7: Connection, Insert, Daily note, Display. Every
 * label/description is resolved via `t()` so the tab stays fully localized.
 *
 * Built on the declarative settings API (Obsidian 1.13+): definitions come
 * from `getSettingDefinitions()`, values flow through `getControlValue` /
 * `setControlValue`. Rows the declarative controls cannot express (password
 * input, test button, inline template editor) use `render` escape hatches.
 *
 * `SettingsHost` types the plugin instance locally (rather than importing
 * `main.ts`) to avoid a circular import between the settings tab and the
 * plugin entry point.
 */

import {
	App,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	SettingDefinitionItem,
	TextAreaComponent,
} from "obsidian";
import { PluginSettings } from "../types";
import { ImmichClient } from "../api/immichClient";
import { t, setLocale, resolveLocale } from "../i18n";

/** Minimal surface of the plugin instance the settings tab depends on. */
export interface SettingsHost {
	pluginSettings: PluginSettings;
	saveSettings(): Promise<void>;
	client: ImmichClient;
}

export class ImmichJournalSettingTab extends PluginSettingTab {
	private readonly plugin: Plugin & SettingsHost;

	constructor(app: App, plugin: Plugin & SettingsHost) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		const settings = this.plugin.pluginSettings;
		return [
			{
				type: "group",
				heading: t("settings.connection"),
				items: [
					{
						name: t("settings.serverUrl.name"),
						desc: t("settings.serverUrl.desc"),
						control: { type: "text", key: "serverUrl" },
					},
					{
						name: t("settings.apiKey.name"),
						desc: t("settings.apiKey.desc"),
						render: (setting) => this.renderApiKeyControl(setting),
					},
					{
						name: t("settings.testConnection.name"),
						desc: t("settings.testConnection.desc"),
						render: (setting) => this.renderTestConnectionButton(setting),
					},
				],
			},
			{
				type: "group",
				heading: t("settings.insert"),
				items: [
					{
						name: t("settings.insertPosition.name"),
						desc: t("settings.insertPosition.desc"),
						control: {
							type: "dropdown",
							key: "insertPosition",
							options: {
								cursor: t("settings.insertPosition.optionCursor"),
								top: t("settings.insertPosition.optionTop"),
								bottom: t("settings.insertPosition.optionBottom"),
							},
						},
					},
					{
						name: t("settings.photoEmbed.name"),
						desc: t("settings.photoEmbed.desc"),
						control: {
							type: "dropdown",
							key: "embedPreset",
							options: {
								markdownLink: t("settings.photoEmbed.optionMarkdownLink"),
								markdownPlain: t("settings.photoEmbed.optionMarkdownPlain"),
								wikilink: t("settings.photoEmbed.optionWikilink"),
								custom: t("settings.photoEmbed.optionCustom"),
							},
						},
					},
					{
						name: t("settings.markdownTemplate.name"),
						visible: () => settings.embedPreset === "custom",
						render: (setting) => this.renderTemplateEditor(setting),
					},
					{
						name: t("settings.maxEdgePx.name"),
						desc: t("settings.maxEdgePx.desc"),
						control: {
							type: "number",
							key: "maxEdgePx",
							min: 200,
							max: 2000,
							step: 1,
						},
					},
					{
						name: t("settings.jpegQuality.name"),
						desc: t("settings.jpegQuality.desc"),
						control: {
							type: "slider",
							key: "jpegQuality",
							min: 0.5,
							max: 1.0,
							step: 0.05,
						},
					},
					{
						name: t("settings.attachmentFolder.name"),
						desc: t("settings.attachmentFolder.desc"),
						control: { type: "text", key: "attachmentFolder" },
					},
					{
						name: t("settings.fileNameTemplate.name"),
						desc: t("settings.fileNameTemplate.desc"),
						control: { type: "text", key: "fileNameTemplate" },
					},
				],
			},
			{
				type: "group",
				heading: t("settings.dailyNote"),
				items: [
					{
						name: t("settings.titleDateFormat.name"),
						desc: t("settings.titleDateFormat.desc"),
						control: { type: "text", key: "titleDateFormat" },
					},
					{
						name: t("settings.frontmatterField.name"),
						desc: t("settings.frontmatterField.desc"),
						control: { type: "text", key: "frontmatterField" },
					},
				],
			},
			{
				type: "group",
				heading: t("settings.display"),
				items: [
					{
						name: t("settings.gridCols.name"),
						desc: t("settings.gridCols.desc"),
						control: {
							type: "number",
							key: "gridCols",
							min: 2,
							max: 8,
							step: 1,
						},
					},
					{
						name: t("settings.language.name"),
						desc: t("settings.language.desc"),
						control: {
							type: "dropdown",
							key: "languageOverride",
							options: {
								auto: t("settings.language.optionAuto"),
								en: t("settings.language.optionEn"),
								de: t("settings.language.optionDe"),
								es: t("settings.language.optionEs"),
								fr: t("settings.language.optionFr"),
								ja: t("settings.language.optionJa"),
								zh: t("settings.language.optionZh"),
							},
						},
					},
				],
			},
		];
	}

	getControlValue(key: string): unknown {
		return this.plugin.pluginSettings[key as keyof PluginSettings];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		const normalized = this.normalizeValue(key, value);
		if (normalized === undefined) {
			return;
		}
		const settings = this.plugin.pluginSettings as unknown as Record<string, unknown>;
		settings[key] = normalized;
		await this.plugin.saveSettings();

		if (key === "embedPreset") {
			// Show/hide the template editor row.
			this.update();
		} else if (key === "languageOverride") {
			setLocale(resolveLocale(normalized as PluginSettings["languageOverride"]));
			// Rebuild the definitions so all labels use the new locale.
			this.update();
		}
	}

	/**
	 * Applies the same value rules the imperative tab enforced. Returns
	 * `undefined` to reject the change (the previous value stays).
	 */
	private normalizeValue(key: string, value: unknown): unknown {
		if (key === "maxEdgePx" || key === "gridCols") {
			const parsed = Number(value);
			if (!Number.isFinite(parsed)) {
				return undefined;
			}
			const [min, max] = key === "maxEdgePx" ? [200, 2000] : [2, 8];
			return Math.min(max, Math.max(min, Math.round(parsed)));
		}
		return value;
	}

	private renderApiKeyControl(setting: Setting): void {
		setting.addText((text) => {
			text.inputEl.type = "password";
			text.setValue(this.plugin.pluginSettings.apiKey).onChange(async (value) => {
				await this.setControlValue("apiKey", value);
			});
		});
	}

	private renderTestConnectionButton(setting: Setting): void {
		setting.addButton((button) =>
			button.setButtonText(t("settings.testConnection.button")).onClick(async () => {
				button.setDisabled(true);
				try {
					const result = await this.plugin.client.testConnection();
					new Notice(this.testConnectionMessage(result));
				} finally {
					button.setDisabled(false);
				}
			})
		);
	}

	/**
	 * Full-width template editor row shown while the "custom" preset is
	 * active: a textarea followed by the variables hint.
	 */
	private renderTemplateEditor(setting: Setting): void {
		setting.settingEl.addClass("immich-journal-embed-setting");
		const templateEl = setting.settingEl.createDiv({
			cls: "immich-journal-template",
		});
		const textArea = new TextAreaComponent(templateEl);
		textArea.inputEl.setAttr("aria-label", t("settings.markdownTemplate.name"));
		textArea
			.setValue(this.plugin.pluginSettings.markdownTemplate)
			.onChange(async (value) => {
				await this.setControlValue("markdownTemplate", value);
			});
		templateEl.createDiv({
			cls: "immich-journal-template-hint",
			text: t("settings.markdownTemplate.desc"),
		});
	}

	/** Maps a {@link ConnectionTestResult}-shaped outcome to the matching i18n message. */
	private testConnectionMessage(result: {
		ok: boolean;
		category?: string;
		scopeChecked: boolean;
	}): string {
		if (result.ok) {
			return result.scopeChecked
				? t("settings.testConnection.success")
				: t("settings.testConnection.successNoScope");
		}
		switch (result.category) {
			case "network":
				return t("settings.testConnection.failNetwork");
			case "unauthorized":
				return t("settings.testConnection.failUnauthorized");
			case "forbidden":
				return t("settings.testConnection.failForbidden");
			default:
				return t("settings.testConnection.failOther");
		}
	}
}
