/**
 * Client-side image compression for inspection photos.
 *
 * Validated on real hardware (2026-06): 1600px longest side / 70% quality / WebP
 * is the in-app sweet spot — fine detail (eggs, mites, comb texture) survives
 * while files land in the ~200–500 KB range. WebP displays on every browser/phone
 * since ~2020; a JPEG copy is reserved for any future save/share-to-device path.
 *
 * One pipeline serves web, installed PWA, and the native wrapper.
 */

export interface CompressedImage {
  /** Compressed full-size image for storage + full-res view on tap. */
  full: Blob;
  /** Small thumbnail for list views. */
  thumb: Blob;
  /** Final dimensions of the full image after downscaling. */
  width: number;
  height: number;
  /** MIME type of the output blobs (e.g. 'image/webp'). */
  mimeType: string;
}

export interface CompressOptions {
  /** Longest-side cap for the full image, in px. Default 1600 (validated). */
  fullMaxSide?: number;
  /** Longest-side cap for the thumbnail, in px. Default 400. */
  thumbMaxSide?: number;
  /** Quality 0–1 for the full image. Default 0.7 (validated). */
  fullQuality?: number;
  /** Quality 0–1 for the thumbnail. Default 0.6. */
  thumbQuality?: number;
  /** Output format. Default 'image/webp'. */
  mimeType?: 'image/webp' | 'image/jpeg';
}

const DEFAULTS: Required<CompressOptions> = {
  fullMaxSide: 1600,
  thumbMaxSide: 400,
  fullQuality: 0.7,
  thumbQuality: 0.6,
  mimeType: 'image/webp',
};

/**
 * Decode a File into a bitmap, honoring EXIF orientation where supported so
 * phone photos aren't rotated sideways. Falls back to an <img> element on
 * browsers without createImageBitmap orientation support.
 */
async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Some browsers reject the options bag — fall through to <img>.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Could not read that photo — try another.'));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function sourceDimensions(src: ImageBitmap | HTMLImageElement): { w: number; h: number } {
  if (src instanceof HTMLImageElement) {
    return { w: src.naturalWidth, h: src.naturalHeight };
  }
  return { w: src.width, h: src.height };
}

function drawScaled(
  src: ImageBitmap | HTMLImageElement,
  srcW: number,
  srcH: number,
  maxSide: number,
  mimeType: string,
  quality: number
): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable on this device.');
  ctx.drawImage(src, 0, 0, w, h);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('This device could not encode the image.'));
      },
      mimeType,
      quality
    );
  });
}

/**
 * Compress a picked/captured image into a full-size blob + a thumbnail blob.
 * Throws with a user-friendly message if the photo can't be read or encoded.
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<CompressedImage> {
  const opts = { ...DEFAULTS, ...options };
  const src = await decode(file);
  const { w: srcW, h: srcH } = sourceDimensions(src);

  const [full, thumb] = await Promise.all([
    drawScaled(src, srcW, srcH, opts.fullMaxSide, opts.mimeType, opts.fullQuality),
    drawScaled(src, srcW, srcH, opts.thumbMaxSide, opts.mimeType, opts.thumbQuality),
  ]);

  // Release bitmap memory promptly on browsers that support it.
  if (typeof ImageBitmap !== 'undefined' && src instanceof ImageBitmap) {
    src.close();
  }

  const scale = Math.min(1, opts.fullMaxSide / Math.max(srcW, srcH));
  return {
    full,
    thumb,
    width: Math.max(1, Math.round(srcW * scale)),
    height: Math.max(1, Math.round(srcH * scale)),
    mimeType: opts.mimeType,
  };
}
