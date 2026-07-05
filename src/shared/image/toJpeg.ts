/**
 * Re-encode a stored inspection image (WebP, served from a signed URL) into a
 * JPEG. Two consumers share this:
 *
 *  - The PDF report embeds JPEG (jsPDF can't reliably embed WebP) at a slightly
 *    reduced size so the document stays shareable — `imageForPdf`.
 *  - "Save photo" hands the user a JPEG at the full stored resolution, because
 *    JPEG opens everywhere while WebP still trips some desktop tools / mail
 *    clients — `imageForExport`.
 *
 * Both run entirely on the device via <canvas>; no server round-trip beyond
 * fetching the bytes the app already has signed URLs for.
 */

/** A decoded, re-encoded image plus the dimensions it was drawn at. */
export interface JpegResult {
  blob: Blob;
  /** data: URL form, handy for jsPDF.addImage. */
  dataUrl: string;
  width: number;
  height: number;
}

async function decode(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob);
    } catch {
      // Fall through to <img> on browsers that choke on the blob.
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Could not read that image.'));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function dims(src: ImageBitmap | HTMLImageElement): { w: number; h: number } {
  return src instanceof HTMLImageElement
    ? { w: src.naturalWidth, h: src.naturalHeight }
    : { w: src.width, h: src.height };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not encode the image.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Fetch an image URL and re-encode it as JPEG. `maxSide` caps the longest edge
 * (images are never upscaled); pass a large value to keep the stored size.
 * Returns both a Blob (for sharing/download) and a data URL (for jsPDF).
 */
export async function urlToJpeg(
  url: string,
  opts: { maxSide?: number; quality?: number } = {}
): Promise<JpegResult> {
  const { maxSide = 4096, quality = 0.9 } = opts;

  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not download an image for the report.');
  const srcBlob = await res.blob();

  const src = await decode(srcBlob);
  const { w: srcW, h: srcH } = dims(src);

  const scale = Math.min(1, maxSide / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable on this device.');
  // White matte: JPEG has no alpha, so any transparency would otherwise go black.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(src, 0, 0, w, h);

  if (typeof ImageBitmap !== 'undefined' && src instanceof ImageBitmap) src.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('This device could not encode the image.'))),
      'image/jpeg',
      quality
    );
  });

  return { blob, dataUrl: await blobToDataUrl(blob), width: w, height: h };
}

/** JPEG sized for embedding in the PDF — legible detail, kept shareable. */
export function imageForPdf(url: string): Promise<JpegResult> {
  return urlToJpeg(url, { maxSide: 1400, quality: 0.85 });
}

/** JPEG at the full stored resolution for "Save photo" — universal format. */
export function imageForExport(url: string): Promise<JpegResult> {
  return urlToJpeg(url, { maxSide: 4096, quality: 0.92 });
}
