import {
  BaseRecorder
} from "../BaseRecorder";
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

    this.cancelled = false;
    this._isRecording = true;
    this.emit(
      "start",
      undefined as any
    );

    this.runPromise = this.run(
      source,
      totalFrames
    );
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
          undefined as any
        );
      } else {
        this.emit(
          "error",
          err
        );
      }

      throw err;
    } finally {
      this._isRecording = false;
      this.encoder?.dispose();
      this.encoder = null;
      this.host.resume();
    }
  }

  stop(): Promise<RecorderResult> {
    if ( !this.runPromise ) {
      throw new Error( "AsyncLoopRecorder: stop() called before start()." );
    }

    return this.runPromise;
  }

  cancel(): void {
    if ( !this._isRecording ) {
      return;
    }

    this.cancelled = true;
  }
}
