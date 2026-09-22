/**
 * `braidShadingGlsl` is composed into some twenty fragments. Its `look`
 * opt-in must be invisible to every sketch that does not ask for it — a
 * leaked uniform or branch would change their GLSL without anyone noticing,
 * since a shader is a string to the build — and complete for the ones that do.
 */
import {
  braidShadingGlsl
} from "@/p5/utils/braidShader.js";

const LOOK_UNIFORMS = [
  "uLook",
  "uFringeWidth",
  "uFringeGlow",
  "uFringeBody"
];

describe(
  "braidShadingGlsl look opt-in",
  () => {
    it(
      "is off by default, and off is the same chunk as look: false",
      () => {
        const chunk = braidShadingGlsl();

        expect( chunk ).toBe( braidShadingGlsl( {
          look: false
        } ) );

        for ( const name of LOOK_UNIFORMS ) {
          expect( chunk ).not.toContain( name );
        }
        expect( chunk ).not.toContain( "uLook == 1" );
      }
    );

    it(
      "declares each look uniform exactly once and branches shade() on it when asked",
      () => {
        const chunk = braidShadingGlsl( {
          look: true
        } );

        for ( const name of LOOK_UNIFORMS ) {
          const declared = chunk.match( new RegExp(
            `uniform\\s+(int|float)\\s+${ name };`,
            "g"
          ) ) ?? [];

          expect( declared ).toHaveLength( 1 );
        }
        expect( chunk ).toContain( "if (uLook == 1) {" );
        expect( chunk.indexOf( "if (uLook == 1) {" ) ).toBeGreaterThan( chunk.indexOf( "vec3 base = iridescent(" ) );
        expect( chunk.indexOf( "if (uLook == 1) {" ) ).toBeLessThan( chunk.indexOf( "float ao = calcAO(" ) );
      }
    );

    it(
      "keeps the other parameters independent of the look",
      () => {
        const chunk = braidShadingGlsl( {
          maxSteps: 64,
          surfEps: 0.002,
          look: true
        } );

        expect( chunk ).toContain( "const float SURF_EPS = 0.0020;" );
        expect( chunk ).toContain( "for (int i = 0; i < 64; i++)" );
      }
    );
  }
);
