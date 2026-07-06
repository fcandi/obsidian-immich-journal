import { requestUrl, RequestUrlParam, RequestUrlResponse } from "obsidian";
import type { ImmichAsset, SearchMetadataBody } from "../types";
import { dayUtcWindow } from "../util/dateWindow";
import { filterByLocalDay } from "../util/dayFilter";

/** Error categories the rest of the plugin can branch on (e.g. for i18n messages). */
export type ImmichErrorCategory =
	| "network"
	| "unauthorized"
	| "forbidden"
	| "server"
	| "other";

/** Typed error thrown by all ImmichClient methods. */
export class ImmichError extends Error {
	readonly category: ImmichErrorCategory;
	readonly status?: number;

	constructor(category: ImmichErrorCategory, message: string, status?: number) {
		super(message);
		this.name = "ImmichError";
		this.category = category;
		this.status = status;
	}
}

/** Runtime connection settings; read on every request so settings changes apply immediately. */
export interface ImmichClientConfig {
	serverUrl: string;
	apiKey: string;
}

/**
 * Shape of the HTTP function used by the client. Matches Obsidian's `requestUrl`
 * closely enough that it can be passed directly, while unit tests inject a mock.
 */
export type RequestFn = (
	params: RequestUrlParam
) => Promise<RequestUrlResponse>;

/** Default request timeout in milliseconds (see concept §10: no UI freeze without VPN). */
export const DEFAULT_TIMEOUT_MS = 8000;

/** Page size for `/api/search/metadata` requests. */
const SEARCH_PAGE_SIZE = 200;

/** Result of {@link ImmichClient.testConnection}. */
export interface ConnectionTestResult {
	ok: boolean;
	category?: ImmichErrorCategory;
	/**
	 * Whether the second stage (real thumbnail fetch, which actually exercises
	 * the API key's scopes) ran. `false` when the library is empty and the
	 * scope-sensitive check could not be performed at all.
	 */
	scopeChecked: boolean;
}

/**
 * Hard safety cap on pagination. 25 pages x 200 assets = 5000 assets for a
 * single day — far beyond any realistic daily photo count. The cap guards
 * against a buggy or hostile server that keeps returning a `nextPage`
 * forever, which would otherwise loop (and hammer the server) indefinitely.
 */
const SEARCH_MAX_PAGES = 25;

/**
 * Response shape of `POST /api/search/metadata` (current Immich versions).
 * Modeled defensively: fields may be missing on older/changed servers, and
 * `nextPage` has been observed as string, number, or null.
 */
interface SearchMetadataResponse {
	assets?: {
		items?: ImmichAsset[];
		nextPage?: string | number | null;
	} | null;
}

/**
 * Request core for the Immich API. Endpoint-specific methods (search, thumbnail)
 * are added in later subtasks on top of `request()` / `requestBinary()`.
 */
export class ImmichClient {
	private readonly getConfig: () => ImmichClientConfig;
	private readonly requestFn: RequestFn;
	private readonly timeoutMs: number;

	constructor(
		getConfig: () => ImmichClientConfig,
		requestFn: RequestFn = requestUrl,
		timeoutMs: number = DEFAULT_TIMEOUT_MS
	) {
		this.getConfig = getConfig;
		this.requestFn = requestFn;
		this.timeoutMs = timeoutMs;
	}

