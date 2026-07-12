/**
 * Default plugin settings, used on first install and to backfill missing
 * fields when merging with persisted data in main.ts.
 */

import { DEFAULT_MARKDOWN_TEMPLATE } from "../insert/markdownBlock";
import { PluginSettings } from "../types";

export const DEFAULT_SETTINGS: PluginSettings = {
	serverUrl: "",
	apiKey: "",
	maxEdgePx: 800,
	jpegQuality: 0.85,
	attachmentFolder: "attachments/immich/{{year}}/",
	fileNameTemplate: "{{date}}_immich_{{assetIdShort}}",
	markdownTemplate: DEFAULT_MARKDOWN_TEMPLATE,
	embedPreset: "markdownLink",
	insertPosition: "cursor",
	titleDateFormat: "YYYY-MM-DD",
	frontmatterField: "",
	gridCols: 3,
	languageOverride: "auto",
};
