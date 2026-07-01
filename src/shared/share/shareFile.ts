/**
 * Hand a generated file (PDF) or a set of images to the user so they can save it
 * or send it on (e.g. to a mentor). Prefers the native share sheet via the Web
 * Share API — which on Android/iOS offers "Save to Files/Photos" plus every
 * messaging app — and falls back to a plain browser download where sharing files
 * isn't supported (most desktop browsers).
 *
 * Nothing is uploaded; everything stays on the device.
 *
 * NOTE: inside the Capacitor Android/iOS wrapper the system WebView generally
 * supports navigator.share, so this path works there too. If real-device testing
 * shows gaps, the native @capacitor/share + @capacitor/filesystem plugins can be
 * slotted into `shareFiles` behind a Capacitor.isNativePlatform() check without
 * touching callers.
 */

export interface ShareableFile {
  blob: Blob;
  filename: string;
}

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

function triggerDownload(file: ShareableFile) {
  const url = URL.createObjectURL(file.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after a tick so the download has a chance to start.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Save a file straight to the browser's Downloads — no share sheet. */
export function downloadFile(file: ShareableFile): void {
  triggerDownload(file);
}

/**
 * Route through the share sheet ONLY on iOS, where "Save to Files" lives in the
 * sheet and a direct download is unreliable in a standalone PWA. Everywhere else
 * — desktop AND Android — a direct <a download> saves straight to the device's
 * Downloads folder, so we skip the sheet. (Desktop and Android share sheets show
 * cloud/app targets like Google Drive but no clean "save to this device".)
 */
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    // iPadOS 13+ reports a desktop Mac UA; detect it via touch support.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function canShareFiles(files: File[]): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    typeof navigator.share === 'function' &&
    navigator.canShare({ files })
  );
}

/** Share or download one or more files. `title`/`text` annotate the share sheet. */
export async function shareFiles(
  files: ShareableFile[],
  opts: { title?: string; text?: string } = {}
): Promise<ShareOutcome> {
  if (files.length === 0) return 'cancelled';

  const fileObjects = files.map(
    (f) => new File([f.blob], f.filename, { type: f.blob.type || 'application/octet-stream' })
  );

  if (isIOS() && canShareFiles(fileObjects)) {
    try {
      await navigator.share({ files: fileObjects, title: opts.title, text: opts.text });
      return 'shared';
    } catch (err: any) {
      // User dismissed the sheet — not an error worth surfacing.
      if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError')) {
        return 'cancelled';
      }
      // Anything else: fall through to download so the user still gets the file.
    }
  }

  for (const file of files) triggerDownload(file);
  return 'downloaded';
}

/** Convenience wrapper for a single file (e.g. the PDF report). */
export function shareFile(
  file: ShareableFile,
  opts: { title?: string; text?: string } = {}
): Promise<ShareOutcome> {
  return shareFiles([file], opts);
}
