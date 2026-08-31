import {
  triggerDownload
} from "./download";

/**
 * Handing an export to the operating system's share sheet.
 *
 * This exists for one reason: on iOS a `<a download>` can only reach the Files
 * app. There is no web API that writes to Photos — but the native share sheet
 * has "Save Image" / "Save Video" entries that do, so `navigator.share` is the
 * only route from a browser export to the camera roll.
 *
 * Capability is decided by `navigator.canShare`, never by sniffing the user
 * agent: file sharing is gated on the platform, the transport (secure context)
 * and the file types all at once, and only the browser knows the answer.
 */

/** Whether this browser will accept these exact files in a share sheet. */
export function canShareFiles( files: File[] ): boolean {
  if ( files.length === 0 || typeof navigator === "undefined" ) {
    return false;
  }

  try {
    return Boolean( navigator.canShare?.( {
      files
    } ) );
  } catch {
    // Some engines throw rather than returning false for an unsupported type.
    return false;
  }
}

/** Wrap an export's blob as a File, which is what the share sheet takes. */
export function artifactToFile(
  blob: Blob, fileName: string
): File {
  return new File(
    [
      blob
    ],
    fileName,
    {
      type: blob.type || "application/octet-stream"
    }
  );
}

export type ShareOutcome = "shared" | "dismissed" | "downloaded";

/**
 * Offer the files to the share sheet, falling back to a download.
 *
 * Must be called straight out of a user gesture — building the `File`s and
 * checking `canShareFiles` first, then calling this, keeps the gesture intact.
 * Awaiting anything else in between can cost the activation and make the sheet
 * refuse to open.
 *
 * A dismissed sheet is not a failure: the user looked and chose not to save,
 * and re-triggering a download for them would be exactly the behaviour this
 * feature exists to avoid.
 */
export async function shareFiles(
  files: File[], title: string
): Promise<ShareOutcome> {
  if ( canShareFiles( files ) ) {
    try {
      await navigator.share( {
        files,
        title
      } );

      return "shared";
    } catch( error ) {
      if ( error instanceof DOMException && error.name === "AbortError" ) {
        return "dismissed";
      }

      // Anything else — a rejected type, a share already in flight — is worth
      // falling through for, so the user still gets their file.
    }
  }

  for ( const file of files ) {
    triggerDownload(
      file,
      file.name
    );
  }

  return "downloaded";
}
