/**
 * @jest-environment jsdom
 */
/**
 * A binding that stops playing must take its meter with it: switching to a
 * slide whose bindings differ used to leave the previous slide's `--bind-*`
 * vars frozen at their last value.
 */
import {
  publishBindingSignals
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
