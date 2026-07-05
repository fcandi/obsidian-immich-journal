/**
 * Insert pipeline orchestrator (concept §5).
 *
 * For each selected asset (in the order the caller passes — capture order),
 * sequentially: build vault paths, download+downscale (skipped when the file
 * already exists — idempotence via the asset id in the file name), write the
 * binary into the vault, render caption and markdown block. All successful
 * blocks are then joined with blank lines and inserted ONCE — at the cursor
 * when an editor is active, otherwise appended to the end of the file.
 *
 * Per-asset failures are collected and do not abort the remaining assets.
 * A binary is only written after a successful download AND downscale, so no
 * half-written file is ever left behind on error.
 */

import { App, Editor, Notice, TFile } from "obsidian";
import type { ImmichClient } from "../api/immichClient";
import { t } from "../i18n";
import type { ImmichAsset, PluginSettings } from "../types";
import { buildImmichUrl } from "../util/deepLink";
import { renderCaption } from "./caption";
import { joinBlocks, renderBlock } from "./markdownBlock";
import { buildFileName, buildFolderPath, buildVaultPath } from "./paths";
import { downscaleToJpeg } from "./downscale";
import { fileExists, writeAssetFile } from "./vaultWriter";

/** Dependencies injected by the caller (plugin main / modal). */
export interface InsertDeps {
	app: App;
	client: ImmichClient;
	settings: PluginSettings;
}

/** Where to insert: an active editor (cursor) or a file to append to. */
export interface InsertTarget {
	editor: Editor | null;
	file: TFile;
}

/** Outcome counts of an insert run. */
export interface InsertResult {
	inserted: number;
	failed: number;
}

/**
 * Encode a vault-relative path for use inside a markdown `![](...)` target.
 *
 * Encoding choice (documented per spec): only for the `markdown` embed style
 * spaces are percent-encoded (`%20`) so paths with spaces do not break the
 * `(...)` link target. For the `wikilink` style the RAW path is passed —
 * `![[...]]` must contain the literal path, Obsidian resolves spaces there
 * natively and `%20` would break resolution. The conditional encoding happens
 * here in the pipeline, so `renderBlock`'s ctx always carries the right form
 * for the chosen style.
 */
function localPathFor(vaultPath: string, embedStyle: PluginSettings["embedStyle"]): string {
	return embedStyle === "markdown" ? vaultPath.replace(/ /g, "%20") : vaultPath;
}

/**
 * Download (unless already present), write, and render assets into the target
 * note. Returns how many assets were inserted and how many failed. Shows one
 * summary Notice at the end (plus a failure Notice when anything failed).
 */
export async function insertAssets(
	deps: InsertDeps,
	assets: ImmichAsset[],
	target: InsertTarget
): Promise<InsertResult> {
	const { app, client, settings } = deps;

	const blocks: string[] = [];
	let failed = 0;

	// Sequential on purpose: preserves capture order in the note, keeps
	// memory usage low (one decoded image at a time), and avoids hammering
	// the Immich server with parallel thumbnail requests.
	for (const asset of assets) {
		try {
			// 1. Paths (date from localDateTime — local wall-clock day).
			const date = asset.localDateTime.slice(0, 10);
			const folder = buildFolderPath(settings.attachmentFolder, date);
			const fileName = buildFileName(settings.fileNameTemplate, date, asset.id);
			const vaultPath = buildVaultPath(folder, fileName);

			// 2. Idempotence: reuse an existing file, otherwise download,
			// downscale, and only then write (never a half-written binary).
			if (!fileExists(app, vaultPath)) {
				const raw = await client.fetchThumbnail(asset.id, "preview");
				const jpeg = await downscaleToJpeg(raw, settings.maxEdgePx, settings.jpegQuality);
				await writeAssetFile(app, vaultPath, jpeg);
			}

			// 3. Render context.
			const caption = renderCaption(settings.captionTemplate, asset);
			const description = asset.exifInfo?.description ?? "";
			const altText = description.trim() !== "" ? description : asset.originalFileName;
			const immichUrl = buildImmichUrl(settings.serverUrl, asset.id);
			const localPath = localPathFor(vaultPath, settings.embedStyle);

			// 4. Markdown block.
			const block = renderBlock(
				settings.markdownTemplate,
				{ altText, localPath, immichUrl, caption },
				{ linkToImmich: settings.linkToImmich, embedStyle: settings.embedStyle }
			);
			blocks.push(block);
		} catch (error) {
			failed++;
			console.error(`Immich Journal: failed to insert asset ${asset.id}`, error);
		}
	}

	if (blocks.length > 0) {
		const joined = joinBlocks(blocks);

		if (target.editor) {
			// Decided: insert at the cursor position.
			target.editor.replaceSelection(joined + "\n");
		} else {
			// No active editor: append to the end of the file with a
			// separating blank line (unless the file is empty).
			await app.vault.process(target.file, (content) => {
				if (content === "") {
					return joined + "\n";
				}
				const separator = content.endsWith("\n") ? "\n" : "\n\n";
				return content + separator + joined + "\n";
			});
		}
	}

	new Notice(t("notice.inserted", { count: String(blocks.length) }));
	if (failed > 0) {
		new Notice(t("notice.insertFailed", { count: String(failed) }));
	}

	return { inserted: blocks.length, failed };
}
