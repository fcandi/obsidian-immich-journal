import type { ImmichAsset } from "../types";

/**
 * Builds the metadata portion of the template variable bag for an asset:
 * `description`, `time`, `date`, `city`, `country`, `camera`, `people`,
 * `filename`. The pipeline adds the path/link variables on top.
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
