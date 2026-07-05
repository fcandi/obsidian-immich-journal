import { renderTemplate } from "../util/template";

/**
 * Builds a folder path from a template and a "YYYY-MM-DD" date string.
 *
 * Supports `{{year}}`, `{{month}}`, `{{day}}`, `{{date}}` placeholders, resolved
 * with pure string slicing (no Date parsing, no timezone concerns).
 *
 * The result is normalized: no duplicate slashes, no leading slash, no
 * trailing slash.
 */
export function buildFolderPath(template: string, date: string): string {
	const year = date.slice(0, 4);
	const month = date.slice(5, 7);
	const day = date.slice(8, 10);

	const rendered = renderTemplate(template, {
		year,
		month,
		day,
		date,
	});

	return normalizeFolderPath(rendered);
}

/**
 * Builds a file name from a template, a "YYYY-MM-DD" date string, and an asset id.
 *
 * Supports `{{date}}`, `{{assetId}}`, `{{assetIdShort}}` (first 8 chars of the
 * asset id) placeholders. Appends `.jpg` if the rendered name has no extension.
 */
export function buildFileName(template: string, date: string, assetId: string): string {
	const rendered = renderTemplate(template, {
		date,
		assetId,
		assetIdShort: assetId.slice(0, 8),
	});

	return hasExtension(rendered) ? rendered : `${rendered}.jpg`;
}

/**
 * Joins a folder path and a file name into a single vault-relative path,
 * using exactly one slash. Handles an empty folder (returns just the file name).
 */
export function buildVaultPath(folder: string, fileName: string): string {
	const normalizedFolder = normalizeFolderPath(folder);
	const normalizedFile = fileName.replace(/^\/+/, "");

	return normalizedFolder === "" ? normalizedFile : `${normalizedFolder}/${normalizedFile}`;
}

function normalizeFolderPath(path: string): string {
	return path
		.split("/")
		.map((segment) => segment.trim())
		.filter((segment) => segment.length > 0)
		.join("/");
}

function hasExtension(fileName: string): boolean {
	const lastSegment = fileName.split("/").pop() ?? fileName;
	return /\.[^.]+$/.test(lastSegment);
}
