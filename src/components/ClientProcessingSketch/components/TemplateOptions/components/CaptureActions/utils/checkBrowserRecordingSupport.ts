/**
 * Whether the browser can record the canvas in *any* supported format.
 * Each format then has its own runtime requirements:
 *   - gif         → always available (gif.js worker)
 *   - webm/mp4    → realtime needs MediaRecorder + captureStream;
 *                   deterministic needs WebCodecs.
 *
 * The button is shown as long as one path exists; per-format failures
 * are surfaced when the user actually clicks Record.
 */
export function checkBrowserRecordingSupport(): boolean {
  if ( typeof window === "undefined" ) {
    return false;
  }

  const hasMediaRecorder =
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined" &&
    "captureStream" in HTMLCanvasElement.prototype;

  const hasWebCodecs =
    typeof ( window as any ).VideoEncoder === "function";

  const hasWorker = typeof Worker !== "undefined";

  return hasMediaRecorder || hasWebCodecs || hasWorker;
}
