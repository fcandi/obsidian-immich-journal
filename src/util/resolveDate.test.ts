import { describe, expect, it } from "vitest";
import {
	parseFrontmatterDate,
	parseTitleDate,
	resolveNoteDate,
	type MomentFn,
} from "./resolveDate";

/**
 * Minimal hand-written stand-in for `moment` used only in tests, so this
 * package does not need to depend on the real `moment` library.
 *
 * - Strict mode only accepts `YYYY-MM-DD` and requires an exact match.
 * - Lenient mode accepts `YYYY-MM-DD`, full ISO 8601 timestamps, or any
 *   string starting with `YYYY-MM-DD`.
 */
const fakeMoment: MomentFn = (input: string, format?: string, strict?: boolean) => {
	const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})/;

	if (strict) {
		if (format !== "YYYY-MM-DD") {
			return { isValid: () => false, format: () => "" };
		}
		const exactMatch = /^\d{4}-\d{2}-\d{2}$/.test(input);
		const match = exactMatch ? isoDatePattern.exec(input) : null;
		if (!match) {
			return { isValid: () => false, format: () => "" };
		}
		const isoDate = match[0];
		return { isValid: () => true, format: () => isoDate };
	}

	const match = isoDatePattern.exec(input);
	if (!match) {
		return { isValid: () => false, format: () => "" };
	}
	const isoDate = match[0];
	return { isValid: () => true, format: () => isoDate };
};

describe("parseTitleDate", () => {
	it("parses a strictly matching basename", () => {
		expect(parseTitleDate("2026-07-05", "YYYY-MM-DD", fakeMoment)).toBe("2026-07-05");
	});

	it("returns null for a non-matching basename", () => {
		expect(parseTitleDate("not-a-date", "YYYY-MM-DD", fakeMoment)).toBeNull();
	});

	it("returns null for a partial/loose match under strict mode", () => {
		expect(parseTitleDate("2026-07-05 Notes", "YYYY-MM-DD", fakeMoment)).toBeNull();
	});

	it("returns null for an empty basename", () => {
		expect(parseTitleDate("", "YYYY-MM-DD", fakeMoment)).toBeNull();
	});

	it("returns null for an empty format", () => {
		expect(parseTitleDate("2026-07-05", "", fakeMoment)).toBeNull();
	});
});

describe("parseFrontmatterDate", () => {
	it("parses a plain date string field", () => {
		expect(
			parseFrontmatterDate({ date: "2026-07-05" }, "date", fakeMoment)
		).toBe("2026-07-05");
	});

	it("parses a full ISO timestamp string leniently", () => {
		expect(
			parseFrontmatterDate(
				{ date: "2026-07-05T10:30:00.000Z" },
				"date",
				fakeMoment
			)
		).toBe("2026-07-05");
	});

	it("parses a Date-like value", () => {
		const date = new Date(Date.UTC(2026, 6, 5));
		expect(parseFrontmatterDate({ date }, "date", fakeMoment)).toBe("2026-07-05");
	});

	it("returns null when frontmatter is undefined", () => {
		expect(parseFrontmatterDate(undefined, "date", fakeMoment)).toBeNull();
	});

	it("returns null when field name is empty", () => {
		expect(parseFrontmatterDate({ date: "2026-07-05" }, "", fakeMoment)).toBeNull();
	});

	it("returns null when field is missing", () => {
		expect(parseFrontmatterDate({}, "date", fakeMoment)).toBeNull();
	});

	it("returns null when field value is an empty string", () => {
		expect(parseFrontmatterDate({ date: "" }, "date", fakeMoment)).toBeNull();
	});

	it("returns null when field value fails to parse", () => {
		expect(
			parseFrontmatterDate({ date: "not-a-date" }, "date", fakeMoment)
		).toBeNull();
	});
});

describe("resolveNoteDate", () => {
	it("prefers the title date when both title and frontmatter resolve", () => {
		const result = resolveNoteDate(
			{
				basename: "2026-07-05",
				frontmatter: { date: "2026-01-01" },
				titleFormat: "YYYY-MM-DD",
				frontmatterField: "date",
			},
			fakeMoment
		);
		expect(result).toEqual({ date: "2026-07-05", source: "title" });
	});

	it("falls back to frontmatter when the title does not match", () => {
		const result = resolveNoteDate(
			{
				basename: "Untitled",
				frontmatter: { date: "2026-01-01" },
				titleFormat: "YYYY-MM-DD",
				frontmatterField: "date",
			},
			fakeMoment
		);
		expect(result).toEqual({ date: "2026-01-01", source: "frontmatter" });
	});

	it("returns none when neither title nor frontmatter resolve", () => {
		const result = resolveNoteDate(
			{
				basename: "Untitled",
				frontmatter: { date: "not-a-date" },
				titleFormat: "YYYY-MM-DD",
				frontmatterField: "date",
			},
			fakeMoment
		);
		expect(result).toEqual({ date: null, source: "none" });
	});

	it("returns none when frontmatter is absent and title does not match", () => {
		const result = resolveNoteDate(
			{
				basename: "Untitled",
				titleFormat: "YYYY-MM-DD",
				frontmatterField: "date",
			},
			fakeMoment
		);
		expect(result).toEqual({ date: null, source: "none" });
	});
});
