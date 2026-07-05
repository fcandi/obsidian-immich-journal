import { moment } from "obsidian";
import { renderTemplate } from "../util/template";
import * as de from "./de.json";
import * as en from "./en.json";

/** Supported plugin locales. */
export type Locale = "en" | "de";

/** Locale setting value, including the "auto" option that detects Obsidian's UI language. */
export type LocaleSetting = "auto" | Locale;

/** Flat string-to-string translation table. */
export type Dictionary = Record<string, string>;

/** Translation tables keyed by locale. */
export type Dictionaries = Record<Locale, Dictionary>;

const dictionaries: Dictionaries = { en, de };

let currentLocale: Locale = "en";

/**
 * Resolves a locale setting to a concrete locale.
 *
 * An explicit `"en"` or `"de"` override always wins. For `"auto"`, this tries to read
 * Obsidian's UI language defensively (localStorage, then moment's global locale), mapping
 * anything starting with "de" to German and everything else to English. All environment
 * access is wrapped in try/catch so this never throws, e.g. in the node test environment.
 */
export function resolveLocale(override: LocaleSetting): Locale {
	if (override === "en" || override === "de") {
		return override;
	}

	let detected = "en";

	try {
		const stored = window?.localStorage?.getItem("language");
		if (stored) {
			detected = stored;
		} else {
			detected = moment.locale();
		}
	} catch {
		try {
			detected = moment.locale();
		} catch {
			detected = "en";
		}
	}

	return detected.toLowerCase().startsWith("de") ? "de" : "en";
}

/** Initializes the i18n module with a resolved locale. */
export function initI18n(locale: Locale): void {
	currentLocale = locale;
}

/** Updates the current locale. */
export function setLocale(locale: Locale): void {
	currentLocale = locale;
}

/** Returns the currently active locale. */
export function getLocale(): Locale {
	return currentLocale;
}

/**
 * Looks up `key` in `tables[locale]`, falling back to `tables.en`, and finally to the key
 * itself if no translation exists anywhere. Interpolates `{{var}}` placeholders via
 * `renderTemplate` when `vars` is provided.
 */
export function translate(
	tables: Dictionaries,
	locale: Locale,
	key: string,
	vars?: Record<string, string>
): string {
	const template = tables[locale]?.[key] ?? tables.en?.[key] ?? key;
	return vars ? renderTemplate(template, vars) : template;
}

/** Translates `key` for the current locale, interpolating optional `{{var}}` placeholders. */
export function t(key: string, vars?: Record<string, string>): string {
	return translate(dictionaries, currentLocale, key, vars);
}
