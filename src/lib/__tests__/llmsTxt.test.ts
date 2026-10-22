import sitemap from "@/app/sitemap";
import {
  GET
} from "@/app/llms.txt/route";
import {
  STUDIO_FEATURES
} from "@/components/StudioFeatures/features";
import {
  getMetadata,
  listIndexableSketches
} from "@/engines/metadata";
import {
  buildLlmsTxt
} from "@/lib/llmsTxt";
import {
  buildCanonicalPath,
  getBaseUrl
} from "@/lib/seo";

/** Every `(url)` of a `- [title](url)` line. */
function linksOf( text: string ): string[] {
  return [
    ...text.matchAll( /^- \[[^\]]+\]\(([^)]+)\)/gm )
  ].map( ( match ) => match[ 1 ] );
}

function setNodeEnv( value: string ) {
  ( process.env as Record<string, string> ).NODE_ENV = value;
}

describe(
  "/llms.txt",
  () => {
    const baseUrl = getBaseUrl();
    const text = buildLlmsTxt( {
      baseUrl,
      sketches: listIndexableSketches(),
      features: STUDIO_FEATURES
    } );

    it(
      "has the llmstxt.org shape: one H1, a summary blockquote, sections of links",
      () => {
        const lines = text.split( "\n" );

        expect( lines[ 0 ] ).toBe( "# Sketchbook" );
        expect( lines.filter( ( line ) => line.startsWith( "# " ) ) ).toHaveLength( 1 );
        expect( lines[ 2 ].startsWith( "> " ) ).toBe( true );
        expect( text ).toContain( "\n## Pages\n" );
        expect( text ).toContain( "\n## The studio\n" );
        expect( text ).toMatch( /\n## Sketches \(\d+\)\n/ );
      }
    );

    it(
      "links only URLs the sitemap submits (a tour anchor counts as the home page)",
      async() => {
        const submitted = new Set( ( await sitemap() ).map( ( entry ) => entry.url ) );
        const links = linksOf( text );

        expect( links.length ).toBeGreaterThan( 0 );

        for ( const link of links ) {
          const page = link.split( "#" )[ 0 ].replace(
            /\/$/,
            ""
          );

          expect( submitted.has( page ) ).toBe( true );
        }
      }
    );

    it(
      "lists every indexable sketch exactly once, and says how many",
      () => {
        const sketches = listIndexableSketches();
        const links = linksOf( text );

        expect( text ).toContain( `## Sketches (${ sketches.length })` );

        for ( const sketch of sketches ) {
          const url = `${ baseUrl }${ buildCanonicalPath(
            sketch.engine,
            sketch.name,
            sketch.category
          ) }`;

          expect( links.filter( ( link ) => link === url ) ).toHaveLength( 1 );
        }
      }
    );

    it(
      "names every section of the home page's studio tour by its anchor",
      () => {
        for ( const feature of STUDIO_FEATURES ) {
          expect( linksOf( text ) ).toContain( `${ baseUrl }/#${ feature.id }` );
        }
      }
    );

    it(
      "leaves out the sketches the site hides, in a production build",
      () => {
        const previous = process.env.NODE_ENV ?? "test";

        setNodeEnv( "production" );

        try {
          const hidden = getMetadata().filter( ( m ) => m.hiddenFromGallery );
          const productionLinks = linksOf( buildLlmsTxt( {
            baseUrl,
            sketches: listIndexableSketches(),
            features: STUDIO_FEATURES
          } ) );

          for ( const sketch of hidden ) {
            expect( productionLinks ).not.toContain( `${ baseUrl }${ buildCanonicalPath(
              sketch.engine,
              sketch.name,
              sketch.category
            ) }` );
          }
        } finally {
          setNodeEnv( previous );
        }
      }
    );

    it(
      "is served as plain text by the route",
      async() => {
        const response = GET();

        expect( response.headers.get( "Content-Type" ) ).toBe( "text/plain; charset=utf-8" );
        expect( await response.text() ).toBe( text );
      }
    );
  }
);
