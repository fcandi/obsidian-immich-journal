/**
 * Vitest-only stub for the "obsidian" package. The real package ships type
 * definitions without a runtime entry point, so source files that value-import
 * from "obsidian" cannot be loaded in unit tests. vitest.config.ts aliases
 * "obsidian" to this file; tsc keeps using the real type definitions.
 *
 * Only add exports here when a unit-tested module actually imports them.
 */

export function requestUrl(): never {
	throw new Error(
		"obsidian.requestUrl is not available in unit tests — inject a mock request function instead"
	);
}
