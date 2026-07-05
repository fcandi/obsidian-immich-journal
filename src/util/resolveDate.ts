/**
 * Resolves the calendar date a daily note represents, either from its
 * filename (title) or from a frontmatter field.
 *
 * Obsidian bundles `moment`, but this module accepts it as an injected
 * dependency so it stays testable without adding `moment` as a direct
 * dependency of this package.
 */

/** Minimal shape of the subset of `moment` this module relies on. */
export interface MomentLike {
	isValid(): boolean;
	format(format: string): string;
}

/** Callable signature matching the parts of `moment(...)` used here. */
export type MomentFn = (input: string, format?: string, strict?: boolean) => MomentLike;

const ISO_DATE_FORMAT = "YYYY-MM-DD";

/** Source a resolved date came from. */
export type DateSource = "title" | "frontmatter" | "none";

export interface ResolveNoteDateInput {
	basename: string;
	frontmatter?: Record<string, unknown>;
	titleFormat: string;
	frontmatterField: string;
}

export interface ResolveNoteDateResult {
	date: string | null;
	source: DateSource;
}

/**
 * Strictly parses a note's basename against the configured title format.
 * Returns an ISO `YYYY-MM-DD` string, or null if it does not match.
 */
export function parseTitleDate(
	basename: string,
	format: string,
	momentFn: MomentFn
): string | null {
	if (!basename || !format) {
		return null;
	}

	const parsed = momentFn(basename, format, true);
	if (!parsed.isValid()) {
		return null;
	}

	return parsed.format(ISO_DATE_FORMAT);
}

/**
 * Leniently parses a date value from a frontmatter field. The value may be
 * a string or a Date-like object with a `toISOString`/`toString` method.
 * Returns an ISO `YYYY-MM-DD` string, or null if unavailable/invalid.
 */
export function parseFrontmatterDate(
	frontmatter: Record<string, unknown> | undefined,
	field: string,
	momentFn: MomentFn
): string | null {
	if (!field || !frontmatter) {
		return null;
	}

	const rawValue = frontmatter[field];
	if (rawValue === undefined || rawValue === null) {
		return null;
	}

	let value: string;
	if (rawValue instanceof Date) {
		value = rawValue.toISOString();
	} else if (typeof rawValue === "string") {
		value = rawValue;
	} else {
		value = String(rawValue);
	}

	if (!value.trim()) {
		return null;
	}

	const parsed = momentFn(value);
	if (!parsed.isValid()) {
		return null;
	}

	return parsed.format(ISO_DATE_FORMAT);
}

/**
 * Resolves the date represented by a note, preferring the filename/title
 * parse and falling back to a frontmatter field.
 */
export function resolveNoteDate(
	input: ResolveNoteDateInput,
	momentFn: MomentFn
): ResolveNoteDateResult {
	const titleDate = parseTitleDate(input.basename, input.titleFormat, momentFn);
	if (titleDate) {
		return { date: titleDate, source: "title" };
	}

	const frontmatterDate = parseFrontmatterDate(
		input.frontmatter,
		input.frontmatterField,
		momentFn
	);
	if (frontmatterDate) {
		return { date: frontmatterDate, source: "frontmatter" };
	}

	return { date: null, source: "none" };
}
