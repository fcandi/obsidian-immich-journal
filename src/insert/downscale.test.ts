import { describe, expect, it } from "vitest";
import { computeTargetSize } from "./downscale";

describe("computeTargetSize", () => {
	it("scales a landscape image so the width becomes maxEdgePx", () => {
		expect(computeTargetSize(4000, 3000, 800)).toEqual({
			width: 800,
			height: 600,
			needsResize: true,
		});
	});

	it("scales a portrait image so the height becomes maxEdgePx", () => {
		expect(computeTargetSize(3000, 4000, 800)).toEqual({
			width: 600,
			height: 800,
			needsResize: true,
		});
	});

	it("scales a square image to maxEdgePx on both sides", () => {
		expect(computeTargetSize(2000, 2000, 800)).toEqual({
			width: 800,
			height: 800,
			needsResize: true,
		});
	});

	it("returns the original size when the longest side exactly equals maxEdgePx", () => {
		expect(computeTargetSize(800, 533, 800)).toEqual({
			width: 800,
			height: 533,
			needsResize: false,
		});
	});

	it("never upscales images smaller than maxEdgePx", () => {
		expect(computeTargetSize(400, 300, 800)).toEqual({
			width: 400,
			height: 300,
			needsResize: false,
		});
	});

	it("rounds non-integer results to integers", () => {
		// 1000 x 333 scaled to maxEdge 800 -> height 266.4 -> 266
		expect(computeTargetSize(1000, 333, 800)).toEqual({
			width: 800,
			height: 266,
			needsResize: true,
		});
	});

	it("clamps extremely thin images to a minimum of 1px", () => {
		// 10000 x 1 scaled to maxEdge 100 -> height 0.01 -> clamped to 1
		expect(computeTargetSize(10000, 1, 100)).toEqual({
			width: 100,
			height: 1,
			needsResize: true,
		});
	});

	it("handles tiny maxEdgePx values", () => {
		expect(computeTargetSize(4000, 3000, 1)).toEqual({
			width: 1,
			height: 1,
			needsResize: true,
		});
	});
});
