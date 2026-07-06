import { describe, expect, it, vi } from "vitest";
import type { RequestUrlResponse } from "obsidian";
import type { ImmichAsset, SearchMetadataBody } from "../types";
import { ImmichClient, ImmichError, RequestFn } from "./immichClient";

/** Exposes the protected request core for testing. */
class TestClient extends ImmichClient {
	requestPublic<T = unknown>(
		path: string,
		options?: { method?: string; body?: string; contentType?: string }
	): Promise<T> {
		return this.request<T>(path, options);
	}

	requestBinaryPublic(path: string): Promise<ArrayBuffer> {
		return this.requestBinary(path);
	}
}

const CONFIG = { serverUrl: "https://immich.example", apiKey: "test-key" };

function makeResponse(
	overrides: Partial<RequestUrlResponse> = {}
): RequestUrlResponse {
	return {
		status: 200,
		headers: {},
		arrayBuffer: new ArrayBuffer(0),
		json: null,
		text: "",
		...overrides,
	};
}

function makeClient(
	requestFn: RequestFn,
	config = CONFIG,
	timeoutMs?: number
): TestClient {
	return new TestClient(() => config, requestFn, timeoutMs);
}

describe("ImmichClient request core", () => {
	it("returns parsed JSON on success and sends the API key header", async () => {
		const requestFn = vi
			.fn<Parameters<RequestFn>, ReturnType<RequestFn>>()
			.mockResolvedValue(makeResponse({ json: { assets: [1, 2] } }));
		const client = makeClient(requestFn);

		const result = await client.requestPublic<{ assets: number[] }>(
			"/api/search/metadata",
			{ method: "POST", body: "{}", contentType: "application/json" }
		);

		expect(result).toEqual({ assets: [1, 2] });
		expect(requestFn).toHaveBeenCalledTimes(1);
		const params = requestFn.mock.calls[0][0];
		expect(params.url).toBe("https://immich.example/api/search/metadata");
		expect(params.method).toBe("POST");
		expect(params.body).toBe("{}");
		expect(params.contentType).toBe("application/json");
		expect(params.headers).toEqual({ "x-api-key": "test-key" });
		expect(params.throw).toBe(false);
	});

	it("returns an ArrayBuffer from requestBinary", async () => {
		const bytes = new ArrayBuffer(8);
		const requestFn = vi
			.fn<Parameters<RequestFn>, ReturnType<RequestFn>>()
			.mockResolvedValue(makeResponse({ arrayBuffer: bytes }));
		const client = makeClient(requestFn);

		await expect(
			client.requestBinaryPublic("/api/assets/abc/thumbnail")
		).resolves.toBe(bytes);
	});

	it("normalizes trailing slashes in the server URL", async () => {
		const requestFn = vi
			.fn<Parameters<RequestFn>, ReturnType<RequestFn>>()
			.mockResolvedValue(makeResponse({ json: {} }));
		const client = makeClient(requestFn, {
			serverUrl: "https://immich.example//",
			apiKey: "k",
		});

		await client.requestPublic("/api/server/about");

		expect(requestFn.mock.calls[0][0].url).toBe(
			"https://immich.example/api/server/about"
		);
	});

	it("reads the config getter on every request", async () => {
		const requestFn = vi
			.fn<Parameters<RequestFn>, ReturnType<RequestFn>>()
			.mockResolvedValue(makeResponse({ json: {} }));
		let config = { serverUrl: "https://one.example", apiKey: "key-1" };
		const client = new TestClient(() => config, requestFn);

		await client.requestPublic("/a");
		config = { serverUrl: "https://two.example", apiKey: "key-2" };
		await client.requestPublic("/a");

		expect(requestFn.mock.calls[1][0].url).toBe("https://two.example/a");
		expect(requestFn.mock.calls[1][0].headers).toEqual({
			"x-api-key": "key-2",
		});
	});

	it.each([
		[401, "unauthorized"],
		[403, "forbidden"],
		[500, "server"],
		[503, "server"],
		[404, "other"],
	] as const)("maps HTTP %i to category '%s'", async (status, category) => {
		const requestFn = vi
			.fn<Parameters<RequestFn>, ReturnType<RequestFn>>()
			.mockResolvedValue(makeResponse({ status }));
		const client = makeClient(requestFn);

		const error: ImmichError = await client
			.requestPublic<never>("/api/x")
			.catch((e) => e as ImmichError);

		expect(error).toBeInstanceOf(ImmichError);
		expect(error.category).toBe(category);
		expect(error.status).toBe(status);
	});

	it("maps a thrown connection error to category 'network'", async () => {
		const requestFn = vi
			.fn<Parameters<RequestFn>, ReturnType<RequestFn>>()
			.mockRejectedValue(new Error("ECONNREFUSED"));
		const client = makeClient(requestFn);

		const error: ImmichError = await client
			.requestPublic<never>("/api/x")
			.catch((e) => e as ImmichError);

		expect(error).toBeInstanceOf(ImmichError);
		expect(error.category).toBe("network");
		expect(error.status).toBeUndefined();
		expect(error.message).toContain("ECONNREFUSED");
	});

	it("rejects with a 'network' error when the request times out", async () => {
		// Never-resolving request plus a tiny injected timeout.
		const requestFn: RequestFn = () => new Promise(() => {});
		const client = makeClient(requestFn, CONFIG, 10);

		const error: ImmichError = await client
			.requestPublic<never>("/api/x")
			.catch((e) => e as ImmichError);

		expect(error).toBeInstanceOf(ImmichError);
		expect(error.category).toBe("network");
		expect(error.message).toContain("timed out");
	});

	it("ignores a late rejection of the abandoned request after timeout", async () => {
		let rejectLate: (e: Error) => void = () => {};
		const requestFn: RequestFn = () =>
			new Promise((_, reject) => {
				rejectLate = reject;
			});
		const client = makeClient(requestFn, CONFIG, 10);

		await expect(client.requestPublic("/api/x")).rejects.toMatchObject({
			category: "network",
		});
		// The loser of the race rejects afterwards; this must not surface anywhere.
		rejectLate(new Error("late failure"));
		await new Promise((resolve) => window.setTimeout(resolve, 0));
	});
});

