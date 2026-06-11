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
 *   3. Engine calls `unregisterAudioBridge()` on teardown (optional).
 */

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
}

let current: AudioBridge | null = null;

export function registerAudioBridge( bridge: AudioBridge ): void {
  current = bridge;
}

export function unregisterAudioBridge(): void {
  current = null;
}

export function getAudioBridge(): AudioBridge | null {
  return current;
}
