/**
 * Pure helpers for the photo picker grid. Kept free of DOM and Obsidian
 * dependencies so they can be unit-tested directly.
 */

import type { ImmichAsset } from "../types";

/** Long-press duration (ms) that reveals the info overlay on touch devices. */
export const LONG_PRESS_MS = 500;

/** Text content shown in a cell's info overlay. */
export interface OverlayInfo {
	/** Capture time as "HH:mm" (local wall-clock time at the capture location). */
	time: string;
	/** Trimmed EXIF description, or "" when none is set. */
	description: string;
}

/**
 * Extracts the overlay content (time + description) for a grid cell.
 *
 * `localDateTime` is an ISO-like string ("YYYY-MM-DDTHH:mm:ss..."), so the
 * "HH:mm" part sits at positions 11-16. No Date parsing — that would
 * reinterpret the wall-clock value in the viewer's timezone.
 */
export function overlayInfo(asset: ImmichAsset): OverlayInfo {
	return {
		time: asset.localDateTime.slice(11, 16),
		description: asset.exifInfo?.description?.trim() ?? "",
	};
}

/**
 * Returns the assets whose ids are in `selectedIds`, sorted ascending by
 * `localDateTime` (capture order). Selection order is deliberately ignored:
 * inserted photos always appear in the order they were taken.
 */
export function selectedAssetsInCaptureOrder(
	assets: ImmichAsset[],
	selectedIds: ReadonlySet<string>
): ImmichAsset[] {
	return assets
		.filter((asset) => selectedIds.has(asset.id))
		.sort((a, b) => a.localDateTime.localeCompare(b.localDateTime));
}
