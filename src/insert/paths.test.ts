import { describe, expect, it } from "vitest";
import { buildFileName, buildFolderPath, buildVaultPath } from "./paths";

describe("buildFolderPath", () => {
	it("resolves the concept's default folder template", () => {
		expect(buildFolderPath("attachments/immich/{{year}}/", "2026-07-05")).toBe(
			"attachments/immich/2026",
		);
	});

	it("resolves year, month, day, and date placeholders", () => {
		expect(buildFolderPath("{{year}}/{{month}}/{{day}}/{{date}}", "2026-07-05")).toBe(
			"2026/07/05/2026-07-05",
		);
	});

	it("collapses duplicate slashes", () => {
		expect(buildFolderPath("attachments//immich///{{year}}", "2026-07-05")).toBe(
			"attachments/immich/2026",
		);
	});

	it("strips a leading slash", () => {
		expect(buildFolderPath("/attachments/{{year}}", "2026-07-05")).toBe("attachments/2026");
	});

	it("strips a trailing slash", () => {
		expect(buildFolderPath("attachments/{{year}}/", "2026-07-05")).toBe("attachments/2026");
	});

	it("returns an empty string for an empty template", () => {
		expect(buildFolderPath("", "2026-07-05")).toBe("");
	});
});

describe("buildFileName", () => {
	it("resolves the concept's default file name template", () => {
		expect(buildFileName("{{date}}_immich_{{assetIdShort}}", "2026-07-05", "a1b2c3d4-e5f6")).toBe(
			"2026-07-05_immich_a1b2c3d4.jpg",
		);
	});

	it("resolves the full assetId placeholder", () => {
		expect(buildFileName("{{assetId}}", "2026-07-05", "a1b2c3d4-e5f6")).toBe(
			"a1b2c3d4-e5f6.jpg",
		);
	});

	it("does not append an extension when one is already present", () => {
		expect(buildFileName("{{assetIdShort}}.png", "2026-07-05", "a1b2c3d4-e5f6")).toBe(
			"a1b2c3d4.png",
		);
	});

	it("appends .jpg when the rendered name has no extension", () => {
		expect(buildFileName("photo-{{assetIdShort}}", "2026-07-05", "a1b2c3d4-e5f6")).toBe(
			"photo-a1b2c3d4.jpg",
		);
	});
});

describe("buildVaultPath", () => {
	it("joins folder and file name with exactly one slash", () => {
		expect(buildVaultPath("attachments/immich/2026", "2026-07-05_immich_a1b2c3d4.jpg")).toBe(
			"attachments/immich/2026/2026-07-05_immich_a1b2c3d4.jpg",
		);
	});

	it("handles an empty folder", () => {
		expect(buildVaultPath("", "2026-07-05_immich_a1b2c3d4.jpg")).toBe(
			"2026-07-05_immich_a1b2c3d4.jpg",
		);
	});

	it("does not produce duplicate slashes when the folder has a trailing slash", () => {
		expect(buildVaultPath("attachments/immich/", "file.jpg")).toBe(
			"attachments/immich/file.jpg",
		);
	});
});

describe("integration with the concept's default templates", () => {
	it("builds the full example vault path end to end", () => {
		const date = "2026-07-05";
		const assetId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

		const folder = buildFolderPath("attachments/immich/{{year}}/", date);
		const fileName = buildFileName("{{date}}_immich_{{assetIdShort}}", date, assetId);
		const path = buildVaultPath(folder, fileName);

		expect(path).toBe("attachments/immich/2026/2026-07-05_immich_a1b2c3d4.jpg");
	});
});
