import { describe, it, expect } from "vitest";
import { buildImmichUrl } from "./deepLink";

describe("buildImmichUrl", () => {
	it("should build URL with no trailing slash", () => {
		const result = buildImmichUrl("https://immich.example.com", "asset-123");
		expect(result).toBe("https://immich.example.com/photos/asset-123");
	});

	it("should build URL with one trailing slash", () => {
		const result = buildImmichUrl("https://immich.example.com/", "asset-456");
		expect(result).toBe("https://immich.example.com/photos/asset-456");
	});

	it("should build URL with several trailing slashes", () => {
		const result = buildImmichUrl("https://immich.example.com///", "asset-789");
		expect(result).toBe("https://immich.example.com/photos/asset-789");
	});

	it("should handle complex asset IDs", () => {
		const result = buildImmichUrl("https://immich.tailnet-example.ts.net:8443", "uuid-abc-def");
		expect(result).toBe("https://immich.tailnet-example.ts.net:8443/photos/uuid-abc-def");
	});

	it("should handle complex asset IDs with trailing slash", () => {
		const result = buildImmichUrl("https://immich.tailnet-example.ts.net:8443/", "uuid-abc-def");
		expect(result).toBe("https://immich.tailnet-example.ts.net:8443/photos/uuid-abc-def");
	});
});