function makeAsset(id: string, localDateTime: string): ImmichAsset {
	return {
		id,
		localDateTime,
		type: "IMAGE",
		originalFileName: `${id}.jpg`,
	};
}

function searchPage(
	items: ImmichAsset[],
	nextPage: string | number | null
): RequestUrlResponse {
	return makeResponse({ json: { assets: { items, nextPage } } });
}

describe("ImmichClient.searchDayAssets", () => {
	const DAY = "2026-07-05";

	it("sends the fixed search body and returns single-page results", async () => {
		const assets = [
			makeAsset("a1", "2026-07-05T09:00:00.000"),
			makeAsset("a2", "2026-07-05T10:00:00.000"),
		];
		const requestFn = vi
			.fn<Parameters<RequestFn>, ReturnType<RequestFn>>()
			.mockResolvedValue(searchPage(assets, null));
		const client = makeClient(requestFn);

		const result = await client.searchDayAssets(DAY);

		expect(result.map((a) => a.id)).toEqual(["a1", "a2"]);
		expect(requestFn).toHaveBeenCalledTimes(1);
		const params = requestFn.mock.calls[0][0];
		expect(params.url).toBe("https://immich.example/api/search/metadata");
		expect(params.method).toBe("POST");
		expect(params.contentType).toBe("application/json");
		const body = JSON.parse(params.body as string) as SearchMetadataBody;
		expect(body).toMatchObject({
			type: "IMAGE",
			withExif: true,
			size: 200,
			page: 1,
		});
		// Generous UTC window: one day before to two days after the local day.
		expect(body.takenAfter).toBe("2026-07-04T00:00:00.000Z");
		expect(body.takenBefore).toBe("2026-07-07T00:00:00.000Z");
	});

	it("accumulates pages and stops when nextPage is null", async () => {
		const requestFn = vi
			.fn<Parameters<RequestFn>, ReturnType<RequestFn>>()
			.mockResolvedValueOnce(
				searchPage([makeAsset("p1", "2026-07-05T08:00:00.000")], "2")
			)
			.mockResolvedValueOnce(
				searchPage([makeAsset("p2", "2026-07-05T09:00:00.000")], 3)
			)
			.mockResolvedValueOnce(
				searchPage([makeAsset("p3", "2026-07-05T10:00:00.000")], null)
			);
		const client = makeClient(requestFn);

		const result = await client.searchDayAssets(DAY);

		expect(result.map((a) => a.id)).toEqual(["p1", "p2", "p3"]);
		expect(requestFn).toHaveBeenCalledTimes(3);
		const pages = requestFn.mock.calls.map(
			(call) => (JSON.parse(call[0].body as string) as SearchMetadataBody).page
		);
		expect(pages).toEqual([1, 2, 3]);
	});

	it("stops when a page returns no items even if nextPage is set", async () => {
		const requestFn = vi
			.fn<Parameters<RequestFn>, ReturnType<RequestFn>>()
			.mockResolvedValueOnce(
				searchPage([makeAsset("q1", "2026-07-05T08:00:00.000")], "2")
			)
			.mockResolvedValueOnce(searchPage([], "3"));
		const client = makeClient(requestFn);

		const result = await client.searchDayAssets(DAY);

		expect(result.map((a) => a.id)).toEqual(["q1"]);
		expect(requestFn).toHaveBeenCalledTimes(2);
	});

	it("filters out assets from neighboring days and sorts ascending", async () => {
		const requestFn = vi
			.fn<Parameters<RequestFn>, ReturnType<RequestFn>>()
			.mockResolvedValue(
				searchPage(
					[
						makeAsset("late", "2026-07-05T21:00:00.000"),
						makeAsset("prev-day", "2026-07-04T23:30:00.000"),
						makeAsset("early", "2026-07-05T06:15:00.000"),
						makeAsset("next-day", "2026-07-06T00:10:00.000"),
					],
					null
				)
			);
		const client = makeClient(requestFn);

		const result = await client.searchDayAssets(DAY);

		expect(result.map((a) => a.id)).toEqual(["early", "late"]);
	});

	it("stops at the hard cap of 25 pages when the server never ends pagination", async () => {
		let counter = 0;
		const requestFn = vi
			.fn<Parameters<RequestFn>, ReturnType<RequestFn>>()
			.mockImplementation(() => {
				counter++;
				return Promise.resolve(
					searchPage(
						[makeAsset(`c${counter}`, "2026-07-05T12:00:00.000")],
						"always-more"
					)
				);
			});
		const client = makeClient(requestFn);

		const result = await client.searchDayAssets(DAY);

		expect(requestFn).toHaveBeenCalledTimes(25);
		expect(result).toHaveLength(25);
	});

	it("returns an empty array when the response has no assets object", async () => {
		const requestFn = vi
			.fn<Parameters<RequestFn>, ReturnType<RequestFn>>()
			.mockResolvedValue(makeResponse({ json: {} }));
		const client = makeClient(requestFn);

		await expect(client.searchDayAssets(DAY)).resolves.toEqual([]);
		expect(requestFn).toHaveBeenCalledTimes(1);
	});

	it("returns an empty array when a 2xx response carries a null JSON body", async () => {
		// requestUrl yields `json: null` for an empty or non-JSON body; this
		// must not crash with a TypeError on `response.assets`.
		const requestFn = vi
			.fn<Parameters<RequestFn>, ReturnType<RequestFn>>()
			.mockResolvedValue(makeResponse({ json: null }));
		const client = makeClient(requestFn);

		await expect(client.searchDayAssets(DAY)).resolves.toEqual([]);
		expect(requestFn).toHaveBeenCalledTimes(1);
	});
});

