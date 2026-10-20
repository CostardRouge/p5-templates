import path from "path";
import sharp from "sharp";
import manifest from "@/app/manifest";

/**
 * The icon set a page of the portfolio ships (COMMON-PROJECT-SPEC C11): every
 * file the manifest and the document head declare exists at the size it
 * claims, and the two kinds that must be opaque are — a maskable icon because
 * an Android launcher clips anything else, the Apple touch icon because iOS
 * paints transparency black under its own mask. Nothing else checks this: a
 * wrong file looks right in every desktop tab and shows up on a phone only.
 * `scripts/gen-icons.mjs` draws the favicons and the touch icon.
 */
const publicDir = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "public"
);

async function describeIcon( src: string ) {
  const {
    width, height, hasAlpha
  } = await sharp( path.join(
    publicDir,
    src
  ) ).metadata();

  return {
    width,
    height,
    hasAlpha
  };
}

function parseSize( sizes: string ) {
  const match = /^(\d+)x(\d+)$/.exec( sizes );

  if ( !match ) {
    throw new Error( `unreadable sizes "${ sizes }"` );
  }

  return {
    width: Number( match[ 1 ] ),
    height: Number( match[ 2 ] )
  };
}

describe(
  "the icon set",
  () => {
    it(
      "ships every manifest icon at its declared size, the maskable ones opaque",
      async() => {
        const icons = manifest().icons ?? [];

        expect( icons.length ).toBeGreaterThanOrEqual( 4 );

        for ( const icon of icons ) {
          const expected = parseSize( icon.sizes ?? "" );
          const actual = await describeIcon( String( icon.src ) );

          expect( actual ).toMatchObject( expected );

          if ( String( icon.purpose ).includes( "maskable" ) ) {
            expect( actual.hasAlpha ).toBe( false );
          }
        }
      }
    );

    it(
      "ships an opaque 180 × 180 apple-touch-icon",
      async() => {
        expect( await describeIcon( "/apple-touch-icon.png" ) ).toEqual( {
          width: 180,
          height: 180,
          hasAlpha: false
        } );
      }
    );

    it(
      "ships the 16 and 32 px raster favicons",
      async() => {
        for ( const size of [
          16,
          32
        ] ) {
          expect( await describeIcon( `/favicon-${ size }.png` ) ).toMatchObject( {
            width: size,
            height: size
          } );
        }
      }
    );
  }
);
