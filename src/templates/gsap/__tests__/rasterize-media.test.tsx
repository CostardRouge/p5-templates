/**
 * @jest-environment jsdom
 */

/**
 * Unit tests for the rasterisation media-inlining fix.
 *
 * An SVG `<foreignObject>` rendered as an image cannot fetch external
 * resources, so `<img>`/`background-image` URLs must be embedded as data-URLs
 * before serialisation — otherwise captures/recordings show the broken-image
 * glyph instead of the photos. `inlineMediaInto` performs that rewrite.
 */
import {
  inlineMediaInto
} from "@/gsap/utils/runtime";

const DATA_URL = "data:image/jpeg;base64,AAAA";

function fakeLoader( map: Record<string, string | null> ) {
  return jest.fn( ( url: string ): Promise<string | null> =>
    Promise.resolve( url in map ? map[ url ] : DATA_URL ) );
}

describe(
  "inlineMediaInto",
  () => {
    it(
      "rewrites external <img> sources to data-URLs",
      async() => {
        const root = document.createElement( "div" );

        root.innerHTML =
          "<img src=\"http://localhost/assets/images/test/a.jpg\" />" +
          "<img src=\"http://localhost/assets/images/test/b.jpg\" />";

        const load = fakeLoader( {} );

        await inlineMediaInto(
          root,
          load
        );

        const sources = Array.from( root.querySelectorAll( "img" ) ).map( ( img ) =>
          img.getAttribute( "src" ) );

        expect( sources ).toEqual( [
          DATA_URL,
          DATA_URL
        ] );
        expect( load ).toHaveBeenCalledTimes( 2 );
      }
    );

    it(
      "rewrites inline background-image url() references",
      async() => {
        const root = document.createElement( "div" );
        const child = document.createElement( "div" );

        child.style.backgroundImage =
          "url(\"http://localhost/assets/images/test/c.jpg\")";
        root.appendChild( child );

        await inlineMediaInto(
          root,
          fakeLoader( {} )
        );

        expect( child.style.backgroundImage ).toBe( `url("${ DATA_URL }")` );
      }
    );

    it(
      "leaves existing data-URLs and missing sources untouched",
      async() => {
        const root = document.createElement( "div" );

        root.innerHTML =
          `<img src="${ DATA_URL }" />` +
          "<img />";

        const load = fakeLoader( {} );

        await inlineMediaInto(
          root,
          load
        );

        const sources = Array.from( root.querySelectorAll( "img" ) ).map( ( img ) =>
          img.getAttribute( "src" ) );

        expect( sources ).toEqual( [
          DATA_URL,
          null
        ] );
        expect( load ).not.toHaveBeenCalled();
      }
    );

    it(
      "keeps the original src when the loader fails (returns null)",
      async() => {
        const root = document.createElement( "div" );
        const url = "http://localhost/assets/images/test/d.jpg";

        root.innerHTML = `<img src="${ url }" />`;

        await inlineMediaInto(
          root,
          fakeLoader( {
            [ url ]: null
          } )
        );

        expect( root.querySelector( "img" )?.getAttribute( "src" ) ).toBe( url );
      }
    );

    it(
      "hoists a background-image shared by 2+ elements into one CSS variable",
      async() => {
        const root = document.createElement( "div" );
        const url = "http://localhost/assets/images/test/grid.jpg";

        // Three tiles all painted from the same photo (the mosaic/grid case).
        for ( let i = 0; i < 3; i++ ) {
          const tile = document.createElement( "div" );

          tile.style.backgroundImage = `url("${ url }")`;
          root.appendChild( tile );
        }

        const load = fakeLoader( {} );

        await inlineMediaInto(
          root,
          load
        );

        // The photo is fetched once, not once per tile.
        expect( load ).toHaveBeenCalledTimes( 1 );

        // Its data-URL lives in a single custom property on the root…
        expect( root.style.getPropertyValue( "--media-0" ) ).toBe( `url("${ DATA_URL }")` );

        // …and every tile references it via var() instead of duplicating it.
        const tiles = Array.from( root.children ) as HTMLElement[];

        for ( const tile of tiles ) {
          expect( tile.style.backgroundImage ).toBe( "var(--media-0)" );
        }
      }
    );
  }
);
