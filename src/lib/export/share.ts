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
 * It is also the only delivery that REPORTS BACK. A download fires no events at
 * all: nothing tells the page whether its prompt was answered or dismissed, so
 * nothing can be sequenced on it. `navigator.share` resolves when the file was
 * handed over and rejects with `AbortError` when the sheet was dismissed, which
 * is what lets `delivery.ts` show a file as saved, or still pending.
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

export type ShareOutcome =
  | "shared"
  | "dismissed"
  | "downloaded"
  /** A sheet is already open. Nothing was delivered, and nothing must be. */
  | "busy";

/**
 * Open the share sheet and report what happened — never falling back.
 *
 * `null` means no sheet was offered at all (unsupported, or these files
 * refused), leaving the fallback to the caller. That split matters: the right
 * fallback is not the same everywhere. A single file downloads as itself, while
 * a whole batch must collapse to ONE download — see `delivery.ts`.
 *
 * Must be called straight out of a user gesture. Building the `File`s and
 * checking `canShareFiles` first, then calling this, keeps the gesture intact;
 * awaiting anything else in between can cost the activation and make the sheet
 * refuse to open.
 */
export async function offerShareSheet(
  files: File[], title: string
): Promise<ShareOutcome | null> {
  if ( !canShareFiles( files ) ) {
    return null;
  }

  try {
    await navigator.share( {
      files,
      title
    } );

    return "shared";
  } catch( error ) {
    // A dismissed sheet is not a failure: the user looked and chose not to
    // save, and re-triggering a download for them would be exactly the
    // behaviour this feature exists to avoid.
    if ( error instanceof DOMException && error.name === "AbortError" ) {
      return "dismissed";
    }

    // A sheet is already open — the spec rejects a second share() with
    // InvalidStateError while one is in flight. Delivering anything here would
    // land BEHIND that open sheet, which is the stacking this path exists to
    // prevent, so report it and deliver nothing.
    if ( error instanceof DOMException && error.name === "InvalidStateError" ) {
      return "busy";
    }

    // Anything else — a rejected file type, no share target at all — is worth
    // falling back for, so the user still gets their file.
    return null;
  }
}

/**
 * Offer the files to the share sheet, falling back to a download each.
 *
 * For callers delivering ONE file, where a per-file fallback cannot stack
 * prompts. A whole export batch goes through `saveArtifacts` in `delivery.ts`
 * instead, which collapses its fallback to a single download.
 */
export async function shareFiles(
  files: File[], title: string
): Promise<ShareOutcome> {
  const outcome = await offerShareSheet(
    files,
    title
  );

  if ( outcome ) {
    return outcome;
  }

  for ( const file of files ) {
    triggerDownload(
      file,
      file.name
    );
  }

  return "downloaded";
}
