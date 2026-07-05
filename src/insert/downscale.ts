/**
 * Image downscaling for inserted photos.
 *
 * Pure sizing math lives in {@link computeTargetSize} (unit-tested);
 * {@link downscaleToJpeg} does the actual pixel work using web standards
 * only (Blob, createImageBitmap/HTMLImageElement, Canvas), so it runs both
 * in Electron (desktop) and the iOS/Android Capacitor WebView.
 */

export interface TargetSize {
	width: number;
	height: number;
	needsResize: boolean;
}

/**
 * Compute the target dimensions for an image so that its LONGEST side
 * equals `maxEdgePx`, preserving aspect ratio. Portrait and landscape are
 * treated alike. Never upscales: if the longest side is already within
 * `maxEdgePx`, the original size is returned with `needsResize: false`.
 * Results are rounded to integers with a minimum of 1px per side.
 */
export function computeTargetSize(
	width: number,
	height: number,
	maxEdgePx: number
): TargetSize {
	const longest = Math.max(width, height);
	if (longest <= maxEdgePx) {
		return { width, height, needsResize: false };
	}
	const scale = maxEdgePx / longest;
	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale)),
		needsResize: true,
	};
}

/**
 * A decoded image plus its intrinsic dimensions and a cleanup function.
 *
 * `width`/`height` are always the intrinsic pixel dimensions (for an
 * `HTMLImageElement`, `naturalWidth`/`naturalHeight` — not the layout
 * `.width`/`.height`, which can differ). `dispose()` releases every
 * resource held by the decode (an `ImageBitmap`, an object URL, or both)
 * and must be called by the caller once drawing is done.
 */
interface DecodedImage {
	source: CanvasImageSource;
	width: number;
	height: number;
	dispose(): void;
}

/** Decode an image Blob using createImageBitmap when available, else an HTMLImageElement. */
async function decodeImage(blob: Blob): Promise<DecodedImage> {
	if (typeof createImageBitmap === "function") {
		const bitmap = await createImageBitmap(blob);
		return {
			source: bitmap,
			width: bitmap.width,
			height: bitmap.height,
			dispose: () => bitmap.close(),
		};
	}

	// Fallback for WebViews without createImageBitmap support. The object URL
	// must stay alive until drawing is done, so it is revoked in dispose(),
	// not right after load.
	const url = URL.createObjectURL(blob);
	try {
		const img = await new Promise<HTMLImageElement>((resolve, reject) => {
			const el = new Image();
			el.onload = () => resolve(el);
			el.onerror = () => reject(new Error("Failed to decode image"));
			el.src = url;
		});
		return {
			source: img,
			width: img.naturalWidth,
			height: img.naturalHeight,
			dispose: () => URL.revokeObjectURL(url),
		};
	} catch (error) {
		// Decode failed before we could hand the URL to the caller — revoke
		// it here so it does not leak.
		URL.revokeObjectURL(url);
		throw error;
	}
}

/**
 * Downscale a JPEG image so its longest side is at most `maxEdgePx` and
 * re-encode as JPEG with the given `quality` (0..1).
 *
 * If the image already fits within `maxEdgePx`, the ORIGINAL buffer is
 * returned unchanged — the source is already a JPEG from the Immich
 * preview endpoint, so re-encoding would only lose quality.
 */
export async function downscaleToJpeg(
	buf: ArrayBuffer,
	maxEdgePx: number,
	quality: number
): Promise<ArrayBuffer> {
	const blob = new Blob([buf], { type: "image/jpeg" });
	const image = await decodeImage(blob);
	try {
		const target = computeTargetSize(image.width, image.height, maxEdgePx);
		if (!target.needsResize) {
			return buf;
		}

		const canvas = document.createElement("canvas");
		canvas.width = target.width;
		canvas.height = target.height;
		const ctx = canvas.getContext("2d");
		if (!ctx) {
			throw new Error("Failed to get 2D canvas context");
		}
		ctx.drawImage(image.source, 0, 0, target.width, target.height);

		const jpegBlob = await new Promise<Blob>((resolve, reject) => {
			canvas.toBlob(
				(result) => {
					if (result) {
						resolve(result);
					} else {
						reject(new Error("Canvas JPEG encoding failed"));
					}
				},
				"image/jpeg",
				quality
			);
		});
		return jpegBlob.arrayBuffer();
	} finally {
		image.dispose();
	}
}
