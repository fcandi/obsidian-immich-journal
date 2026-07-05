/**
 * Vault I/O helpers for writing downloaded/resized Immich assets into the
 * Obsidian vault.
 *
 * Idempotency (concept §5.1): if the target file already exists, the caller
 * is expected to skip the download entirely (see `fileExists`), and
 * `writeAssetFile` itself never overwrites an existing file.
 */

import { App, TFile } from "obsidian";

/**
 * Ensure that `folderPath` (a vault-relative path, e.g. "Journal/Photos")
 * exists, creating any missing segments along the way.
 *
 * Segments that already exist (checked via `vault.getAbstractFileByPath`)
 * are skipped. `vault.createFolder` throwing an "already exists" style
 * error (e.g. due to a concurrent create from another code path) is
 * tolerated rather than propagated.
 */
export async function ensureFolder(app: App, folderPath: string): Promise<void> {
	const normalized = folderPath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
	if (normalized === "") {
		return;
	}

	const segments = normalized.split("/");
	let currentPath = "";

	for (const segment of segments) {
		currentPath = currentPath === "" ? segment : `${currentPath}/${segment}`;

		if (app.vault.getAbstractFileByPath(currentPath)) {
			continue;
		}

		try {
			await app.vault.createFolder(currentPath);
		} catch (error) {
			// Tolerate a concurrent creation of the same folder (e.g. from
			// another insertion running at the same time). Re-throw
			// anything else.
			const message = error instanceof Error ? error.message : String(error);
			if (!/already exists/i.test(message)) {
				throw error;
			}
		}
	}
}

/**
 * Return true if `vaultPath` already exists as a file in the vault.
 *
 * Callers use this to decide whether to skip downloading an asset before
 * doing any network work.
 */
export function fileExists(app: App, vaultPath: string): boolean {
	return app.vault.getAbstractFileByPath(vaultPath) instanceof TFile;
}

/**
 * Derive the parent folder path of a vault-relative file path via plain
 * string manipulation (no Node `path` module — must stay mobile-safe).
 */
function parentFolder(vaultPath: string): string {
	const normalized = vaultPath.replace(/\\/g, "/");
	const slashIndex = normalized.lastIndexOf("/");
	return slashIndex === -1 ? "" : normalized.slice(0, slashIndex);
}

/**
 * Write `buf` to `vaultPath`, creating any missing parent folders first.
 *
 * Idempotent: if `vaultPath` already exists as a `TFile`, it is returned
 * unchanged and no write happens — callers rely on this to avoid
 * re-downloading/re-encoding assets that were already inserted before.
 */
export async function writeAssetFile(app: App, vaultPath: string, buf: ArrayBuffer): Promise<TFile> {
	const existing = app.vault.getAbstractFileByPath(vaultPath);
	if (existing instanceof TFile) {
		return existing;
	}

	const folder = parentFolder(vaultPath);
	if (folder !== "") {
		await ensureFolder(app, folder);
	}

	return app.vault.createBinary(vaultPath, buf);
}
