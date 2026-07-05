import type { ImmichAsset } from "../types";

/**
 * Filters assets to those captured on a given local calendar day, and sorts
 * the result ascending by capture time.
 *
 * "Local day" means the wall-clock day at the capture location, as encoded
 * in `asset.localDateTime` (e.g. a photo taken at 23:30 Bangkok time still
 * matches that Bangkok calendar day, even though its UTC timestamp may fall
 * on the next day).
 *
 * @param assets Candidate assets, typically from a generous UTC time window.
 * @param localDay Calendar day to match, formatted `YYYY-MM-DD`.
 * @returns Assets whose `localDateTime` starts with `localDay`, sorted
 *   ascending by `localDateTime` (i.e. capture order).
 */
export function filterByLocalDay(assets: ImmichAsset[], localDay: string): ImmichAsset[] {
	return assets
		.filter((asset) => asset.localDateTime.startsWith(localDay))
		.sort((a, b) => a.localDateTime.localeCompare(b.localDateTime));
}
