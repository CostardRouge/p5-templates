// gif.js ships UMD without types — declared in @/types/gif-js.d.ts
import GIF from "gif.js";
import type {
  FrameEncoder,
  FrameEncoderFactory
} from "../types";

/**
 * gif.js-backed deterministic GIF encoder. Worker script is served from
 * `/public/gif.worker.js` (copied at install time).
 *
 * One frame per `host.frameRate` tick; delay rounded to nearest 10ms
 * because gif.js stores delays in centiseconds.
 */
class GifEncoder implements FrameEncoder {
  readonly format = "gif" as const;
  readonly mimeType = "image/gif";
  readonly fileExtension = "gif";

  private gif: any;
  private frameDelayMs: number;

  constructor( params: {
    width: number;
    height: number;
    frameRate: number;
  } ) {
    this.gif = new GIF( {
      workers: 4,
      quality: 10,
      width: params.width,
      height: params.height,
      workerScript: "/gif.worker.js"
    } );
    this.frameDelayMs = Math.round( 1000 / params.frameRate );
  }

  async addFrame( source: CanvasImageSource ): Promise<void> {
    this.gif.addFrame(
      source,
      {
        copy: true,
        delay: this.frameDelayMs
      }
    );
  }

  finalize(): Promise<Blob> {
    return new Promise<Blob>( (
      resolve, reject
    ) => {
      this.gif.on(
        "finished",
        ( blob: Blob ) => resolve( blob )
      );
      this.gif.on(
        "abort",
        () => reject( new Error( "GIF encoding aborted." ) )
      );
      this.gif.render();
    } );
  }

  dispose(): void {
    this.gif?.abort?.();
    this.gif = null;
  }
}

export const createGifEncoderFactory = (): FrameEncoderFactory => {
  return ( params ) =>
    new GifEncoder( {
      width: params.width,
      height: params.height,
      frameRate: params.frameRate
    } );
};
