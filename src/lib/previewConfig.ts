/**
 * Shared preview-clip configuration.
 *
 * Imported by the server-side generator (`createSketchPreviews`), the
 * dev-only "Record preview" client flow (`useBrowserRecorder`) and the
 * blob → WebM re-encoder so the duration, frame rate and output sizes
 * stay in lock-step regardless of which path produced the clip.
 *
 * Keep this module free of server-only imports — it is pulled into the
 * browser bundle by the recorder hook.
 */

/** Playback frame rate of the committed preview loops. */
export const PREVIEW_FPS = 20;

/** Length, in seconds, of every committed preview loop. */
export const PREVIEW_SECS = 9;

/**
 * Lead-in countdown (3, 2, 1) before a dev "Record preview" capture
 * actually starts — leaves time to get a webcam / mic / hand-tracked
 * interaction ready before the clock resets to frame 0.
 */
export const PREVIEW_COUNTDOWN_SECS = 3;

export type PreviewVariant = {
  filename: string;
  width: number;
  height: number;
};

/**
 * Multiple output sizes, encoded from the same capture. `preview.webm`
 * is the baseline used everywhere (incl. mobile); `preview-md.webm` is a
 * higher-res variant served to desktop home-page tiles.
 */
export const PREVIEW_VARIANTS: ReadonlyArray<PreviewVariant> = [
  {
    filename: "preview.webm",
    width: 360,
    height: 450
  },
  {
    filename: "preview-md.webm",
    width: 540,
    height: 675
  }
];
