import {
  BaseRecorder
} from "../BaseRecorder";
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

const MP4_CODECS = [
  "video/mp4;codecs=avc1.42E01E",
  "video/mp4"
];

function pickMimeType( format: RecordingFormat ): string {
  if ( format === "mp4" ) {
    const supported = MP4_CODECS.find( ( type ) =>
      MediaRecorder.isTypeSupported( type ) );

    if ( supported ) {
      return supported;
    }
  }

  return (
    WEBM_CODECS.find( ( type ) => MediaRecorder.isTypeSupported( type ) ) ||
      "video/webm"
  );
}

/**
 * Wall-clock recording strategy. Pipes the canvas captureStream into
 * MediaRecorder and assembles chunks on stop. Used for interactive /
 * non-deterministic sketches where stepping frames isn't reproducible.
 *
 * Only `webm` (always) and `mp4` (Safari 14.1+ / Chromium 105+) are
 * available here — `gif` falls back to the deterministic strategy.
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

    // Start mirroring the rendered output into the stream canvas before we
    // grab it — DOM engines only paint their mirror canvas while this loop
    // is running, so the captured stream would be blank otherwise.
    source.beginRealtime();

    const canvas = source.getStreamCanvas();

    if ( !canvas ) {
      source.endRealtime();
      throw new Error( "RealtimeRecorder: capture source has no stream canvas." );
    }

    this.mimeType = pickMimeType( this.format );

    const stream = canvas.captureStream( this.host.frameRate );

    this.source = source;

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

      this._isRecording = false;
      this.source?.endRealtime();
      this.emit(
        "stop",
        result
      );
      this.resolveResult?.( result );
    };

    this.mediaRecorder.onerror = ( event: Event ) => {
      const error = new Error( `MediaRecorder error: ${ event.type }` );

      this._isRecording = false;
      this.source?.endRealtime();
      this.emit(
        "error",
        error
      );
      this.rejectResult?.( error );
    };

    // Pause the draw loop, jump to frame 0 + zero the time bridge,
    // then resume drawing — MediaRecorder captures the canvas stream
    // from the very first frame of the loop, matching backend behaviour.
    this.host.pause();
    await this.host.resetToStart();

    this._isRecording = true;
    this.mediaRecorder.start( 16 );
    this.host.resume();
    this.emit(
      "start",
      undefined as any
    );

    if ( options.maxDurationMs && options.maxDurationMs > 0 ) {
      this.autoStopTimer = setTimeout(
        () => this.stop().catch( () => undefined ),
        options.maxDurationMs
      );
    }
  }

  async stop(): Promise<RecorderResult> {
    if ( !this._isRecording || !this.mediaRecorder ) {
      throw new Error( "RealtimeRecorder: not recording." );
    }

    if ( this.autoStopTimer ) {
      clearTimeout( this.autoStopTimer );
      this.autoStopTimer = null;
    }

    if ( this.mediaRecorder.state !== "inactive" ) {
      this.mediaRecorder.stop();
    }

    return this.resultPromise!;
  }

  cancel(): void {
    if ( !this._isRecording ) {
      return;
    }

    if ( this.autoStopTimer ) {
      clearTimeout( this.autoStopTimer );
      this.autoStopTimer = null;
    }

    if ( this.mediaRecorder && this.mediaRecorder.state !== "inactive" ) {
      this.mediaRecorder.ondataavailable = null;
      this.mediaRecorder.onstop = null;
      this.mediaRecorder.stop();
    }

    this.source?.endRealtime();
    this.chunks = [];
    this._isRecording = false;
    this.emit(
      "cancel",
      undefined as any
    );
    this.rejectResult?.( new Error( "Recording cancelled." ) );
  }
}
