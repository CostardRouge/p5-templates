import {
  buildOgTitle,
  buildShareDescription,
  buildShareTitle,
  buildSketchDescription,
  formatSketchTitle,
  SITE_NAME
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
