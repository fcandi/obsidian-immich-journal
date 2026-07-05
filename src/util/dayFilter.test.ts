import { describe, expect, it } from "vitest";
import type { ImmichAsset } from "../types";
import { filterByLocalDay } from "./dayFilter";

function makeAsset(id: string, localDateTime: string): ImmichAsset {
	return {
		id,
		localDateTime,
		type: "IMAGE",
		originalFileName: `${id}.jpg`,
	};
}

describe("filterByLocalDay", () => {
	it("matches a travel-day photo whose UTC timestamp falls on the next day", () => {
		// 23:30 local time in Bangkok on 2026-03-14 is already 2026-03-15 in UTC,
		// but localDateTime encodes wall-clock time at the capture location, so
		// it must still be attributed to the 2026-03-14 local day.
		const asset = makeAsset("a1", "2026-03-14T23:30:00.000");

		const result = filterByLocalDay([asset], "2026-03-14");

		expect(result).toEqual([asset]);
	});

	it("filters out assets from other days", () => {
		const dayBefore = makeAsset("a1", "2026-03-13T10:00:00.000");
		const match = makeAsset("a2", "2026-03-14T10:00:00.000");
		const dayAfter = makeAsset("a3", "2026-03-15T10:00:00.000");

		const result = filterByLocalDay([dayBefore, match, dayAfter], "2026-03-14");

		expect(result).toEqual([match]);
	});

	it("sorts matching assets ascending by localDateTime (capture order)", () => {
		const late = makeAsset("a1", "2026-03-14T20:00:00.000");
		const early = makeAsset("a2", "2026-03-14T06:00:00.000");
		const mid = makeAsset("a3", "2026-03-14T12:00:00.000");

		const result = filterByLocalDay([late, early, mid], "2026-03-14");

		expect(result.map((asset) => asset.id)).toEqual(["a2", "a3", "a1"]);
	});

	it("returns an empty array for empty input", () => {
		const result = filterByLocalDay([], "2026-03-14");

		expect(result).toEqual([]);
	});
});
