/**
 * Guards the JS <-> GLSL easing bridge used by the GPU noise-field sketches.
 *
 * The "easing" form control stores a key (e.g. "easeOutQuart"). easingGlsl.js
 * maps that key to an int (EASING_IDS) that the shader's applyEasing() switches
 * on. Three things must hold for a dropdown pick to actually change the render:
 *   1. every easing in utils/easing.js has an id,
 *   2. the ids are a clean 0..N range with no gaps or dupes,
 *   3. applyEasing() in the GLSL has a branch for every non-zero id.
 * If any drifts, the control silently falls back to linear again — exactly the
 * bug this bridge was added to fix.
 */

import easing from "../easing.js";
import {
  EASING_IDS, EASINGS_GLSL, easingId
} from "../easingGlsl.js";

describe(
  "easing id bridge",
  () => {
    const easingKeys = Object.keys( easing );
    const idKeys = Object.keys( EASING_IDS );

    it(
      "covers exactly the keys exported by utils/easing.js",
      () => {
        expect( [
          ...idKeys
        ].sort() ).toEqual( [
          ...easingKeys
        ].sort() );
      }
    );

    it(
      "assigns a contiguous, unique 0..N id range",
      () => {
        const ids = Object.values( EASING_IDS );
        const unique = new Set( ids );

        expect( unique.size ).toBe( ids.length );

        const sorted = [
          ...ids
        ].sort( (
          a, b
        ) => a - b );

        expect( sorted[ 0 ] ).toBe( 0 );

        sorted.forEach( (
          id, index
        ) => {
          expect( id ).toBe( index );
        } );
      }
    );

    it(
      "has a GLSL applyEasing branch for every non-zero id",
      () => {
        Object.values( EASING_IDS )
          .filter( ( id ) => id !== 0 )
          .forEach( ( id ) => {
            expect( EASINGS_GLSL ).toContain( `if (id == ${ id })` );
          } );
      }
    );

    it(
      "exposes linear as id 0 and falls back to it for unknown keys",
      () => {
        expect( EASING_IDS.linear ).toBe( 0 );
        expect( easingId( "linear" ) ).toEqual( {
          int: 0
        } );
        expect( easingId( "not-an-easing" ) ).toEqual( {
          int: 0
        } );
        expect( easingId( undefined as unknown as string ) ).toEqual( {
          int: 0
        } );
      }
    );

    it(
      "wraps a known key as its int-uniform payload",
      () => {
        expect( easingId( "easeOutQuart" ) ).toEqual( {
          int: EASING_IDS.easeOutQuart
        } );
      }
    );
  }
);
