import { describe, expect, it } from "vitest";
import { migrateEmbedSettings, type LegacyEmbedFields } from "./migrate";
import type { PluginSettings } from "../types";

type Loaded = Partial<PluginSettings> & LegacyEmbedFields;

const LEGACY_DEFAULT_TEMPLATE =
	"[![{{altText}}]({{localPath}})]({{immichUrl}})\n*{{caption}}*";

describe("migrateEmbedSettings", () => {
	it("leaves a fresh install (no legacy keys) untouched", () => {
		const loaded: Loaded = {};

		migrateEmbedSettings(loaded);

		expect(loaded).toEqual({});
	});

	it("leaves already-migrated data untouched but strips legacy keys", () => {
		const loaded: Loaded = {
			embedPreset: "wikilink",
			embedStyle: "markdown",
			linkToImmich: true,
		};

		migrateEmbedSettings(loaded);

		expect(loaded.embedPreset).toBe("wikilink");
		expect(loaded).not.toHaveProperty("embedStyle");
		expect(loaded).not.toHaveProperty("linkToImmich");
	});

	it("maps untouched markdown + link on to the markdownLink preset", () => {
		const loaded: Loaded = {
			embedStyle: "markdown",
			linkToImmich: true,
			captionTemplate: "{{description}}",
			markdownTemplate: LEGACY_DEFAULT_TEMPLATE,
		};

		migrateEmbedSettings(loaded);

		expect(loaded.embedPreset).toBe("markdownLink");
		// The new default template applies via the defaults merge.
		expect(loaded).not.toHaveProperty("markdownTemplate");
		expect(loaded).not.toHaveProperty("captionTemplate");
	});

	it("maps untouched markdown + link off to the markdownPlain preset", () => {
		const loaded: Loaded = {
			embedStyle: "markdown",
			linkToImmich: false,
			captionTemplate: "{{description}}",
			markdownTemplate: LEGACY_DEFAULT_TEMPLATE,
		};

		migrateEmbedSettings(loaded);

		expect(loaded.embedPreset).toBe("markdownPlain");
	});

	it("maps untouched wikilink style to the wikilink preset", () => {
		const loaded: Loaded = {
			embedStyle: "wikilink",
			linkToImmich: true,
			captionTemplate: "{{description}}",
			markdownTemplate: LEGACY_DEFAULT_TEMPLATE,
		};

		migrateEmbedSettings(loaded);

		expect(loaded.embedPreset).toBe("wikilink");
	});

	it("moves a customized caption template to the custom preset, inlined", () => {
		const loaded: Loaded = {
			embedStyle: "markdown",
			linkToImmich: true,
			captionTemplate: "{{time}} – {{city}}",
			markdownTemplate: LEGACY_DEFAULT_TEMPLATE,
		};

		migrateEmbedSettings(loaded);

		expect(loaded.embedPreset).toBe("custom");
		expect(loaded.markdownTemplate).toBe(
			"[![{{altText}}]({{localPath}})]({{immichUrl}})\n*{{time}} – {{city}}*"
		);
	});

	it("strips the outer link for custom templates when the toggle was off", () => {
		const loaded: Loaded = {
			embedStyle: "markdown",
			linkToImmich: false,
			captionTemplate: "{{time}}",
			markdownTemplate: LEGACY_DEFAULT_TEMPLATE,
		};

		migrateEmbedSettings(loaded);

		expect(loaded.embedPreset).toBe("custom");
		expect(loaded.markdownTemplate).toBe(
			"![{{altText}}]({{localPath}})\n*{{time}}*"
		);
	});

	it("reproduces the wikilink form for wikilink users with a custom caption", () => {
		const loaded: Loaded = {
			embedStyle: "wikilink",
			linkToImmich: true,
			captionTemplate: "{{people}}",
			markdownTemplate: LEGACY_DEFAULT_TEMPLATE,
		};

		migrateEmbedSettings(loaded);

		expect(loaded.embedPreset).toBe("custom");
		expect(loaded.markdownTemplate).toBe("![[{{localPathRaw}}]]\n*{{people}}*");
	});

	it("keeps a customized markdown template as-is (caption inlined)", () => {
		const loaded: Loaded = {
			embedStyle: "markdown",
			linkToImmich: true,
			captionTemplate: "{{description}}",
			markdownTemplate: "![{{altText}}]({{localPath}})\n> {{caption}}",
		};

		migrateEmbedSettings(loaded);

		expect(loaded.embedPreset).toBe("custom");
		expect(loaded.markdownTemplate).toBe(
			"![{{altText}}]({{localPath}})\n> {{description}}"
		);
	});

	it("treats partially persisted legacy data with defaults", () => {
		// Only the toggle was ever changed; other legacy fields absent.
		const loaded: Loaded = { linkToImmich: false };

		migrateEmbedSettings(loaded);

		expect(loaded.embedPreset).toBe("markdownPlain");
	});
});