describe("ImmichClient.fetchThumbnail", () => {
	it("GETs the thumbnail endpoint with the given size and returns raw bytes", async () => {
		const bytes = new ArrayBuffer(16);
		const requestFn = vi
			.fn<Parameters<RequestFn>, ReturnType<RequestFn>>()
			.mockResolvedValue(makeResponse({ arrayBuffer: bytes }));
		const client = makeClient(requestFn);

		const result = await client.fetchThumbnail("abc123", "preview");

		expect(result).toBe(bytes);
		expect(requestFn).toHaveBeenCalledTimes(1);
		const params = requestFn.mock.calls[0][0];
		expect(params.url).toBe(
			"https://immich.example/api/assets/abc123/thumbnail?size=preview"
		);
		expect(params.method).toBe("GET");
	});
});

describe("ImmichClient.findLatestAssetDay", () => {
	it("requests the newest image and returns its local day", async () => {
		const asset = makeAsset("a1", "2026-07-04T22:46:00.000");
		const requestFn = vi
			.fn<Parameters<RequestFn>, ReturnType<RequestFn>>()
			.mockResolvedValue(searchPage([asset], null));
		const client = makeClient(requestFn);

		const result = await client.findLatestAssetDay();

		expect(result).toBe("2026-07-04");
		expect(requestFn).toHaveBeenCalledTimes(1);
		const body = JSON.parse(requestFn.mock.calls[0][0].body as string) as SearchMetadataBody;
		expect(body).toMatchObject({
			type: "IMAGE",
			order: "desc",
			size: 1,
			page: 1,
		});
		expect(body.takenAfter).toBeUndefined();
		expect(body.takenBefore).toBeUndefined();
	});

	it("returns null for an empty library", async () => {
		const requestFn = vi
			.fn<Parameters<RequestFn>, ReturnType<RequestFn>>()
			.mockResolvedValue(searchPage([], null));
		const client = makeClient(requestFn);

		await expect(client.findLatestAssetDay()).resolves.toBeNull();
	});

	it("returns null when a 2xx response carries a null JSON body", async () => {
		const requestFn = vi
			.fn<Parameters<RequestFn>, ReturnType<RequestFn>>()
			.mockResolvedValue(makeResponse({ json: null }));
		const client = makeClient(requestFn);

		await expect(client.findLatestAssetDay()).resolves.toBeNull();
	});
});

