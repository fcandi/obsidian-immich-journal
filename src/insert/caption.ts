import type { ImmichAsset } from "../types";
import { renderTemplate } from "../util/template";

/**
 * Builds the template variable bag for an asset's caption, using only the
 * subset of variables that are meaningful for a caption line:
 * `description`, `time`, `date`, `city`, `country`, `camera`, `people`,
 * `filename`.
 *
 * `localDateTime` is already local wall-clock time (no timezone math): the
 * first 10 characters are the `YYYY-MM-DD` date, the characters at
 * position 11-16 are the `HH:mm` time.
 */
export function buildCaptionVars(asset: ImmichAsset): Record<string, string> {
	const exif = asset.exifInfo ?? null;

	const description = exif?.description ?? "";
	const city = exif?.city ?? "";
	const country = exif?.country ?? "";

	const cameraParts = [exif?.make, exif?.model].filter(
		(part): part is string => !!part
	);
	const camera = cameraParts.join(" ");

	const people = (asset.people ?? [])
		.map((person) => person.name)
		.filter((name) => !!name)
		.join(", ");

	const date = asset.localDateTime.slice(0, 10);
	const time = asset.localDateTime.slice(11, 16);

	return {
		description,
		time,
		date,
		city,
		country,
		camera,
		people,
		filename: asset.originalFileName,
	};
}

/**
 * Renders the caption template for an asset and trims the result.
 *
 * If the trimmed result is empty (e.g. default template `{{description}}`
 * with no description present), returns `''` — callers are expected to
 * omit the caption line entirely in that case (decided default behavior).
 */
export function renderCaption(tpl: string, asset: ImmichAsset): string {
	const vars = buildCaptionVars(asset);
	const rendered = renderTemplate(tpl, vars).trim();
	return rendered;
}
