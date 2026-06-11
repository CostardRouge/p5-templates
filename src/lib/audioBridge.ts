/**
 * Engine-agnostic audio bridge.
 *
 * Any sketch audio engine (Web Audio synth, sample player, …) registers one
 * AudioBridge implementation once it has an output to share. The recording
 * layer queries it without knowing which engine — or whether any — is
 * producing sound, so video-only sketches keep working unchanged.
 *
 * Lifecycle:
 *   1. Audio engine calls `registerAudioBridge(bridge)` once initialised.
 *   2. RealtimeRecorder calls `getAudioBridge()` when capture starts and,
 *      if a bridge exists, mixes its stream tracks into the MediaRecorder.
 *      AsyncLoopRecorder uses `beginCapture()` / `endCapture()` /
 *      `renderOffline()` to bake an AudioBuffer aligned with its frame
 *      loop, then muxes it into the encoder output.
 *   3. Engine calls `unregisterAudioBridge()` on teardown (optional).
 */

export interface AudioOfflineRenderOptions {
  /** Total clip duration in seconds. Events past it are dropped. */
  duration: number;
  /** Defaults to 48 kHz. */
  sampleRate?: number;
  /** Defaults to mono. */
  numberOfChannels?: number;
}

export interface AudioBridge {
  /**
   * A MediaStream carrying the engine's master output (typically from a
   * MediaStreamAudioDestinationNode). Returns `null` when the engine has
   * no audio context yet — the recorder then captures video only.
   */
  getRecordingStream(): MediaStream | null;

  /**
   * Resume the underlying AudioContext if the browser left it suspended
   * (autoplay policy). Called from the user gesture that starts a
   * recording, so captured audio is never silently muted.
   */
  ensureRunning(): Promise<void>;

  /**
   * Swap live playback for event logging — every subsequent `trigger()`
   * is queued with its sketch-time timestamp instead of producing sound.
   * The async-loop recorder calls this before stepping the first frame.
   */
  beginCapture(): void;

  /**
   * Stop logging and clear the queue. Returned for symmetry but the
   * recorder does not depend on the payload — `renderOffline()` reads
   * the same queue internally.
   */
  endCapture(): unknown;

  /**
   * Render the logged events into an `AudioBuffer` via OfflineAudioContext,
   * sample-accurate against the frame-stepped timeline.
   */
  renderOffline( opts: AudioOfflineRenderOptions ): Promise<AudioBuffer>;

  /**
   * Headless variant for the server pipeline: render the logged events
   * and return them as a base64-encoded 16-bit PCM WAV, or `null` when
   * nothing was triggered (the server then skips audio muxing entirely).
   * Playwright can't transfer an AudioBuffer out of the page; a WAV
   * string crosses the bridge and FFmpeg muxes it without re-encoding
   * the video.
   */
  renderOfflineWav?( opts: AudioOfflineRenderOptions ): Promise<string | null>;
}

declare global {
  interface Window {
    /**
     * Same bridge, exposed for the headless (Playwright) pipeline which
     * can only reach the page through `page.evaluate`. Mirrors the
     * `window.__sketchCapture` pattern used for frame capture.
     */
    __sketchAudio?: AudioBridge;
  }
}

let current: AudioBridge | null = null;

export function registerAudioBridge( bridge: AudioBridge ): void {
  current = bridge;

  if ( typeof window !== "undefined" ) {
    window.__sketchAudio = bridge;
  }
}

export function unregisterAudioBridge(): void {
  current = null;

  if ( typeof window !== "undefined" ) {
    delete window.__sketchAudio;
  }
}

export function getAudioBridge(): AudioBridge | null {
  return current;
}
