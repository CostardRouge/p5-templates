import type {
  CaptureSource
} from "./types";

/**
 * Default `CaptureSource` for engines that render straight into a live
 * `<canvas>` (p5.js, three.js, …).
 *
 * The canvas is already painted by the engine's own draw loop, so
 * `readFrame()` is an identity op and the realtime mirror hooks are no-ops.
 * Dimensions are read lazily from the canvas so a mid-init resize is
 * reflected the first time the recorder asks.
 */
export function createCanvasCaptureSource( getCanvas: () => HTMLCanvasElement | null ): CaptureSource {
  const requireCanvas = (): HTMLCanvasElement => {
    const canvas = getCanvas();

    if ( !canvas ) {
      throw new Error( "CaptureSource: no canvas available." );
    }

    return canvas;
  };

  return {
    get width() {
      return getCanvas()?.width ?? 0;
    },
    get height() {
      return getCanvas()?.height ?? 0;
    },
    getStreamCanvas: () => getCanvas(),
    readFrame: async() => requireCanvas(),
    beginRealtime: () => undefined,
    endRealtime: () => undefined
  };
}
