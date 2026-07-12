/**
 * Insert pipeline orchestrator (concept §5).
 *
 * For each selected asset (in the order the caller passes — capture order),
 * sequentially: build vault paths, download+downscale (skipped when the file
 * already exists — idempotence via the asset id in the file name), write the
 * binary into the vault, render caption and markdown block. All successful
 * blocks are then joined with blank lines and inserted ONCE.
 *
 * Per-asset failures are collected and do not abort the remaining assets.
 * A binary is only written after a successful download AND downscale, so no
 * half-written file is ever left behind on error.
 *
 * Where the joined result goes depends on `settings.insertPosition`:
 * "cursor" (default) inserts at the cursor when an editor is active and
 * appends to the end otherwise; "top" inserts after the frontmatter; "bottom"
 * appends at the end. For "top"/"bottom" the active editor is still used when
 * available so unsaved editor changes are never clobbered by a disk write.
 */

import { App, Editor, Notice, TFile } from "obsidian";
import type { ImmichClient } from "../api/immichClient";
import { t } from "../i18n";
import type { ImmichAsset, PluginSettings } from "../types";
import { buildImmichUrl } from "../util/deepLink";
import { buildCaptionVars } from "./caption";
import { joinBlocks, renderBlock, templateForPreset } from "./markdownBlock";
import { buildFileName, buildFolderPath, buildVaultPath } from "./paths";
import { downscaleToJpeg } from "./downscale";
import { frontmatterEndOffset, insertAtPosition } from "./insertPosition";
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

// Both path forms are always provided to the template: `localPath` with
// spaces percent-encoded (`%20`) so it never breaks a markdown `(...)` link
// target, and `localPathRaw` unencoded for `![[...]]` wikilinks, which
// Obsidian resolves with literal spaces (`%20` would break them there).

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

			// 3. Render context: EXIF/metadata variables plus the paths/links.
			const description = asset.exifInfo?.description ?? "";
			const altText = description.trim() !== "" ? description : asset.originalFileName;
			const vars = {
				...buildCaptionVars(asset),
				altText,
				localPath: vaultPath.replace(/ /g, "%20"),
				localPathRaw: vaultPath,
				immichUrl: buildImmichUrl(settings.serverUrl, asset.id),
			};

			// 4. Markdown block.
			blocks.push(renderBlock(templateForPreset(settings), vars));
		} catch (error) {
			failed++;
			console.error(`Immich Journal: failed to insert asset ${asset.id}`, error);
		}
	}

	if (blocks.length > 0) {
		const joined = joinBlocks(blocks);
		const position = settings.insertPosition;

		if (target.editor && position === "cursor") {
			target.editor.replaceSelection(joined + "\n");
		} else if (target.editor) {
			// "top"/"bottom" with an active editor: edit via the editor so
			// unsaved changes are preserved (a disk write could clobber them).
			const editor = target.editor;
			const content = editor.getValue();
			if (position === "top") {
				const offset = frontmatterEndOffset(content);
				const suffix = content.slice(offset) === "" ? "\n" : "\n\n";
				editor.replaceRange(joined + suffix, editor.offsetToPos(offset));
			} else {
				const separator =
					content === "" ? "" : content.endsWith("\n") ? "\n" : "\n\n";
				editor.replaceRange(
					separator + joined + "\n",
					editor.offsetToPos(content.length)
				);
			}
		} else {
			// No active editor: modify the file on disk. A "cursor" position
			// without an editor falls back to appending at the end.
			await app.vault.process(target.file, (content) =>
				insertAtPosition(content, joined, position === "top" ? "top" : "bottom")
			);
		}
	}

	new Notice(t("notice.inserted", { count: String(blocks.length) }));
	if (failed > 0) {
		new Notice(t("notice.insertFailed", { count: String(failed) }));
	}

	return { inserted: blocks.length, failed };
}
