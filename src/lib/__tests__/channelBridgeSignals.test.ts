/**
 * @jest-environment jsdom
 */
/**
 * A binding that stops playing must take its meter with it: switching to a
 * slide whose bindings differ used to leave the previous slide's `--bind-*`
 * vars frozen at their last value.
 */
import {
  type BindingValue,
  publishBindingSignals,
  publishBindingValues,
  subscribeBindingValues,
  getBindingValues
} from "../channelBridge";

function bindVar( name: string ): string {
  return document.documentElement.style.getPropertyValue( name );
}

describe(
  "publishBindingSignals",
  () => {
    afterEach( () => {
      publishBindingSignals( {} );
    } );

    it(
      "writes each signal, clamped, under its target's var",
      () => {
        publishBindingSignals( {
          "grid.rows": 0.25,
          "grid.columns": 4
        } );

        expect( bindVar( "--bind-grid-rows" ) ).toBe( "0.25" );
        expect( bindVar( "--bind-grid-columns" ) ).toBe( "1" );
      }
    );

    it(
      "removes the vars of bindings no longer published",
      () => {
        publishBindingSignals( {
          "grid.rows": 0.5,
          "root-1": 0.5
        } );
        publishBindingSignals( {
          "grid.columns": 0.75
        } );

        expect( bindVar( "--bind-grid-rows" ) ).toBe( "" );
        expect( bindVar( "--bind-root-1" ) ).toBe( "" );
        expect( bindVar( "--bind-grid-columns" ) ).toBe( "0.75" );
      }
    );

    it(
      "clears every var when nothing plays",
      () => {
        publishBindingSignals( {
          "grid.rows": 0.5
        } );
        publishBindingSignals( {} );

        expect( bindVar( "--bind-grid-rows" ) ).toBe( "" );
      }
    );

    it(
      "leaves vars it never wrote alone",
      () => {
        document.documentElement.style.setProperty(
          "--ch-mouse",
          "0.3"
        );
        publishBindingSignals( {
          "grid.rows": 0.5
        } );
        publishBindingSignals( {} );

        expect( bindVar( "--ch-mouse" ) ).toBe( "0.3" );
      }
    );
  }
);

describe(
  "publishBindingValues",
  () => {
    afterEach( () => {
      publishBindingValues( {} );
    } );

    it(
      "writes the resolved value unclamped, under its own var, beside the signal",
      () => {
        publishBindingSignals( {
          "grid.rows": 0.5
        } );
        publishBindingValues( {
          "grid.rows": 287.5
        } );

        expect( bindVar( "--binding-value-grid-rows" ) ).toBe( "287.5" );
        expect( bindVar( "--bind-grid-rows" ) ).toBe( "0.5" );
        publishBindingSignals( {} );
      }
    );

    it(
      "removes the var of a target that is no longer driven",
      () => {
        publishBindingValues( {
          "grid.rows": 120,
          palette: 2
        } );
        publishBindingValues( {
          palette: 3
        } );

        expect( bindVar( "--binding-value-grid-rows" ) ).toBe( "" );
        expect( bindVar( "--binding-value-palette" ) ).toBe( "3" );
      }
    );

    it(
      "writes a colour as an rgb() plus its alpha, and a pad as two axis vars",
      () => {
        publishBindingValues( {
          backgroundColor: [
            255,
            128,
            0,
            51
          ],
          orientation: {
            x: 0.25,
            y: -0.5
          }
        } );

        expect( bindVar( "--binding-value-backgroundColor" ) ).toBe( "rgb(255 128 0 / 0.2)" );
        expect( bindVar( "--binding-value-backgroundColor-a" ) ).toBe( "0.2" );
        expect( bindVar( "--binding-value-orientation-x" ) ).toBe( "0.25" );
        expect( bindVar( "--binding-value-orientation-y" ) ).toBe( "-0.5" );
        expect( bindVar( "--binding-value-orientation-z" ) ).toBe( "" );

        publishBindingValues( {
          light: {
            x: 1,
            y: 2,
            z: -3
          }
        } );

        expect( bindVar( "--binding-value-light-z" ) ).toBe( "-3" );

        // Every part goes with its target.
        publishBindingValues( {} );

        expect( bindVar( "--binding-value-backgroundColor" ) ).toBe( "" );
        expect( bindVar( "--binding-value-backgroundColor-a" ) ).toBe( "" );
        expect( bindVar( "--binding-value-orientation-x" ) ).toBe( "" );
      }
    );

    it(
      "hands every publish to subscribers until they unsubscribe",
      () => {
        const seen: Array<Record<string, BindingValue>> = [];
        const unsubscribe = subscribeBindingValues( ( values ) => {
          seen.push( values );
        } );

        publishBindingValues( {
          seed: 512
        } );
        unsubscribe();
        publishBindingValues( {
          seed: 600
        } );

        expect( seen ).toEqual( [
          {
            seed: 512
          }
        ] );
        expect( getBindingValues() ).toEqual( {
          seed: 600
        } );
      }
    );
  }
);
