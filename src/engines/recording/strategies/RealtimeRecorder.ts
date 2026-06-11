import {
  BaseRecorder
} from "../BaseRecorder";
import {
  getAudioBridge
} from "@/lib/audioBridge";
import type {
  CaptureSource,
  RecorderHost,
  RecorderResult,
  RecorderStartOptions,
  RecordingFormat
} from "../types";

const WEBM_CODECS = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm"
];

const WEBM_AV_CODECS = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  ...WEBM_CODECS
];

const MP4_CODECS = [
  "video/mp4;codecs=avc1.42E01E",
  "video/mp4"
];

const MP4_AV_CODECS = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  ...MP4_CODECS
];

function pickMimeType(
  format: RecordingFormat, withAudio: boolean
): string {
  if ( format === "mp4" ) {
    const supported = ( withAudio ? MP4_AV_CODECS : MP4_CODECS ).find( ( type ) => MediaRecorder.isTypeSupported( type ) );

    if ( supported ) {
      return supported;
    }
  }

  const webmCodecs = withAudio ? WEBM_AV_CODECS : WEBM_CODECS;

  return (
    webmCodecs.find( ( type ) => MediaRecorder.isTypeSupported( type ) ) ||
      "video/webm"
  );
}

/**
 * Wall-clock recording strategy. Pipes the canvas captureStream into
 * MediaRecorder and assembles chunks on stop. Used for interactive /
 * non-deterministic sketches where stepping frames isn't reproducible.
 * If the sketch produces sound (audio bridge registered), its output
 * stream is mixed in so the recording carries what was heard live.
 *
 * Only `webm` (always) and `mp4` (Safari 14.1+ / Chromium 105+) are
 * available here — `gif` falls back to the deterministic strategy.
 *
 * Realtime has no known end time — the user stops it when they like.
 * The UI surfaces this with a pulsing button rather than a progress
 * fill, so we don't bother emitting per-frame progress events.
 */
export class RealtimeRecorder extends BaseRecorder {
  readonly mode = "realtime" as const;

  private mediaRecorder: MediaRecorder | null = null;
  private source: CaptureSource | null = null;
  private chunks: Blob[] = [];
  private mimeType = "";
  private resultPromise: Promise<RecorderResult> | null = null;
  private resolveResult: ( ( r: RecorderResult ) => void ) | null = null;
  private rejectResult: ( ( e: Error ) => void ) | null = null;
  private autoStopTimer: ReturnType<typeof setTimeout> | null = null;
  private hostPaused = false;
  private mirrorStarted = false;

  constructor(
    private host: RecorderHost,
    public readonly format: RecordingFormat
  ) {
    super();
  }

