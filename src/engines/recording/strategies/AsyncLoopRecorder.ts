import {
  BaseRecorder
} from "../BaseRecorder";
import {
  getAudioBridge
} from "@/lib/audioBridge";
import type {
  CaptureSource,
  FrameEncoder,
  FrameEncoderFactory,
  RecorderHost,
  RecorderResult,
  RecordingFormat
} from "../types";

/**
 * Steps the host frame-by-frame (`host.seekAndDraw(i)`) and feeds the
 * canvas pixels into a `FrameEncoder`. Reproducible output but blocks
 * the UI for the duration of the capture. Used for `gif` (only mode
 * available for that format) and for `webm`/`mp4` when the caller wants
 * exact timing rather than wall-clock.
 *
 * Lifecycle:
 *   - `start()` kicks off the capture loop in the background and resolves
 *     when the loop has been scheduled.
 *   - `stop()` resolves with the final blob once the loop + encoder
 *     finalize are both done.
 *   - `cancel()` aborts mid-loop; `stop()` will reject.
 */
export class AsyncLoopRecorder extends BaseRecorder {
  readonly mode = "async-loop" as const;

  private encoder: FrameEncoder | null = null;
  private cancelled = false;
  private runPromise: Promise<RecorderResult> | null = null;
  private hostPaused = false;
  private audioCaptureActive = false;

  constructor(
    private host: RecorderHost,
    public readonly format: RecordingFormat,
    private encoderFactory: FrameEncoderFactory
  ) {
    super();
  }

  async start(): Promise<void> {
    if ( this._isRecording ) {
      return;
    }

    const source = this.host.getCaptureSource();

    const totalFrames = this.host.totalFrames;

    if ( !Number.isFinite( totalFrames ) || totalFrames <= 0 ) {
      throw new Error( "AsyncLoopRecorder: host.totalFrames must be a positive number." );
    }

    // Reset progression FIRST so the surface reflects frame 0 before we
    // snapshot dimensions into the encoder. Otherwise a reset-triggered
    // resize would invalidate the encoder's codec string mid-recording.
    this.host.pause();
    this.hostPaused = true;

    try {
      await this.host.resetToStart();

      const {
        width, height
      } = source;

      if ( !width || !height ) {
        throw new Error( "AsyncLoopRecorder: capture source has no dimensions." );
      }

      this.encoder = this.encoderFactory( {
        width,
        height,
        frameRate: this.host.frameRate,
        totalFrames
      } );
    } catch( error ) {
      // Setup failure must not leave the host stuck in paused state.
      this.resumeHost();
      this.encoder?.dispose();
      this.encoder = null;
      throw error;
    }

    // Switch the audio engine into capture mode *before* the frame loop
    // starts. Subsequent `audio.trigger()` calls log events with the
    // sketch's deterministic time instead of producing sound, so we can
    // render them offline once every frame has been drawn. Skipped if the
    // encoder has no audio track (gif, audio codec unavailable).
    const audioBridge = getAudioBridge();

    if ( audioBridge && this.encoder?.hasAudioTrack ) {
      audioBridge.beginCapture();
      this.audioCaptureActive = true;
    }

    this.cancelled = false;
    this._isRecording = true;
    this.emit(
      "start",
      undefined as never
    );

    this.runPromise = this.run(
      source,
      totalFrames
    );

    // Swallow the rejection here — `stop()` is the one that surfaces it
    // to the caller. Without this, the unhandled rejection from an early
    // failure (e.g. immediate cancel) would taint the global handler.
    this.runPromise.catch( () => undefined );
  }

  private async run(
    source: CaptureSource,
    totalFrames: number
  ): Promise<RecorderResult> {
    try {
      for ( let frame = 0; frame < totalFrames; frame++ ) {
        if ( this.cancelled ) {
          throw new Error( "Recording cancelled." );
        }

        await this.host.seekAndDraw( frame );

        // Ensure the surface reflects this frame, then hand the resulting
        // image source to the encoder. For canvas engines this is the live
        // canvas; for DOM engines the mirror canvas is rasterised here.
        const image = await source.readFrame();

        await this.encoder!.addFrame( image );

        this.emit(
          "progress",
          {
            frame: frame + 1,
            totalFrames,
            percentage: ( ( frame + 1 ) / totalFrames ) * 100,
            stage: "capturing"
          }
        );
      }

      this.emit(
        "progress",
        {
          frame: totalFrames,
          totalFrames,
          percentage: 100,
          stage: "encoding"
        }
      );

      // Render the logged audio events into a single AudioBuffer aligned
      // with the frame loop (events past the clip duration are dropped)
      // and hand it to the encoder before finalize. Same audio voice
      // routines as live playback, so the muxed sound matches what
      // realtime recording would have captured — only now sample-accurate.
      if (
        this.audioCaptureActive &&
        this.encoder?.hasAudioTrack &&
        this.encoder.addAudioBuffer
      ) {
        const audioBridge = getAudioBridge();

        if ( audioBridge ) {
          const duration = totalFrames / this.host.frameRate;
          const audioBuffer = await audioBridge.renderOffline( {
            duration
          } );

          audioBridge.endCapture();
          this.audioCaptureActive = false;

          await this.encoder.addAudioBuffer( audioBuffer );
        }
      }

      const blob = await this.encoder!.finalize();

      if ( this.cancelled ) {
        throw new Error( "Recording cancelled." );
      }

      const result: RecorderResult = {
        blob,
        mimeType: this.encoder!.mimeType,
        fileExtension: this.encoder!.fileExtension
      };

      this.emit(
        "progress",
        {
          frame: totalFrames,
          totalFrames,
          percentage: 100,
          stage: "finalizing"
        }
      );
      this.emit(
        "stop",
        result
      );

      return result;
    } catch( error ) {
      const err = error instanceof Error ? error : new Error( String( error ) );

      if ( this.cancelled ) {
        this.emit(
          "cancel",
          undefined as never
        );
      } else {
        this.emit(
          "error",
          err
        );
      }

      throw err;
    } finally {
      // Always exit capture mode — leaving it on would silence the next
      // interactive session as `trigger()` would keep logging instead of
      // playing.
      if ( this.audioCaptureActive ) {
        getAudioBridge()?.endCapture();
        this.audioCaptureActive = false;
      }

      this._isRecording = false;
      this.encoder?.dispose();
      this.encoder = null;
      this.resumeHost();
    }
  }

  stop(): Promise<RecorderResult> {
    if ( !this.runPromise ) {
      return Promise.reject( new Error( "AsyncLoopRecorder: stop() called before start()." ) );
    }

    return this.runPromise;
  }

  cancel(): void {
    if ( !this._isRecording ) {
      return;
    }

    this.cancelled = true;
  }

  private resumeHost(): void {
    if ( !this.hostPaused ) {
      return;
    }
    this.hostPaused = false;
    try {
      this.host.resume();
    } catch {
      // Resuming should never throw, but if it does we don't want to
      // mask the original error from `run`.
    }
  }
}
