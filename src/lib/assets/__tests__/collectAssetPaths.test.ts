/**
 * Unit tests for the shared image-path collector. It is shared precisely so
 * the engine's loading plan and the p5 loader agree on what counts as an
 * image — a disagreement here would make the progress bar target a total it
 * can never reach, so the edge cases are worth pinning down.
 */
import {
  isImagePath, collectImagePathsDeep, collectSketchImagePaths
} from "../collectAssetPaths";

describe(
  "isImagePath",
  () => {
    it(
      "accepts every extension the loader handles, case-insensitively",
      () => {
        [
          "a.png",
          "a.jpg",
          "a.jpeg",
          "a.webp",
          "a.gif",
          "a.svg",
          "a.avif",
          "a.bmp",
          "a.arw",
          "A.JPG"
        ].forEach( ( path ) => expect( isImagePath( path ) ).toBe( true ) );
      }
    );

    it(
      "looks past a query string or hash",
      () => {
        expect( isImagePath( "/assets/a.png?v=2" ) ).toBe( true );
        expect( isImagePath( "/assets/a.png#frag" ) ).toBe( true );
      }
    );

    it(
      "accepts blob URLs, which carry no extension",
      () => {
        expect( isImagePath( "blob:http://localhost/abc-123" ) ).toBe( true );
      }
    );

    it(
      "rejects non-images, empty strings and non-strings",
      () => {
        expect( isImagePath( "clip.mp4" ) ).toBe( false );
        expect( isImagePath( "click.wav" ) ).toBe( false );
        expect( isImagePath( "" ) ).toBe( false );
        expect( isImagePath( null ) ).toBe( false );
        expect( isImagePath( 42 ) ).toBe( false );
      }
    );
  }
);

describe(
  "collectImagePathsDeep",
  () => {
    it(
      "walks nested objects and arrays, ignoring everything else",
      () => {
        const found = collectImagePathsDeep( {
          photo: {
            image: "a.png"
          },
          stack: [
            "b.jpg",
            {
              nested: "c.webp"
            }
          ],
          label: "not an image",
          count: 3
        } );

        expect( found ).toEqual( [
          "a.png",
          "b.jpg",
          "c.webp"
        ] );
      }
    );

    it(
      "de-duplicates while keeping encounter order",
      () => {
        expect( collectImagePathsDeep( [
          "a.png",
          "b.png",
          "a.png"
        ] ) ).toEqual( [
          "a.png",
          "b.png"
        ] );
      }
    );
  }
);

describe(
  "collectSketchImagePaths",
  () => {
    it(
      "unions global assets, sketch fields and every slide, deduped",
      () => {
        const found = collectSketchImagePaths( {
          assets: {
            images: [
              "global.png"
            ]
          },
          sketch: {
            photo: "sketch.jpg"
          },
          slides: [
            {
              assets: {
                images: [
                  "slide-a.png"
                ]
              },
              sketch: {
                photo: "slide-sketch.webp"
              }
            },
            // a repeat across slides must not be counted twice
            {
              assets: {
                images: [
                  "global.png"
                ]
              }
            }
          ]
        } );

        expect( found ).toEqual( [
          "global.png",
          "sketch.jpg",
          "slide-a.png",
          "slide-sketch.webp"
        ] );
      }
    );

    it(
      "is safe on empty, partial and missing options",
      () => {
        expect( collectSketchImagePaths( {} ) ).toEqual( [] );
        expect( collectSketchImagePaths( null ) ).toEqual( [] );
        expect( collectSketchImagePaths( undefined ) ).toEqual( [] );
        expect( collectSketchImagePaths( {
          slides: [
            null,
            undefined
          ]
        } ) ).toEqual( [] );
      }
    );
  }
);
