/**
 * The probe bridge's formatter — what the inspector prints for each value
 * shape — and its publish/subscribe contract.
 */

import {
  formatProbeValue, getProbesSnapshot, publishProbes, subscribeProbes
} from "../probeBridge";

describe(
  "formatProbeValue",
  () => {
    it(
      "prints each shape the way a panel reads it",
      () => {
        expect( formatProbeValue( 0.123456789 ) ).toBe( "0.1235" );
        expect( formatProbeValue(
          0.123456789,
          2
        ) ).toBe( "0.12" );
        expect( formatProbeValue( true ) ).toBe( "ON" );
        expect( formatProbeValue( false ) ).toBe( "OFF" );
        expect( formatProbeValue( "orbit" ) ).toBe( "orbit" );
        expect( formatProbeValue( {
          x: 1,
          y: 2.5
        } ) ).toBe( "1, 2.5" );
        expect( formatProbeValue( [
          255,
          0,
          128
        ] ) ).toBe( "255, 0, 128" );
        expect( formatProbeValue( undefined ) ).toBe( "—" );
        expect( formatProbeValue( Number.NaN ) ).toBe( "—" );
      }
    );
  }
);

describe(
  "publishProbes",
  () => {
    it(
      "hands every subscriber the latest snapshot and survives a throwing one",
      () => {
        const seen: number[] = [];
        const unsubscribe = subscribeProbes( ( snapshot ) => {
          seen.push( snapshot.length );
        } );
        const unsubscribeThrowing = subscribeProbes( () => {
          throw new Error( "boom" );
        } );

        publishProbes( [] );
        publishProbes( [
          {
            name: "head",
            value: 1,
            shape: "scalar",
            count: 1,
            fold: "last",
            label: null,
            unit: null,
            min: null,
            max: null,
            decimals: null
          }
        ] );

        expect( seen ).toEqual( [
          0,
          1
        ] );
        expect( getProbesSnapshot() ).toHaveLength( 1 );

        unsubscribe();
        unsubscribeThrowing();
      }
    );
  }
);
