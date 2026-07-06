/**
 * Plugin settings UI (Obsidian settings tab).
 *
 * Sections follow concept §7: Connection, Insert, Daily note, Display. Every
 * label/description is resolved via `t()` so the tab stays fully localized.
 *
 * `SettingsHost` types the plugin instance locally (rather than importing
 * `main.ts`) to avoid a circular import between the settings tab and the
 * plugin entry point.
 */

import { App, Notice, PluginSettingTab, Setting, Plugin } from "obsidian";
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

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.renderConnectionSection(containerEl);
		this.renderInsertSection(containerEl);
		this.renderDailyNoteSection(containerEl);
		this.renderDisplaySection(containerEl);
	}

	private async updateSettings(mutate: (settings: PluginSettings) => void): Promise<void> {
		mutate(this.plugin.pluginSettings);
		await this.plugin.saveSettings();
	}

	private renderConnectionSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName(t("settings.connection")).setHeading();

		new Setting(containerEl)
			.setName(t("settings.serverUrl.name"))
			.setDesc(t("settings.serverUrl.desc"))
			.addText((text) =>
				text
					.setValue(this.plugin.pluginSettings.serverUrl)
					.onChange(async (value) => {
						await this.updateSettings((settings) => {
							settings.serverUrl = value;
						});
					})
			);

		new Setting(containerEl)
			.setName(t("settings.apiKey.name"))
			.setDesc(t("settings.apiKey.desc"))
			.addText((text) => {
				text.inputEl.type = "password";
				text.setValue(this.plugin.pluginSettings.apiKey).onChange(async (value) => {
					await this.updateSettings((settings) => {
						settings.apiKey = value;
					});
				});
			});

		new Setting(containerEl)
			.setName(t("settings.testConnection.name"))
			.setDesc(t("settings.testConnection.desc"))
			.addButton((button) =>
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

	private renderInsertSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName(t("settings.insert")).setHeading();

		new Setting(containerEl)
			.setName(t("settings.maxEdgePx.name"))
			.setDesc(t("settings.maxEdgePx.desc"))
			.addText((text) =>
				text
					.setValue(String(this.plugin.pluginSettings.maxEdgePx))
					.onChange(async (value) => {
						const parsed = Number(value);
						if (!Number.isFinite(parsed)) {
							return;
						}
						const clamped = Math.min(2000, Math.max(200, Math.round(parsed)));
						await this.updateSettings((settings) => {
							settings.maxEdgePx = clamped;
						});
					})
			);

		new Setting(containerEl)
			.setName(t("settings.jpegQuality.name"))
			.setDesc(t("settings.jpegQuality.desc"))
			.addSlider((slider) =>
				slider
					.setLimits(0.5, 1.0, 0.05)
					.setValue(this.plugin.pluginSettings.jpegQuality)
					.onChange(async (value) => {
						await this.updateSettings((settings) => {
							settings.jpegQuality = value;
						});
					})
			);

		new Setting(containerEl)
			.setName(t("settings.attachmentFolder.name"))
			.setDesc(t("settings.attachmentFolder.desc"))
			.addText((text) =>
				text
					.setValue(this.plugin.pluginSettings.attachmentFolder)
					.onChange(async (value) => {
						await this.updateSettings((settings) => {
							settings.attachmentFolder = value;
						});
					})
			);

		new Setting(containerEl)
			.setName(t("settings.fileNameTemplate.name"))
			.setDesc(t("settings.fileNameTemplate.desc"))
			.addText((text) =>
				text
					.setValue(this.plugin.pluginSettings.fileNameTemplate)
					.onChange(async (value) => {
						await this.updateSettings((settings) => {
							settings.fileNameTemplate = value;
						});
					})
			);

		new Setting(containerEl)
			.setName(t("settings.markdownTemplate.name"))
			.setDesc(t("settings.markdownTemplate.desc"))
			.addTextArea((textArea) =>
				textArea
					.setValue(this.plugin.pluginSettings.markdownTemplate)
					.onChange(async (value) => {
						await this.updateSettings((settings) => {
							settings.markdownTemplate = value;
						});
					})
			);

		new Setting(containerEl)
			.setName(t("settings.captionTemplate.name"))
			.setDesc(t("settings.captionTemplate.desc"))
			.addText((text) =>
				text
					.setValue(this.plugin.pluginSettings.captionTemplate)
					.onChange(async (value) => {
						await this.updateSettings((settings) => {
							settings.captionTemplate = value;
						});
					})
			);

		new Setting(containerEl)
			.setName(t("settings.embedStyle.name"))
			.setDesc(t("settings.embedStyle.desc"))
			.addDropdown((dropdown) =>
				dropdown
					.addOption("markdown", t("settings.embedStyle.optionMarkdown"))
					.addOption("wikilink", t("settings.embedStyle.optionWikilink"))
					.setValue(this.plugin.pluginSettings.embedStyle)
					.onChange(async (value) => {
						await this.updateSettings((settings) => {
							settings.embedStyle = value as PluginSettings["embedStyle"];
						});
					})
			);

		new Setting(containerEl)
			.setName(t("settings.linkToImmich.name"))
			.setDesc(t("settings.linkToImmich.desc"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.pluginSettings.linkToImmich)
					.onChange(async (value) => {
						await this.updateSettings((settings) => {
							settings.linkToImmich = value;
						});
					})
			);
	}

	private renderDailyNoteSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName(t("settings.dailyNote")).setHeading();

		new Setting(containerEl)
			.setName(t("settings.titleDateFormat.name"))
			.setDesc(t("settings.titleDateFormat.desc"))
			.addText((text) =>
				text
					.setValue(this.plugin.pluginSettings.titleDateFormat)
					.onChange(async (value) => {
						await this.updateSettings((settings) => {
							settings.titleDateFormat = value;
						});
					})
			);

		new Setting(containerEl)
			.setName(t("settings.frontmatterField.name"))
			.setDesc(t("settings.frontmatterField.desc"))
			.addText((text) =>
				text
					.setValue(this.plugin.pluginSettings.frontmatterField)
					.onChange(async (value) => {
						await this.updateSettings((settings) => {
							settings.frontmatterField = value;
						});
					})
			);
	}

	private renderDisplaySection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName(t("settings.display")).setHeading();

		new Setting(containerEl)
			.setName(t("settings.gridCols.name"))
			.setDesc(t("settings.gridCols.desc"))
			.addText((text) =>
				text
					.setValue(String(this.plugin.pluginSettings.gridCols))
					.onChange(async (value) => {
						const parsed = Number(value);
						if (!Number.isFinite(parsed)) {
							return;
						}
						const clamped = Math.min(8, Math.max(2, Math.round(parsed)));
						await this.updateSettings((settings) => {
							settings.gridCols = clamped;
						});
					})
			);

		new Setting(containerEl)
			.setName(t("settings.language.name"))
			.setDesc(t("settings.language.desc"))
			.addDropdown((dropdown) =>
				dropdown
					.addOption("auto", t("settings.language.optionAuto"))
					.addOption("en", t("settings.language.optionEn"))
					.addOption("de", t("settings.language.optionDe"))
					.addOption("es", t("settings.language.optionEs"))
					.addOption("fr", t("settings.language.optionFr"))
					.addOption("ja", t("settings.language.optionJa"))
					.addOption("zh", t("settings.language.optionZh"))
					.setValue(this.plugin.pluginSettings.languageOverride)
					.onChange(async (value) => {
						const languageOverride = value as PluginSettings["languageOverride"];
						await this.updateSettings((settings) => {
							settings.languageOverride = languageOverride;
						});
						setLocale(resolveLocale(languageOverride));
						this.display();
					})
			);
	}
}
