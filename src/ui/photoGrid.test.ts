import { describe, expect, it } from "vitest";
import type { ImmichAsset } from "../types";
import { overlayInfo, selectedAssetsInCaptureOrder } from "./photoGrid";

function asset(
	id: string,
	localDateTime: string,
	description?: string | null
): ImmichAsset {
	return {
		id,
		localDateTime,
		type: "IMAGE",
		originalFileName: `${id}.jpg`,
		exifInfo: description === undefined ? null : { description },
	};
}

describe("overlayInfo", () => {
	it("extracts HH:mm from localDateTime without timezone reinterpretation", () => {
		const info = overlayInfo(asset("a", "2026-07-05T19:42:03.000"));
		expect(info.time).toBe("19:42");
	});

	it("returns the trimmed description", () => {
		const info = overlayInfo(
			asset("a", "2026-07-05T08:00:00.000", "  Sunrise hike  ")
		);
		expect(info.description).toBe("Sunrise hike");
	});

	it("returns an empty description when exifInfo or description is missing", () => {
		expect(
			overlayInfo(asset("a", "2026-07-05T08:00:00.000")).description
		).toBe("");
		expect(
			overlayInfo(asset("a", "2026-07-05T08:00:00.000", null)).description
		).toBe("");
	});
});

describe("selectedAssetsInCaptureOrder", () => {
	const assets = [
		asset("late", "2026-07-05T21:00:00.000"),
		asset("early", "2026-07-05T06:30:00.000"),
		asset("noon", "2026-07-05T12:00:00.000"),
	];

	it("returns only the selected assets", () => {
		const result = selectedAssetsInCaptureOrder(
			assets,
			new Set(["noon"])
		);
		expect(result.map((a) => a.id)).toEqual(["noon"]);
	});

	it("sorts by capture time ascending regardless of selection order", () => {
		const result = selectedAssetsInCaptureOrder(
			assets,
			new Set(["late", "early", "noon"])
		);
		expect(result.map((a) => a.id)).toEqual(["early", "noon", "late"]);
	});

	it("returns an empty array when nothing is selected", () => {
		expect(selectedAssetsInCaptureOrder(assets, new Set())).toEqual([]);
	});
});