	/**
	 * Fetches all image assets captured on a given local calendar day.
	 *
	 * Queries a generous UTC window (see `dayUtcWindow`) via
	 * `POST /api/search/metadata`, paginates through all result pages, then
	 * filters client-side to the exact local day and sorts ascending by
	 * capture time (see `filterByLocalDay`).
	 *
	 * @param localDay Calendar day in "YYYY-MM-DD" format.
	 */
	async searchDayAssets(localDay: string): Promise<ImmichAsset[]> {
		const window = dayUtcWindow(localDay);
		const all: ImmichAsset[] = [];

		for (let page = 1; page <= SEARCH_MAX_PAGES; page++) {
			const body: SearchMetadataBody = {
				takenAfter: window.takenAfter,
				takenBefore: window.takenBefore,
				// Images only in v1 — fixed by design decision, not a setting.
				type: "IMAGE",
				withExif: true,
				size: SEARCH_PAGE_SIZE,
				page,
			};

			const response = await this.request<SearchMetadataResponse>(
				"/api/search/metadata",
				{
					method: "POST",
					body: JSON.stringify(body),
					contentType: "application/json",
				}
			);

			// `response` may be null: requestUrl yields `json: null` for an
			// empty or non-JSON 2xx body, so guard every dereference.
			const items = response?.assets?.items ?? [];
			all.push(...items);

			const nextPage = response?.assets?.nextPage;
			// Stop when the server signals no further page, or when the
			// current page came back empty (defensive: some servers may keep
			// sending a nextPage token past the end of the result set).
			const hasNextPage =
				nextPage !== null && nextPage !== undefined && nextPage !== "";
			if (!hasNextPage || items.length === 0) {
				break;
			}
		}

		return filterByLocalDay(all, localDay);
	}

	/**
	 * Finds the local calendar day of the most recently taken image, or
	 * `null` for an empty library. Used as the starting day when a note's
	 * date cannot be resolved: the picker then opens on the newest day that
	 * actually has photos instead of an error.
	 */
	async findLatestAssetDay(): Promise<string | null> {
		const body: SearchMetadataBody = {
			type: "IMAGE",
			withExif: false,
			order: "desc",
			size: 1,
			page: 1,
		};

		const response = await this.request<SearchMetadataResponse>(
			"/api/search/metadata",
			{
				method: "POST",
				body: JSON.stringify(body),
				contentType: "application/json",
			}
		);

		const latest = response?.assets?.items?.[0];
		return latest ? latest.localDateTime.slice(0, 10) : null;
	}

	/**
	 * Fetches the raw bytes of an asset's thumbnail image.
	 *
	 * @param id Immich asset id.
	 * @param size `"thumbnail"` for the small list-view image, `"preview"` for
	 *   the larger, always-JPEG rendition used as the source of pixels for
	 *   inserted images (see concept: HEIC is handled server-side this way).
	 */
	async fetchThumbnail(
		id: string,
		size: "thumbnail" | "preview"
	): Promise<ArrayBuffer> {
		return this.requestBinary(
			`/api/assets/${encodeURIComponent(id)}/thumbnail?size=${size}`
		);
	}

	/**
	 * Tests the configured server URL and API key.
	 *
	 * Three stages:
	 * 1. `GET /api/server/ping` — public (no auth), verifies pure reachability.
	 *    Deliberately NOT `/api/server/about`: since the granular API key
	 *    permissions (Immich v2), `/about` requires its own `server.about`
	 *    permission, so a correctly minimal key (`asset.read` + `asset.view`)
	 *    would 403 there even though everything the plugin needs works.
	 * 2. Search for one asset — exercises the key itself (`401` for a wrong
	 *    key) and the `asset.read` permission (`403` when missing).
	 * 3. Thumbnail fetch — exercises the `asset.view` permission (concept §10:
	 *    catches read-only-scoped keys that pass the search stage).
	 *
	 * Errors are mapped into the result rather than thrown, since this feeds
	 * the settings UI directly.
	 */
	async testConnection(): Promise<ConnectionTestResult> {
		try {
			await this.request("/api/server/ping");
		} catch (error) {
			return this.toFailedResult(error, false);
		}

		let searchResponse: SearchMetadataResponse;
		try {
			const body: SearchMetadataBody = {
				takenAfter: "1970-01-01T00:00:00.000Z",
				takenBefore: new Date().toISOString(),
				type: "IMAGE",
				withExif: false,
				size: 1,
				page: 1,
			};
			searchResponse = await this.request<SearchMetadataResponse>(
				"/api/search/metadata",
				{
					method: "POST",
					body: JSON.stringify(body),
					contentType: "application/json",
				}
			);
		} catch (error) {
			return this.toFailedResult(error, true);
		}

		const firstAsset = searchResponse?.assets?.items?.[0];
		if (!firstAsset) {
			// Empty library: the scope-sensitive thumbnail check cannot run.
			return { ok: true, scopeChecked: false };
		}

		try {
			await this.fetchThumbnail(firstAsset.id, "thumbnail");
		} catch (error) {
			return this.toFailedResult(error, true);
		}

		return { ok: true, scopeChecked: true };
	}

