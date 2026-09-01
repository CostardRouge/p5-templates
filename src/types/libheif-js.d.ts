/**
 * Minimal typings for the `libheif-js` WASM bundle (the package ships only
 * emscripten-generated internals). Covers the decoder surface used by
 * `src/lib/assets/exotic/normalize.ts`.
 */
declare module "libheif-js/wasm-bundle" {
  interface HeifImage {
    get_width(): number;
    get_height(): number;
    display(
      target: ImageData,
      callback: ( result: ImageData | null ) => void
    ): void;
    free(): void;
  }

  class HeifDecoder {
    decode( buffer: ArrayBuffer | Uint8Array ): HeifImage[];
  }

  const libheif: {
    HeifDecoder: typeof HeifDecoder;
    heif_get_version(): string;
  };

  export default libheif;
  export {
    HeifDecoder
  };
  export type {
    HeifImage
  };
}
