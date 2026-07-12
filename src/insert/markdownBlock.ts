/**
 * Renders the markdown block inserted into a daily note for a single asset.
 *
 * The embed presets are plain fixed templates; "custom" uses the
 * user-editable `markdownTemplate` setting instead. All of them render
 * through the same path: substitute variables, then drop any line that is
 * blank once markdown formatting characters are stripped (so a caption line
 * like `*{{description}}*` vanishes when the photo has no description).
 */

import { PluginSettings } from "../types";
import { renderTemplate } from "../util/template";

export const DEFAULT_MARKDOWN_TEMPLATE =
	"[![{{altText}}]({{localPath}})]({{immichUrl}})\n*{{description}}*";

/**
 * Fixed templates behind the embed presets. `wikilink` uses the unencoded
 * path (`localPathRaw`) because Obsidian resolves `![[...]]` targets with
 * literal spaces; the markdown presets use the `%20`-encoded `localPath`.
 * A wikilink embed cannot carry an outer link, hence no linked variant.
 */
export const PRESET_TEMPLATES: Record<
	Exclude<PluginSettings["embedPreset"], "custom">,
	string
> = {
	markdownLink: DEFAULT_MARKDOWN_TEMPLATE,
	markdownPlain: "![{{altText}}]({{localPath}})\n*{{description}}*",
	wikilink: "![[{{localPathRaw}}]]\n*{{description}}*",
};

/** Resolve the effective block template for the given settings. */
export function templateForPreset(settings: PluginSettings): string {
	return settings.embedPreset === "custom"
		? settings.markdownTemplate
		: PRESET_TEMPLATES[settings.embedPreset];
}

/**
 * Return true if `line` has no visible content once common markdown
 * formatting characters (`*`, `_`) and whitespace are stripped. Used to
 * drop an empty caption line after rendering.
 */
function isBlankOnceFormattingStripped(line: string): boolean {
	return line.replace(/[*_\s]/g, "") === "";
}

/**
 * Render a single asset's markdown block: substitute `{{var}}` placeholders
 * and drop lines that end up blank (empty caption).
 */
export function renderBlock(template: string, vars: Record<string, string>): string {
	return renderTemplate(template, vars)
		.split("\n")
		.filter((line) => !isBlankOnceFormattingStripped(line))
		.join("\n");
}

/**
 * Produce a link-less variant of a markdown embed template by removing the
 * outer `[...](...)` link wrapper around a leading image, i.e. turning
 * `[![alt](path)](url)` into `![alt](path)`. Only the outer link around the
 * image is stripped; any other lines in the template (e.g. the caption
 * line) are left untouched.
 *
 * Only used by the settings migration (the legacy "Link to Immich" toggle
 * worked by stripping the link from the template before rendering).
 */
export function stripOuterLink(template: string): string {
	const lines = template.split("\n");
	const imageLineIndex = lines.findIndex((line) => /!\[.*\]\(.*\)/.test(line));
	if (imageLineIndex === -1) {
		return template;
	}

	const line = lines[imageLineIndex];
	const match = line.match(/^(.*)\[(!\[.*\]\(.*\))\]\([^)]*\)(.*)$/);
	if (!match) {
		return template;
	}

	const [, prefix, imagePart, suffix] = match;
	lines[imageLineIndex] = `${prefix}${imagePart}${suffix}`;
	return lines.join("\n");
}

/**
 * Join multiple rendered blocks with a blank line between them.
 */
export function joinBlocks(blocks: string[]): string {
	return blocks.join("\n\n");
}
