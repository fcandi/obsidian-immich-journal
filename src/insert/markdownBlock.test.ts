import { describe, expect, it } from "vitest";
import {
	joinBlocks,
	PRESET_TEMPLATES,
	renderBlock,
	stripOuterLink,
	templateForPreset,
} from "./markdownBlock";
import { DEFAULT_SETTINGS } from "../settings/defaults";

const baseVars = {
	altText: "A sunset",
	localPath: "Journal/Photos/2026-07-05-1.jpg",
	localPathRaw: "Journal/Photos/2026-07-05-1.jpg",
	immichUrl: "https://immich.example.com/photos/abc123",
	description: "A beautiful sunset",
};

describe("renderBlock", () => {
	it("renders the markdownLink preset: linked image plus caption", () => {
		const result = renderBlock(PRESET_TEMPLATES.markdownLink, baseVars);

		expect(result).toBe(
			"[![A sunset](Journal/Photos/2026-07-05-1.jpg)](https://immich.example.com/photos/abc123)\n*A beautiful sunset*"
		);
	});

	it("renders the markdownPlain preset: image without a link", () => {
		const result = renderBlock(PRESET_TEMPLATES.markdownPlain, baseVars);

		expect(result).toBe(
			"![A sunset](Journal/Photos/2026-07-05-1.jpg)\n*A beautiful sunset*"
		);
		expect(result).not.toContain("](https://immich.example.com/photos/abc123)");
	});

	it("renders the wikilink preset using the raw path", () => {
		const result = renderBlock(PRESET_TEMPLATES.wikilink, {
			...baseVars,
			localPath: "Journal/Photos/with%20space.jpg",
			localPathRaw: "Journal/Photos/with space.jpg",
		});

		expect(result).toBe(
			"![[Journal/Photos/with space.jpg]]\n*A beautiful sunset*"
		);
	});

	it("omits the caption line when the description is empty", () => {
		const result = renderBlock(PRESET_TEMPLATES.markdownLink, {
			...baseVars,
			description: "",
		});

		expect(result).toBe(
			"[![A sunset](Journal/Photos/2026-07-05-1.jpg)](https://immich.example.com/photos/abc123)"
		);
		expect(result.split("\n")).toHaveLength(1);
	});

	it("renders a custom template with metadata variables", () => {
		const result = renderBlock(
			"![{{altText}}]({{localPath}})\n> {{time}} in {{city}}",
			{ ...baseVars, time: "19:42", city: "Munich" }
		);

		expect(result).toBe(
			"![A sunset](Journal/Photos/2026-07-05-1.jpg)\n> 19:42 in Munich"
		);
	});
});

describe("templateForPreset", () => {
	it("resolves presets to their fixed templates", () => {
		expect(
			templateForPreset({ ...DEFAULT_SETTINGS, embedPreset: "wikilink" })
		).toBe(PRESET_TEMPLATES.wikilink);
	});

	it("resolves the custom preset to the user template", () => {
		expect(
			templateForPreset({
				...DEFAULT_SETTINGS,
				embedPreset: "custom",
				markdownTemplate: "MY TEMPLATE",
			})
		).toBe("MY TEMPLATE");
	});
});

describe("stripOuterLink", () => {
	it("removes the outer link wrapper around a leading image", () => {
		expect(
			stripOuterLink("[![{{altText}}]({{localPath}})]({{immichUrl}})\n*{{caption}}*")
		).toBe("![{{altText}}]({{localPath}})\n*{{caption}}*");
	});

	it("returns templates without an outer link unchanged", () => {
		const template = "![{{altText}}]({{localPath}})\n*{{caption}}*";

		expect(stripOuterLink(template)).toBe(template);
	});
});

describe("joinBlocks", () => {
	it("joins blocks with a blank line between them", () => {
		expect(joinBlocks(["block1", "block2"])).toBe("block1\n\nblock2");
	});

	it("joins three blocks with blank lines between each", () => {
		expect(joinBlocks(["a", "b", "c"])).toBe("a\n\nb\n\nc");
	});

	it("returns a single block unchanged", () => {
		expect(joinBlocks(["only"])).toBe("only");
	});

	it("returns an empty string for an empty list", () => {
		expect(joinBlocks([])).toBe("");
	});
});
