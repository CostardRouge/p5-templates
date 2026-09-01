/**
 * Pins what the save-defaults guard treats as an uploaded storage key (never
 * safe to commit as a shipped default) versus a portable path — mirroring
 * the exact bug that shipped an unreachable `global/images/IMG_1821.jpeg`
 * default in photo-segmentation-v2-noise-reveal.
 */
import {
  isNonPortableAssetPath, findNonPortableAssetPaths
} from "../nonPortableAssetPaths";

describe(
  "isNonPortableAssetPath",
  () => {
    it(
      "flags uploaded storage keys across every asset kind",
      () => {
        [
          "global/images/IMG_1821.jpeg",
          "global/audios/click.wav",
          "global/videos/clip.mp4",
          "slide-2/images/photo.png"
        ].forEach( ( value ) => expect( isNonPortableAssetPath( value ) ).toBe( true ) );
      }
    );

    it(
      "flags blob URLs, which are meaningless once written to disk",
      () => {
        expect( isNonPortableAssetPath( "blob:http://localhost/abc-123" ) ).toBe( true );
      }
    );

    it(
      "accepts a bundled /assets/... path",
      () => {
        expect( isNonPortableAssetPath( "/assets/images/test/DSC02023%20Medium.jpeg" ) ).toBe( false );
        expect( isNonPortableAssetPath( "assets/images/test/DSC02023%20Medium.jpeg" ) ).toBe( false );
      }
    );

    it(
      "accepts an absolute URL",
      () => {
        expect( isNonPortableAssetPath( "https://example.com/photo.jpg" ) ).toBe( false );
      }
    );

    it(
      "ignores values that are not asset paths",
      () => {
        expect( isNonPortableAssetPath( "blur" ) ).toBe( false );
        expect( isNonPortableAssetPath( 0.5 ) ).toBe( false );
        expect( isNonPortableAssetPath( true ) ).toBe( false );
        expect( isNonPortableAssetPath( null ) ).toBe( false );
        expect( isNonPortableAssetPath( "" ) ).toBe( false );
      }
    );
  }
);

describe(
  "findNonPortableAssetPaths",
  () => {
    it(
      "returns the offending path for a plain string leaf",
      () => {
        expect( findNonPortableAssetPaths( "global/images/IMG_1821.jpeg" ) ).toEqual( [
          "global/images/IMG_1821.jpeg"
        ] );
      }
    );

    it(
      "looks inside an array leaf, e.g. the asset picker's single-element array quirk",
      () => {
        expect( findNonPortableAssetPaths( [
          "global/images/IMG_1821.jpeg"
        ] ) ).toEqual( [
          "global/images/IMG_1821.jpeg"
        ] );
        expect( findNonPortableAssetPaths( [
          "/assets/images/test/a.jpeg"
        ] ) ).toEqual( [] );
      }
    );

    it(
      "returns nothing for scalars and portable paths",
      () => {
        expect( findNonPortableAssetPaths( 0.25 ) ).toEqual( [] );
        expect( findNonPortableAssetPaths( true ) ).toEqual( [] );
        expect( findNonPortableAssetPaths( "/assets/images/test/a.jpeg" ) ).toEqual( [] );
      }
    );
  }
);
