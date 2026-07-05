import { describe, expect, it } from "vitest";
import type { ImmichAsset } from "../types";
import { buildCaptionVars, renderCaption } from "./caption";

function makeAsset(overrides: Partial<ImmichAsset> = {}): ImmichAsset {
	return {
		id: "asset-1",
		localDateTime: "2026-07-05T19:42:00.000",
		type: "IMAGE",
		originalFileName: "IMG_1234.heic",
		exifInfo: {
			description: "A lovely sunset",
			city: "Munich",
			country: "Germany",
			make: "Apple",
			model: "iPhone 15 Pro",
		},
		people: [{ name: "Alice" }, { name: "Bob" }],
		...overrides,
	};
}

describe("buildCaptionVars", () => {
	it("extracts all fields from full metadata", () => {
		const vars = buildCaptionVars(makeAsset());
		expect(vars).toEqual({
			description: "A lovely sunset",
			time: "19:42",
			date: "2026-07-05",
			city: "Munich",
			country: "Germany",
			camera: "Apple iPhone 15 Pro",
			people: "Alice, Bob",
			filename: "IMG_1234.heic",
		});
	});

	it("defaults description/city/country to empty string when exifInfo is null", () => {
		const vars = buildCaptionVars(makeAsset({ exifInfo: null }));
		expect(vars.description).toBe("");
		expect(vars.city).toBe("");
		expect(vars.country).toBe("");
		expect(vars.camera).toBe("");
	});

	it("defaults description/city/country to empty string when fields are null", () => {
		const vars = buildCaptionVars(
			makeAsset({
				exifInfo: {
					description: null,
					city: null,
					country: null,
					make: null,
					model: null,
				},
			})
		);
		expect(vars.description).toBe("");
		expect(vars.city).toBe("");
		expect(vars.country).toBe("");
		expect(vars.camera).toBe("");
	});

	it("joins camera from only the present parts (make only)", () => {
		const vars = buildCaptionVars(
			makeAsset({ exifInfo: { make: "Canon", model: null } })
		);
		expect(vars.camera).toBe("Canon");
	});

	it("joins camera from only the present parts (model only)", () => {
		const vars = buildCaptionVars(
			makeAsset({ exifInfo: { make: null, model: "EOS R5" } })
		);
		expect(vars.camera).toBe("EOS R5");
	});

	it("joins multiple people with ', '", () => {
		const vars = buildCaptionVars(
			makeAsset({ people: [{ name: "Alice" }, { name: "Bob" }, { name: "Carol" }] })
		);
		expect(vars.people).toBe("Alice, Bob, Carol");
	});

	it("renders an empty people string when no people are tagged", () => {
		expect(buildCaptionVars(makeAsset({ people: [] })).people).toBe("");
		expect(buildCaptionVars(makeAsset({ people: null })).people).toBe("");
	});

	it("extracts date and time from localDateTime as local wall-clock values", () => {
		const vars = buildCaptionVars(
			makeAsset({ localDateTime: "2026-01-09T07:05:33.123" })
		);
		expect(vars.date).toBe("2026-01-09");
		expect(vars.time).toBe("07:05");
	});

	it("uses originalFileName for filename", () => {
		expect(buildCaptionVars(makeAsset()).filename).toBe("IMG_1234.heic");
	});
});

describe("renderCaption", () => {
	it("renders the default template ({{description}}) with a description present", () => {
		expect(renderCaption("{{description}}", makeAsset())).toBe("A lovely sunset");
	});

	it("returns '' when the default template renders empty (no description)", () => {
		expect(
			renderCaption("{{description}}", makeAsset({ exifInfo: { description: "" } }))
		).toBe("");
		expect(
			renderCaption("{{description}}", makeAsset({ exifInfo: { description: null } }))
		).toBe("");
	});

	it("returns '' when the rendered result is only whitespace", () => {
		expect(
			renderCaption("   {{description}}   ", makeAsset({ exifInfo: { description: null } }))
		).toBe("");
	});

	it("trims surrounding whitespace from a non-empty render", () => {
		expect(renderCaption("  {{description}}  ", makeAsset())).toBe("A lovely sunset");
	});

	it("supports composed templates with multiple variables", () => {
		expect(
			renderCaption("{{date}} {{time}} — {{city}}, {{country}}", makeAsset())
		).toBe("2026-07-05 19:42 — Munich, Germany");
	});

	it("renders people and camera in a composed template", () => {
		expect(renderCaption("{{camera}} ({{people}})", makeAsset())).toBe(
			"Apple iPhone 15 Pro (Alice, Bob)"
		);
	});
});
