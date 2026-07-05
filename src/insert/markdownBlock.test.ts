import { describe, expect, it } from "vitest";
import { DEFAULT_MARKDOWN_TEMPLATE, joinBlocks, renderBlock } from "./markdownBlock";

const baseCtx = {
	altText: "A sunset",
	localPath: "Journal/Photos/2026-07-05-1.jpg",
	immichUrl: "https://immich.example.com/photos/abc123",
	caption: "A beautiful sunset",
};

describe("renderBlock", () => {
	it("renders the default template with a caption, linked to Immich", () => {
		const result = renderBlock(DEFAULT_MARKDOWN_TEMPLATE, baseCtx, {
			linkToImmich: true,
			embedStyle: "markdown",
		});

		expect(result).toBe(
			"[![A sunset](Journal/Photos/2026-07-05-1.jpg)](https://immich.example.com/photos/abc123)\n*A beautiful sunset*"
		);
	});

	it("omits the caption line when the caption is empty", () => {
		const result = renderBlock(DEFAULT_MARKDOWN_TEMPLATE, { ...baseCtx, caption: "" }, {
			linkToImmich: true,
			embedStyle: "markdown",
		});

		expect(result).toBe(
			"[![A sunset](Journal/Photos/2026-07-05-1.jpg)](https://immich.example.com/photos/abc123)"
		);
		expect(result).not.toContain("*");
		expect(result.split("\n")).toHaveLength(1);
	});

	it("degrades to a plain image when linkToImmich is false", () => {
		const result = renderBlock(DEFAULT_MARKDOWN_TEMPLATE, baseCtx, {
			linkToImmich: false,
			embedStyle: "markdown",
		});

		expect(result).toBe("![A sunset](Journal/Photos/2026-07-05-1.jpg)\n*A beautiful sunset*");
		expect(result).not.toContain("](https://immich.example.com/photos/abc123)");
	});

	it("degrades to a plain image with empty caption omitted, when linkToImmich is false", () => {
		const result = renderBlock(DEFAULT_MARKDOWN_TEMPLATE, { ...baseCtx, caption: "" }, {
			linkToImmich: false,
			embedStyle: "markdown",
		});

		expect(result).toBe("![A sunset](Journal/Photos/2026-07-05-1.jpg)");
	});

	it("renders a fixed wikilink embed regardless of linkToImmich", () => {
		const result = renderBlock(DEFAULT_MARKDOWN_TEMPLATE, baseCtx, {
			linkToImmich: true,
			embedStyle: "wikilink",
		});

		expect(result).toBe("![[Journal/Photos/2026-07-05-1.jpg]]\n*A beautiful sunset*");
	});

	it("wikilink embed omits the caption line when caption is empty", () => {
		const result = renderBlock(DEFAULT_MARKDOWN_TEMPLATE, { ...baseCtx, caption: "" }, {
			linkToImmich: false,
			embedStyle: "wikilink",
		});

		expect(result).toBe("![[Journal/Photos/2026-07-05-1.jpg]]");
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
