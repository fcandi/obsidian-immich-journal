/**
 * Pure helpers for the "insert position" setting: compute where in a note's
 * content a rendered photo block goes and how to splice it in.
 *
 * "top" means after the YAML frontmatter block when one exists (inserting
 * above the frontmatter would break it), otherwise at the very start.
 * "bottom" appends at the end with a separating blank line.
 */

import { PluginSettings } from "../types";

export type InsertPosition = PluginSettings["insertPosition"];

/**
 * Return the character offset right after the YAML frontmatter block, or 0
 * when the content has none. Frontmatter is a leading `---` line closed by a
 * `---` (or `...`) line; an unclosed opener is not frontmatter.
 */
export function frontmatterEndOffset(content: string): number {
	const lines = content.split("\n");
	if (lines[0] !== "---") {
		return 0;
	}

	for (let i = 1; i < lines.length; i++) {
		if (lines[i] === "---" || lines[i] === "...") {
			const end = lines.slice(0, i + 1).join("\n").length;
			// Include the newline after the closing delimiter when present.
			return Math.min(end + 1, content.length);
		}
	}

	return 0;
}

/**
 * Splice `block` into `content` at the given position ("cursor" is handled
 * by the editor and never reaches this function). A blank line separates the
 * block from existing content on both styles.
 */
export function insertAtPosition(
	content: string,
	block: string,
	position: "top" | "bottom"
): string {
	if (position === "top") {
		const offset = frontmatterEndOffset(content);
		const before = content.slice(0, offset);
		const after = content.slice(offset);
		return after === ""
			? `${before}${block}\n`
			: `${before}${block}\n\n${after}`;
	}

	if (content === "") {
		return `${block}\n`;
	}
	const separator = content.endsWith("\n") ? "\n" : "\n\n";
	return `${content}${separator}${block}\n`;
}
