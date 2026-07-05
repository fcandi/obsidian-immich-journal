import { describe, expect, it } from "vitest";
import { dayUtcWindow } from "./dateWindow";

describe("dayUtcWindow", () => {
	it("returns a window one day before and two days after a normal day", () => {
		const result = dayUtcWindow("2026-07-05");
		expect(result.takenAfter).toBe("2026-07-04T00:00:00.000Z");
		expect(result.takenBefore).toBe("2026-07-07T00:00:00.000Z");
	});

	it("handles a month boundary", () => {
		const result = dayUtcWindow("2026-07-31");
		expect(result.takenAfter).toBe("2026-07-30T00:00:00.000Z");
		expect(result.takenBefore).toBe("2026-08-02T00:00:00.000Z");
	});

	it("handles a year boundary", () => {
		const result = dayUtcWindow("2025-12-31");
		expect(result.takenAfter).toBe("2025-12-30T00:00:00.000Z");
		expect(result.takenBefore).toBe("2026-01-02T00:00:00.000Z");
	});

	it("handles a leap day", () => {
		const result = dayUtcWindow("2024-02-29");
		expect(result.takenAfter).toBe("2024-02-28T00:00:00.000Z");
		expect(result.takenBefore).toBe("2024-03-02T00:00:00.000Z");
	});

	it("produces valid ISO strings ending in Z", () => {
		const result = dayUtcWindow("2026-07-05");
		expect(result.takenAfter).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
		expect(result.takenBefore).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
		expect(() => new Date(result.takenAfter)).not.toThrow();
		expect(new Date(result.takenAfter).toISOString()).toBe(result.takenAfter);
		expect(new Date(result.takenBefore).toISOString()).toBe(result.takenBefore);
	});
});