  async start( options: RecorderStartOptions = {} ): Promise<void> {
    if ( this._isRecording ) {
      return;
    }

    const source = this.host.getCaptureSource();

    this.source = source;

    try {
      // Start mirroring the rendered output into the stream canvas before
      // we grab it — DOM engines only paint their mirror canvas while this
      // loop is running, so the captured stream would be blank otherwise.
      source.beginRealtime();
      this.mirrorStarted = true;

      const canvas = source.getStreamCanvas();

      if ( !canvas ) {
        throw new Error( "RealtimeRecorder: capture source has no stream canvas." );
      }

      const stream = canvas.captureStream( this.host.frameRate );

      // Mix the sketch's audio output (if any) into the recording. The
      // bridge is only registered once a sketch actually produces sound,
      // so video-only sketches keep the exact previous behaviour.
      const audioBridge = getAudioBridge();
      let audioTracks: MediaStreamTrack[] = [];

      if ( audioBridge ) {
        // Resume *before* grabbing the stream — a track created on a
        // suspended context anchors its timestamps wrong and the whole
        // recording ends up with a constant A/V offset. We're inside the
        // user's "record" gesture, so resume is allowed here.
        await audioBridge.ensureRunning();

        const audioStream = audioBridge.getRecordingStream();

        audioTracks = audioStream?.getAudioTracks() ?? [];

        for ( const track of audioTracks ) {
          stream.addTrack( track );
        }
      }

      this.mimeType = pickMimeType(
        this.format,
        audioTracks.length > 0
      );

      this.mediaRecorder = new MediaRecorder(
        stream,
        {
          mimeType: this.mimeType,
          videoBitsPerSecond: options.videoBitsPerSecond ?? 15_000_000
        }
      );

      this.chunks = [];

      this.mediaRecorder.ondataavailable = ( event ) => {
        if ( event.data.size > 0 ) {
          this.chunks.push( event.data );
        }
      };

      this.resultPromise = new Promise<RecorderResult>( (
        resolve, reject
      ) => {
        this.resolveResult = resolve;
        this.rejectResult = reject;
      } );

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(
          this.chunks,
          {
            type: this.mimeType
          }
        );
        const result: RecorderResult = {
          blob,
          mimeType: this.mimeType,
          fileExtension: this.format === "mp4" ? "mp4" : "webm"
        };

        this.teardown();
        this.emit(
          "stop",
          result
        );
        this.resolveResult?.( result );
      };

      this.mediaRecorder.onerror = ( event: Event ) => {
        const error = new Error( `MediaRecorder error: ${ event.type }` );

        this.teardown();
        this.emit(
          "error",
          error
        );
        this.rejectResult?.( error );
      };

      // Pause the draw loop, jump to frame 0 + zero the time bridge, then
      // resume — MediaRecorder captures the canvas stream from the very
      // first frame of the loop, matching backend behaviour.
      this.host.pause();
      this.hostPaused = true;
      await this.host.resetToStart();

      this._isRecording = true;
      this.mediaRecorder.start( 16 );
      this.host.resume();
      this.hostPaused = false;
      this.emit(
        "start",
        undefined as never
      );

      if ( options.maxDurationMs && options.maxDurationMs > 0 ) {
        this.autoStopTimer = setTimeout(
          () => this.stop().catch( () => undefined ),
          options.maxDurationMs
        );
      }
    } catch( error ) {
      // Any failure during setup must leave the host as we found it: no
      // mirror loop spinning, no paused engine, no stale MediaRecorder.
      this.teardown();
      throw error instanceof Error ? error : new Error( String( error ) );
    }
  }

  async stop(): Promise<RecorderResult> {
    if ( !this._isRecording ) {
      // Already settled — return the existing promise (or a clean reject).
      if ( this.resultPromise ) {
        return this.resultPromise;
      }

      throw new Error( "RealtimeRecorder: not recording." );
    }

    if ( this.autoStopTimer ) {
      clearTimeout( this.autoStopTimer );
      this.autoStopTimer = null;
    }

    if ( this.mediaRecorder && this.mediaRecorder.state !== "inactive" ) {
      this.mediaRecorder.stop();
    }

    return this.resultPromise!;
  }

  cancel(): void {
    if ( !this._isRecording ) {
      return;
    }

    const recorder = this.mediaRecorder;

    if ( recorder && recorder.state !== "inactive" ) {
      // Drop the natural stop path so we don't surface a partial blob to
      // the caller.
      recorder.ondataavailable = null;
      recorder.onstop = null;
      try {
        recorder.stop();
      } catch {
        // Ignore — recorder may already be transitioning.
      }
    }

    this.chunks = [];
    this.teardown();
    this.emit(
      "cancel",
      undefined as never
    );
    this.rejectResult?.( new Error( "Recording cancelled." ) );
  }

  /**
   * Unwind every side effect of {@link start} — mirror loop, paused
   * engine, pending auto-stop. Safe to call from any code path
   * (success, failure, cancel) and idempotent.
   */
  private teardown(): void {
    this._isRecording = false;

    if ( this.autoStopTimer ) {
      clearTimeout( this.autoStopTimer );
      this.autoStopTimer = null;
    }

    if ( this.mirrorStarted ) {
      try {
        this.source?.endRealtime();
      } catch {
        // Engine teardown shouldn't mask the originating error.
      }
      this.mirrorStarted = false;
    }

    if ( this.hostPaused ) {
      try {
        this.host.resume();
      } catch {
        // Same — never throw from teardown.
      }
      this.hostPaused = false;
    }
  }
}
