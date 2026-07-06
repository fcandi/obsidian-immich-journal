/**
 * Central type model for Immich Journal.
 *
 * These types describe the shape of Immich API responses that this plugin
 * consumes, as well as the plugin's own settings and template rendering
 * context. All later modules import from here.
 */

/**
 * A person tagged on an Immich asset (face recognition).
 */
export interface ImmichPerson {
	id?: string;
	name: string;
}

/**
 * EXIF metadata for an Immich asset, as returned when `withExif: true` is
 * passed to `/api/search/metadata`. Immich returns `null` (not `undefined`)
 * for fields it has no value for, so all fields are explicitly nullable.
 */
export interface ImmichExifInfo {
	description?: string | null;
	city?: string | null;
	state?: string | null;
	country?: string | null;
	make?: string | null;
	model?: string | null;
}

/**
 * A single asset as returned by Immich's `/api/search/metadata` endpoint.
 * Only the fields this plugin actually uses are modeled here.
 */
export interface ImmichAsset {
	id: string;
	/** Local wall-clock time at the capture location, ISO-like string (e.g. "2026-07-05T19:42:00.000"). */
	localDateTime: string;
	type: "IMAGE" | "VIDEO";
	originalFileName: string;
	exifInfo?: ImmichExifInfo | null;
	people?: ImmichPerson[] | null;
}

/**
 * Request body for `POST /api/search/metadata`.
 *
 * Day-query strategy: query a generous UTC window (±1 day) via
 * `takenAfter`/`takenBefore`, then filter client-side on
 * `asset.localDateTime.startsWith(day)` to get "wall-clock day at capture
 * location" semantics.
 */
export interface SearchMetadataBody {
	takenAfter?: string;
	takenBefore?: string;
	/** Sort order by taken timestamp; the server default is "desc". */
	order?: "asc" | "desc";
	type: "IMAGE";
	withExif: boolean;
	size: number;
	page: number;
}

/**
 * Persisted plugin settings (v1). No `showVideos` field — videos are
 * out of scope until v1.1.
 */
export interface PluginSettings {
	serverUrl: string;
	apiKey: string;
	maxEdgePx: number;
	jpegQuality: number;
	attachmentFolder: string;
	fileNameTemplate: string;
	markdownTemplate: string;
	captionTemplate: string;
	embedStyle: "markdown" | "wikilink";
	linkToImmich: boolean;
	titleDateFormat: string;
	frontmatterField: string;
	gridCols: number;
	languageOverride: "auto" | "en" | "de" | "es" | "fr" | "ja" | "zh";
}

/**
 * Variable bag passed to the template renderer (Markdown block template,
 * filename template, caption template). Keys are template variable names
 * without the surrounding `{{ }}`, values are the rendered strings.
 *
 * Known template variables:
 * - `altText` — alt text for the image, typically the description or a fallback.
 * - `localPath` — vault-relative path to the downloaded/resized image file.
 * - `immichUrl` — deep link back to the asset on the Immich server (`{server}/photos/{assetId}`).
 * - `caption` — the fully rendered caption line (from the caption template).
 * - `description` — `exifInfo.description`, if present.
 * - `time` — local time of capture, formatted `HH:mm`.
 * - `date` — local date of capture, formatted `YYYY-MM-DD`.
 * - `city` — `exifInfo.city`, if present.
 * - `country` — `exifInfo.country`, if present.
 * - `camera` — combined `exifInfo.make`/`exifInfo.model`, if present.
 * - `people` — comma-separated list of tagged people's names, if present.
 * - `filename` — `originalFileName` of the asset.
 * - `year` — four-digit year of capture, derived from `localDateTime`.
 * - `assetIdShort` — short (e.g. first 8 chars) form of the asset id, used for idempotent file naming.
 */
export type RenderContext = Record<string, string>;
