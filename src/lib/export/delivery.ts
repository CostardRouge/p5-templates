import {
  createZip, type ZipEntry
} from "@/utils/clientZip";
import {
  artifactToFile, canShareFiles, offerShareSheet, type ShareOutcome
} from "./share";
import {
  triggerDownload
} from "./download";
import type {
  ExportArtifact
} from "./runExportBatch";

/**
 * How a finished export reaches the user.
 *
 * The runner used to download each variant the moment it finished, from inside
 * an async loop. On a phone that loses files, for three reasons that are worth
 * keeping straight because only the third is obvious:
 *
 * - **No user activation.** The Export tap is minutes gone by the time the
 *   second variant lands, and a download needs a live gesture there.
 * - **The prompts are modal and do not queue.** iOS raises a "save where?"
 *   sheet per file; the next download lands on the open sheet and the earlier
 *   file is simply dropped.
 * - **A download reports nothing back.** `<a download>` fires no events, so
 *   there is no way to wait for one prompt before starting the next.
 *
 * So on such a device the run delivers nothing by itself: it keeps its files
 * and the user saves them in one deliberate gesture. Everywhere else, delivery
 * stays automatic exactly as it was.
 */

export type SaveOutcome = ShareOutcome | "failed";

/** Whether a save actually put the file somewhere. */
export function isDelivered( outcome: SaveOutcome ): boolean {
  return outcome === "shared" || outcome === "downloaded";
}

/**
 * Whether the primary pointing device is a finger.
 *
 * A media feature, not a user-agent string — the repo sniffs no user agents
 * (`src/` has none outside `app/robots.ts`) and this keeps it that way.
 */
export function hasCoarsePointer(): boolean {
  if ( typeof window === "undefined" || !window.matchMedia ) {
    return false;
  }

  return window.matchMedia( "( pointer: coarse )" ).matches;
}

/**
 * Whether a run must hold its files back for an explicit save.
 *
 * Two capability questions, and it takes both. A share sheet says the OS has a
 * real save flow for these files; a coarse pointer says this is the kind of
 * device where a download is a blocking modal rather than a line in a
 * downloads bar. Desktop Chrome and Safari answer yes to the first — they have
 * share sheets too — and deferring there would trade a working automatic
 * download for an extra click, which is why the second question exists.
 *
 * Known edge: a tablet driven by a trackpad may report a fine pointer and so
 * keep the automatic path. That is the behaviour it has today, not a new
 * failure, and the manual save below stays available to it regardless.
 */
export function shouldDeferDelivery( artifacts: ExportArtifact[] ): boolean {
  return hasCoarsePointer() && canShareFiles( toFiles( artifacts ) );
}

/** The share sheet takes `File`s, and every save path starts from the same set. */
export function toFiles( artifacts: ExportArtifact[] ): File[] {
  return artifacts.map( ( artifact ) => artifactToFile(
    artifact.blob,
    artifact.fileName
  ) );
}

/** Bundle several artifacts into one stored `.zip`. */
export async function bundleArtifacts( artifacts: ExportArtifact[] ): Promise<Blob> {
  const entries: ZipEntry[] = await Promise.all( artifacts.map( async( artifact ) => ( {
    name: artifact.fileName,
    data: new Uint8Array( await artifact.blob.arrayBuffer() )
  } ) ) );

  return createZip( entries );
}

/**
 * Save a set of artifacts in ONE gesture: one share sheet, or one download.
 *
 * The invariant is the count, not the route — whatever happens, this raises at
 * most one prompt. That is why it does not delegate its fallback to
 * `shareFiles`, which downloads one file per artifact: correct for a lone
 * snapshot, and precisely the stacking to avoid for a batch. Several artifacts
 * that cannot be shared collapse into a single zip instead.
 *
 * Call it straight from the tap. The share branch touches nothing async before
 * `navigator.share`, so the activation survives; the zip branch has to read
 * every blob first and loses it, which is safe because that branch is only
 * reached where no share sheet exists and a download needs no gesture.
 */
export async function saveArtifacts(
  artifacts: ExportArtifact[],
  title: string,
  bundleFileName: string
): Promise<SaveOutcome> {
  if ( artifacts.length === 0 ) {
    return "failed";
  }

  const outcome = await offerShareSheet(
    toFiles( artifacts ),
    title
  );

  if ( outcome ) {
    return outcome;
  }

  return downloadArtifacts(
    artifacts,
    bundleFileName
  );
}

/**
 * Deliver a set of artifacts without a gesture, as a download.
 *
 * The automatic path, and deliberately NOT `saveArtifacts`: that one prefers
 * the share sheet, and a sheet opening by itself — minutes after the Export
 * tap, on a desktop that merely happens to have one — is not something a run
 * may do unasked. Same one-prompt rule as everywhere else: several artifacts
 * collapse into a single zip rather than a burst of downloads.
 */
export async function downloadArtifacts(
  artifacts: ExportArtifact[],
  bundleFileName: string
): Promise<SaveOutcome> {
  if ( artifacts.length === 0 ) {
    return "failed";
  }

  try {
    if ( artifacts.length === 1 ) {
      triggerDownload(
        artifacts[ 0 ].blob,
        artifacts[ 0 ].fileName
      );
    } else {
      triggerDownload(
        await bundleArtifacts( artifacts ),
        bundleFileName
      );
    }

    return "downloaded";
  } catch( error ) {
    // A delivery that produces nothing has to say so — both to the caller, so
    // the files stay held and offerable again, and to the console, so the
    // reason is not lost behind a one-word outcome.
    console.error(
      "Export delivery failed.",
      error
    );

    return "failed";
  }
}
