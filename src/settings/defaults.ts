/**
 * Default plugin settings, used on first install and to backfill missing
 * fields when merging with persisted data in main.ts.
 */

import { PluginSettings } from "../types";

export const DEFAULT_SETTINGS: PluginSettings = {
	serverUrl: "",
	apiKey: "",
	maxEdgePx: 800,
	jpegQuality: 0.85,
	attachmentFolder: "attachments/immich/{{year}}/",
	fileNameTemplate: "{{date}}_immich_{{assetIdShort}}",
	markdownTemplate: "[![{{altText}}]({{localPath}})]({{immichUrl}})\n*{{caption}}*",
	captionTemplate: "{{description}}",
	embedStyle: "markdown",
	linkToImmich: true,
	titleDateFormat: "YYYY-MM-DD",
	frontmatterField: "",
	gridColsDesktop: 4,
	languageOverride: "auto",
};
