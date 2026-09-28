// On-device image work — SPEC B §15 (upload) and §16 (export). Honours EXIF orientation;
// never upscales.

export class ImageError extends Error {}

async function decode(src: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(src, { imageOrientation: 'from-image' });
  } catch {
    throw new ImageError('Could not read that photo — try another.');
  }
}

function draw(bmp: ImageBitmap, maxSide: number, whiteBackground: boolean) {
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  if (whiteBackground) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(bmp, 0, 0, w, h);
  return { canvas, w, h };
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b && b.type === type ? resolve(b) : reject(new ImageError('This device could not encode the image.'))), type, quality),
  );
}

/** Upload versions: full ≤1600 px WebP 0.70, thumbnail ≤400 px WebP 0.60. */
export async function preparePhoto(file: Blob) {
  const bmp = await decode(file);
  try {
    const full = draw(bmp, 1600, false);
    const thumb = draw(bmp, 400, false);
    return {
      full: await toBlob(full.canvas, 'image/webp', 0.7),
      thumb: await toBlob(thumb.canvas, 'image/webp', 0.6),
      width: full.w,
      height: full.h,
    };
  } finally {
    bmp.close();
  }
}

/** Re-encode a stored image as JPEG on white (PDF: 1400/0.85; saved photos: 4096/0.92). */
export async function toJpeg(src: Blob, maxSide: number, quality: number) {
  const bmp = await decode(src);
  try {
    const { canvas, w, h } = draw(bmp, maxSide, true);
    return { blob: await toBlob(canvas, 'image/jpeg', quality), dataUrl: canvas.toDataURL('image/jpeg', quality), w, h };
  } finally {
    bmp.close();
  }
}
