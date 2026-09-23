/**
 * The "probe:<name>" source family — the pure helpers the HUD runtime and the
 * source picker share to tell a probe apart from a built-in or a key-path.
 */

import {
  PROBE_SOURCE_PREFIX, isProbeSource, probeSourceId, probeSourceName
} from "../keyPaths.js";

describe(
  "probe sources",
  () => {
    it(
      "round-trips a name through its source id",
      () => {
        expect( probeSourceId( "arc.t" ) ).toBe( "probe:arc.t" );
        expect( probeSourceName( "probe:arc.t" ) ).toBe( "arc.t" );
        expect( PROBE_SOURCE_PREFIX ).toBe( "probe:" );
      }
    );

    it(
      "recognises only the prefixed form",
      () => {
        expect( isProbeSource( "probe:head" ) ).toBe( true );
        expect( isProbeSource( "head" ) ).toBe( false );
        expect( isProbeSource( "magnitude.start" ) ).toBe( false );
        expect( isProbeSource( undefined ) ).toBe( false );
        expect( isProbeSource( 3 ) ).toBe( false );
      }
    );
  }
);
