/**
 * Builds an Immich deep link to a specific asset.
 *
 * Normalizes the server URL to end with exactly one trailing slash separator,
 * then appends the asset path.
 *
 * @param server The Immich server base URL (e.g. "https://immich.example.com" or "https://immich.example.com/")
 * @param assetId The asset ID to link to
 * @returns The full deep link URL, e.g. "https://immich.example.com/photos/{assetId}"
 */
export function buildImmichUrl(server: string, assetId: string): string {
	// Normalize server: strip all trailing slashes, then add exactly one
	const normalizedServer = server.replace(/\/+$/, "");
	return `${normalizedServer}/photos/${assetId}`;
}
