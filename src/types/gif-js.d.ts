declare module "gif.js" {
  type GifOptions = {
    workers?: number;
    workerScript?: string;
    quality?: number;
    width?: number;
    height?: number;
    repeat?: number;
    background?: string;
    transparent?: string | null;
    dither?: boolean | string;
    debug?: boolean;
  };

  type AddFrameOptions = {
    delay?: number;
    copy?: boolean;
    dispose?: number;
  };

  type GifEvent = "start" | "progress" | "finished" | "abort";

  export default class GIF {
    constructor( options?: GifOptions );
    addFrame(
      image: CanvasImageSource | CanvasRenderingContext2D,
      options?: AddFrameOptions,
    ): void;
    on( event: "progress", handler: ( progress: number ) => void ): void;
    on( event: "finished", handler: ( blob: Blob ) => void ): void;
    on( event: Exclude<GifEvent, "progress" | "finished">, handler: () => void ): void;
    render(): void;
    abort(): void;
  }
}
