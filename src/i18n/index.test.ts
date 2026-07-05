import { describe, expect, it } from "vitest";
import { translate, type Dictionaries } from "./index";

const tables: Dictionaries = {
	en: {
		"modal.empty": "No photos found for this day.",
		"greeting.hello": "Hello, {{name}}!",
	},
	de: {
		"modal.empty": "Keine Fotos für diesen Tag gefunden.",
	},
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
