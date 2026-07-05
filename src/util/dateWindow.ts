/**
 * Computes a deliberately generous UTC query window around a local calendar day.
 *
 * The window spans from one day before `localDay` (00:00:00.000Z) to two days
 * after `localDay` (00:00:00.000Z). This over-covers every real-world timezone
 * offset (-12:00 to +14:00), so the server-side search never misses assets
 * taken on `localDay` in the user's local timezone. Exact filtering down to
 * the precise local day happens client-side afterwards.
 */

export interface DateWindow {
	takenAfter: string;
	takenBefore: string;
}

/**
 * Returns the generous UTC search window for a given local day.
 *
 * @param localDay - Calendar day in "YYYY-MM-DD" format.
 * @returns ISO 8601 UTC timestamps (ending in "Z") bounding the search window.
 */
export function dayUtcWindow(localDay: string): DateWindow {
	const [year, month, day] = localDay.split("-").map(Number);

	const takenAfter = new Date(Date.UTC(year, month - 1, day - 1, 0, 0, 0, 0));
	const takenBefore = new Date(Date.UTC(year, month - 1, day + 2, 0, 0, 0, 0));

	return {
		takenAfter: takenAfter.toISOString(),
		takenBefore: takenBefore.toISOString(),
	};
}
