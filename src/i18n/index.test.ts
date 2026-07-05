import { describe, expect, it } from "vitest";
import { translate, type Dictionaries } from "./index";
import * as en from "./en.json";
import * as de from "./de.json";
import * as es from "./es.json";
import * as fr from "./fr.json";
import * as ja from "./ja.json";
import * as zh from "./zh.json";

const tables: Dictionaries = {
	en: {
		"modal.empty": "No photos found for this day.",
		"greeting.hello": "Hello, {{name}}!",
	},
	de: {
		"modal.empty": "Keine Fotos für diesen Tag gefunden.",
	},
	es: {},
	fr: {},
	ja: {},
	zh: {},
};

describe("translate", () => {
	it("falls back to English when the key is missing in the current locale", () => {
		const result = translate(tables, "de", "greeting.hello", { name: "Andi" });

		expect(result).toBe("Hello, Andi!");
	});

	it("falls back to the key itself when missing everywhere", () => {
		const result = translate(tables, "en", "does.not.exist");

		expect(result).toBe("does.not.exist");
	});

	it("interpolates {{var}} placeholders", () => {
		const result = translate(tables, "en", "greeting.hello", { name: "World" });

		expect(result).toBe("Hello, World!");
	});

	it("looks up German translations when present", () => {
		const result = translate(tables, "de", "modal.empty");

		expect(result).toBe("Keine Fotos für diesen Tag gefunden.");
	});
});

describe("locale files", () => {
	// A JSON namespace import carries a synthetic `default` entry next to the
	// actual keys; unwrap it so the tests only see the translation strings.
	const unwrap = (module: Record<string, unknown>): Record<string, string> =>
		(module.default ?? module) as Record<string, string>;
	const locales = {
		en: unwrap(en),
		de: unwrap(de),
		es: unwrap(es),
		fr: unwrap(fr),
		ja: unwrap(ja),
		zh: unwrap(zh),
	} as const;
	const keyDump = (dict: Record<string, unknown>) =>
		Object.keys(dict).sort().join("\n");
	const enKeys = keyDump(locales.en);

	it.each(Object.keys(locales) as (keyof typeof locales)[])(
		"%s has exactly the same key set as en",
		(locale) => {
			expect(keyDump(locales[locale])).toBe(enKeys);
		}
	);

	it.each(Object.keys(locales) as (keyof typeof locales)[])(
		"%s preserves every {{placeholder}} used by en",
		(locale) => {
			const dict = locales[locale];
			for (const [key, value] of Object.entries(locales.en)) {
				const placeholders = value.match(/\{\{\w+\}\}/g) ?? [];
				for (const placeholder of placeholders) {
					expect(
						dict[key],
						`${locale}:${key} is missing ${placeholder}`
					).toContain(placeholder);
				}
			}
		}
	);
});
