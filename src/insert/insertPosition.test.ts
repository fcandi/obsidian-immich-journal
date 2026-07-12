import { describe, expect, it } from "vitest";
import { frontmatterEndOffset, insertAtPosition } from "./insertPosition";

describe("frontmatterEndOffset", () => {
	it("returns 0 for content without frontmatter", () => {
		expect(frontmatterEndOffset("# Heading\ntext")).toBe(0);
	});

	it("returns 0 for empty content", () => {
		expect(frontmatterEndOffset("")).toBe(0);
	});

	it("returns the offset after a closed frontmatter block", () => {
		const content = "---\ndate: 2026-07-12\n---\n# Heading";
		const offset = frontmatterEndOffset(content);

		expect(content.slice(offset)).toBe("# Heading");
	});

	it("accepts ... as the closing delimiter", () => {
		const content = "---\ndate: 2026-07-12\n...\nbody";
		const offset = frontmatterEndOffset(content);

		expect(content.slice(offset)).toBe("body");
	});

	it("handles a closing delimiter without a trailing newline", () => {
		const content = "---\ndate: 2026-07-12\n---";

		expect(frontmatterEndOffset(content)).toBe(content.length);
	});

	it("returns 0 for an unclosed frontmatter opener", () => {
		expect(frontmatterEndOffset("---\ndate: 2026-07-12\ntext")).toBe(0);
	});

	it("returns 0 when --- appears only mid-document (horizontal rule)", () => {
		expect(frontmatterEndOffset("text\n---\nmore")).toBe(0);
	});
});

describe("insertAtPosition", () => {
	it("top: prepends to content without frontmatter, separated by a blank line", () => {
		expect(insertAtPosition("# Day\ntext", "BLOCK", "top")).toBe(
			"BLOCK\n\n# Day\ntext"
		);
	});

	it("top: inserts after the frontmatter block", () => {
		const content = "---\ndate: 2026-07-12\n---\n# Day\ntext";

		expect(insertAtPosition(content, "BLOCK", "top")).toBe(
			"---\ndate: 2026-07-12\n---\nBLOCK\n\n# Day\ntext"
		);
	});

	it("top: handles empty content", () => {
		expect(insertAtPosition("", "BLOCK", "top")).toBe("BLOCK\n");
	});

	it("top: handles a note that is frontmatter only", () => {
		expect(insertAtPosition("---\na: 1\n---\n", "BLOCK", "top")).toBe(
			"---\na: 1\n---\nBLOCK\n"
		);
	});

	it("bottom: appends with a blank line to content without trailing newline", () => {
		expect(insertAtPosition("text", "BLOCK", "bottom")).toBe(
			"text\n\nBLOCK\n"
		);
	});

	it("bottom: appends after a trailing newline without doubling it", () => {
		expect(insertAtPosition("text\n", "BLOCK", "bottom")).toBe(
			"text\n\nBLOCK\n"
		);
	});

	it("bottom: handles empty content", () => {
		expect(insertAtPosition("", "BLOCK", "bottom")).toBe("BLOCK\n");
	});
});
