import {
  buildOgTitle,
  buildShareDescription,
  buildShareTitle,
  buildSketchDescription,
  formatSketchTitle,
  getBaseUrl,
  SITE_NAME,
  SITE_URL
} from "@/lib/seo";

describe(
  "share/embed SEO helpers",
  () => {
    it(
      "formats a kebab-case sketch name as Title Case",
      () => {
        expect( formatSketchTitle( "photo-balloons" ) ).toBe( "Photo Balloons" );
      }
    );

    it(
      "marks the share title as a shared sketch",
      () => {
        expect( buildShareTitle( "Photo Balloons" ) ).toBe( "Photo Balloons — Shared Sketch" );
      }
    );

    it(
      "mentions the sketch, the site and the engine in the share description",
      () => {
        const description = buildShareDescription(
          "Photo Balloons",
          "p5.js"
        );

        expect( description ).toContain( "Photo Balloons" );
        expect( description ).toContain( SITE_NAME );
        expect( description ).toContain( "p5.js" );
      }
    );

    it(
      "keeps the share description distinct from the studio-page description",
      () => {
        const shareDescription = buildShareDescription(
          "Photo Balloons",
          "p5.js"
        );
        const studioDescription = buildSketchDescription(
          "Photo Balloons",
          "p5.js"
        );

        expect( shareDescription ).not.toBe( studioDescription );
      }
    );

    it(
      "suffixes OG titles with the site name",
      () => {
        expect( buildOgTitle( "Photo Balloons — Shared Sketch" ) ).toBe( `Photo Balloons — Shared Sketch | ${ SITE_NAME }` );
      }
    );
  }
);

/**
 * The production fallback is the whole point of this block: the statically
 * prerendered routes resolve their canonical at BUILD time, so a build with no
 * `NEXT_PUBLIC_SITE_URL` used to bake `http://localhost:3000` into the home
 * page's canonical and into every `<loc>` of `/sitemap.xml`. Losing this
 * fallback would silently de-index the site again.
 */
describe(
  "getBaseUrl",
  () => {
    const original = {
      site: process.env.NEXT_PUBLIC_SITE_URL,
      vercel: process.env.VERCEL_URL,
      node: process.env.NODE_ENV
    };

    const setNodeEnv = ( value: string ) => {
      ( process.env as Record<string, string> ).NODE_ENV = value;
    };

    beforeEach( () => {
      delete process.env.NEXT_PUBLIC_SITE_URL;
      delete process.env.VERCEL_URL;
    } );

    afterAll( () => {
      process.env.NEXT_PUBLIC_SITE_URL = original.site;
      process.env.VERCEL_URL = original.vercel;
      setNodeEnv( original.node ?? "test" );
    } );

    it(
      "falls back to the canonical domain in a production build",
      () => {
        setNodeEnv( "production" );

        expect( getBaseUrl() ).toBe( SITE_URL );
      }
    );

    it(
      "falls back to localhost outside production",
      () => {
        setNodeEnv( "development" );

        expect( getBaseUrl() ).toBe( "http://localhost:3000" );
      }
    );

    it(
      "prefers an explicit NEXT_PUBLIC_SITE_URL over both fallbacks",
      () => {
        setNodeEnv( "production" );
        process.env.NEXT_PUBLIC_SITE_URL = "https://preview.example";

        expect( getBaseUrl() ).toBe( "https://preview.example" );
      }
    );

    it(
      "uses VERCEL_URL when no explicit site url is set",
      () => {
        setNodeEnv( "production" );
        process.env.VERCEL_URL = "preview-123.vercel.app";

        expect( getBaseUrl() ).toBe( "https://preview-123.vercel.app" );
      }
    );
  }
);