	/** Builds a failed {@link ConnectionTestResult} from a caught error. */
	private toFailedResult(
		error: unknown,
		scopeChecked: boolean
	): ConnectionTestResult {
		const category =
			error instanceof ImmichError ? error.category : "other";
		return { ok: false, category, scopeChecked };
	}

	/** Performs a JSON request against the Immich API and returns the parsed body. */
	protected async request<T = unknown>(
		path: string,
		options: {
			method?: string;
			body?: string;
			contentType?: string;
		} = {}
	): Promise<T> {
		const response = await this.performRequest(path, options);
		return response.json as T;
	}

	/** Performs a binary request (e.g. thumbnails) and returns the raw bytes. */
	protected async requestBinary(path: string): Promise<ArrayBuffer> {
		const response = await this.performRequest(path, {});
		return response.arrayBuffer;
	}

	private async performRequest(
		path: string,
		options: { method?: string; body?: string; contentType?: string }
	): Promise<RequestUrlResponse> {
		const config = this.getConfig();
		const url = this.buildUrl(config.serverUrl, path);

		const params: RequestUrlParam = {
			url,
			method: options.method ?? "GET",
			headers: { "x-api-key": config.apiKey },
			// Map status codes ourselves instead of letting requestUrl throw.
			throw: false,
		};
		if (options.body !== undefined) {
			params.body = options.body;
		}
		if (options.contentType !== undefined) {
			params.contentType = options.contentType;
		}

		let response: RequestUrlResponse;
		try {
			response = await this.withTimeout(this.requestFn(params));
		} catch (error) {
			if (error instanceof ImmichError) {
				throw error;
			}
			// Connection-level failures (DNS, refused, TLS, ...) surface as throws.
			throw new ImmichError(
				"network",
				error instanceof Error ? error.message : String(error)
			);
		}

		if (response.status >= 400) {
			throw this.errorForStatus(response.status, url);
		}
		return response;
	}

	/**
	 * Races the request against a timer. `requestUrl` cannot be aborted, so on
	 * timeout the pending request is simply abandoned — it may still complete in
	 * the background, but its result (or rejection) is ignored.
	 */
	private withTimeout(
		promise: Promise<RequestUrlResponse>
	): Promise<RequestUrlResponse> {
		let timer: number;
		const timeout = new Promise<never>((_, reject) => {
			timer = window.setTimeout(() => {
				reject(
					new ImmichError(
						"network",
						`Request timed out after ${this.timeoutMs} ms`
					)
				);
			}, this.timeoutMs);
		});
		// Swallow late rejections of the abandoned request to avoid
		// unhandled-rejection noise after a timeout won the race.
		promise.catch(() => {});
		return Promise.race([promise, timeout]).finally(() =>
			window.clearTimeout(timer)
		);
	}

	private errorForStatus(status: number, url: string): ImmichError {
		let category: ImmichErrorCategory;
		if (status === 401) {
			category = "unauthorized";
		} else if (status === 403) {
			category = "forbidden";
		} else if (status >= 500) {
			category = "server";
		} else {
			category = "other";
		}
		return new ImmichError(
			category,
			`Immich request failed with HTTP ${status} (${url})`,
			status
		);
	}

	/** Joins server URL and path, tolerating trailing slashes in the setting. */
	private buildUrl(serverUrl: string, path: string): string {
		const base = serverUrl.replace(/\/+$/, "");
		const suffix = path.startsWith("/") ? path : `/${path}`;
		return `${base}${suffix}`;
	}
}