describe("ImmichClient.testConnection", () => {
	function pingResponse(): RequestUrlResponse {
		return makeResponse({ json: { res: "pong" } });
	}

	it("returns ok with scopeChecked when ping, search, and thumbnail all succeed", async () => {
		const asset = makeAsset("a1", "2026-07-05T09:00:00.000");
		const requestFn = vi
			.fn<Parameters<RequestFn>, ReturnType<RequestFn>>()
			.mockResolvedValueOnce(pingResponse())
			.mockResolvedValueOnce(searchPage([asset], null))
			.mockResolvedValueOnce(makeResponse({ arrayBuffer: new ArrayBuffer(4) }));
		const client = makeClient(requestFn);

		const result = await client.testConnection();

		expect(result).toEqual({ ok: true, scopeChecked: true });
		expect(requestFn).toHaveBeenCalledTimes(3);
		// Must be /ping, not /about: /about needs the extra server.about
		// permission and would 403 for a correctly minimal API key.
		expect(requestFn.mock.calls[0][0].url).toBe(
			"https://immich.example/api/server/ping"
		);
		expect(requestFn.mock.calls[2][0].url).toBe(
			"https://immich.example/api/assets/a1/thumbnail?size=thumbnail"
		);
	});

	it("returns network failure when the ping stage is unreachable, without calling search", async () => {
		const requestFn = vi
			.fn<Parameters<RequestFn>, ReturnType<RequestFn>>()
			.mockRejectedValueOnce(new Error("connection refused"));
		const client = makeClient(requestFn);

		const result = await client.testConnection();

		expect(result).toEqual({
			ok: false,
			category: "network",
			scopeChecked: false,
		});
		expect(requestFn).toHaveBeenCalledTimes(1);
	});

	it("returns unauthorized when the search 401s (wrong API key; ping is public and passes)", async () => {
		const requestFn = vi
			.fn<Parameters<RequestFn>, ReturnType<RequestFn>>()
			.mockResolvedValueOnce(pingResponse())
			.mockResolvedValueOnce(makeResponse({ status: 401 }));
		const client = makeClient(requestFn);

		const result = await client.testConnection();

		expect(result).toEqual({
			ok: false,
			category: "unauthorized",
			scopeChecked: true,
		});
		expect(requestFn).toHaveBeenCalledTimes(2);
	});

	it("returns forbidden with scopeChecked true when the thumbnail fetch 403s (portal-key case)", async () => {
		const asset = makeAsset("a1", "2026-07-05T09:00:00.000");
		const requestFn = vi
			.fn<Parameters<RequestFn>, ReturnType<RequestFn>>()
			.mockResolvedValueOnce(pingResponse())
			.mockResolvedValueOnce(searchPage([asset], null))
			.mockResolvedValueOnce(makeResponse({ status: 403 }));
		const client = makeClient(requestFn);

		const result = await client.testConnection();

		expect(result).toEqual({
			ok: false,
			category: "forbidden",
			scopeChecked: true,
		});
		expect(requestFn).toHaveBeenCalledTimes(3);
	});

	it("returns ok with scopeChecked false when the library is empty", async () => {
		const requestFn = vi
			.fn<Parameters<RequestFn>, ReturnType<RequestFn>>()
			.mockResolvedValueOnce(pingResponse())
			.mockResolvedValueOnce(searchPage([], null));
		const client = makeClient(requestFn);

		const result = await client.testConnection();

		expect(result).toEqual({ ok: true, scopeChecked: false });
		expect(requestFn).toHaveBeenCalledTimes(2);
	});

	it("treats a null-JSON search body as an empty library without crashing", async () => {
		const requestFn = vi
			.fn<Parameters<RequestFn>, ReturnType<RequestFn>>()
			.mockResolvedValueOnce(pingResponse())
			.mockResolvedValueOnce(makeResponse({ json: null }));
		const client = makeClient(requestFn);

		const result = await client.testConnection();

		expect(result).toEqual({ ok: true, scopeChecked: false });
		expect(requestFn).toHaveBeenCalledTimes(2);
	});
});
