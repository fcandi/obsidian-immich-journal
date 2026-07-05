/**
 * Renders the markdown block inserted into a daily note for a single asset.
 *
 * Supports two embed styles:
 * - `markdown`: a standard markdown image, optionally wrapped in a link back
 *   to Immich, plus an italic caption line.
 * - `wikilink`: a fixed Obsidian wikilink embed (`![[path]]`). Wikilink
 *   embeds cannot carry an outer link, so `linkToImmich` has no effect on
 *   this style — documented limitation.
 */

import { renderTemplate } from "../util/template";

export interface MarkdownBlockContext {
	altText: string;
	localPath: string;
	immichUrl: string;
	caption: string;
}

export interface MarkdownBlockOptions {
	linkToImmich: boolean;
	embedStyle: "markdown" | "wikilink";
}

export const DEFAULT_MARKDOWN_TEMPLATE = "[![{{altText}}]({{localPath}})]({{immichUrl}})\n*{{caption}}*";

/**
 * Return true if `line` has no visible content once common markdown
 * formatting characters (`*`, `_`) and whitespace are stripped. Used to
 * drop an empty caption line after rendering.
 */
function isBlankOnceFormattingStripped(line: string): boolean {
	return line.replace(/[*_\s]/g, "") === "";
}

/**
 * Render a single asset's markdown block.
 *
 * `template` only applies to `embedStyle: 'markdown'`. For `wikilink`, the
 * embed form is fixed and `template`/`linkToImmich` are ignored for the
 * embed line itself (a wikilink embed cannot carry an outer link).
 */
export function renderBlock(template: string, ctx: MarkdownBlockContext, opts: MarkdownBlockOptions): string {
	const vars: Record<string, string> = {
		altText: ctx.altText,
		localPath: ctx.localPath,
		immichUrl: ctx.immichUrl,
		caption: ctx.caption,
	};

	let rendered: string;

	if (opts.embedStyle === "wikilink") {
		const captionLine = renderTemplate("*{{caption}}*", vars);
		rendered = [`![[${ctx.localPath}]]`, captionLine].join("\n");
	} else {
		const effectiveTemplate = opts.linkToImmich ? template : stripOuterLink(template);
		rendered = renderTemplate(effectiveTemplate, vars);
	}

	return rendered
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
 * This operates on the template (before variable substitution), not on the
 * rendered output, so it never risks mangling user-provided caption text
 * that happens to contain brackets.
 */
function stripOuterLink(template: string): string {
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
