/**
 * Tests for a button's effect: one write to the field it targets. The form is
 * a plain object behind get/set, as in the learn tests.
 */
import type {
  FieldConfig
} from "../../components/ContentItems/constants/field-config";
import {
  applyFieldEffect
} from "../fieldEffects";

function fakeForm(
  initial: Record<string, unknown> = {},
  defaults: Record<string, unknown> = {}
) {
  const store: Record<string, unknown> = {
    ...initial
  };
  const writes: string[] = [];

  return {
    store,
    writes,
    getValues: ( path: string ) => store[ path ],
    setValue: (
      path: string, value: unknown
    ) => {
      store[ path ] = value;
      writes.push( path );
    },
    getDefault: ( path: string ) => defaults[ path ]
  };
}

const SLIDER = {
  component: "slider",
  min: 10,
  max: 20,
  step: 1
} as unknown as FieldConfig;

const noConfig = () => null;

describe(
  "applyFieldEffect",
  () => {
    it(
      "set writes the value under the sketch scope",
      () => {
        const form = fakeForm();

        applyFieldEffect(
          {
            kind: "set",
            target: "rack.effect",
            value: "talkbox"
          },
          form,
          "slides.1.sketch",
          noConfig
        );

        expect( form.store[ "slides.1.sketch.rack.effect" ] ).toBe( "talkbox" );
        expect( form.writes ).toEqual( [
          "slides.1.sketch.rack.effect"
        ] );
      }
    );

    it(
      "toggle flips a boolean, and treats an unset field as off",
      () => {
        const form = fakeForm( {
          "sketch.on": true
        } );

        applyFieldEffect(
          {
            kind: "toggle",
            target: "on"
          },
          form,
          "sketch",
          noConfig
        );
        expect( form.store[ "sketch.on" ] ).toBe( false );

        applyFieldEffect(
          {
            kind: "toggle",
            target: "missing"
          },
          form,
          "sketch",
          noConfig
        );
        expect( form.store[ "sketch.missing" ] ).toBe( true );
      }
    );

    it(
      "cycle steps through the list, wraps, and lands on the first from outside it",
      () => {
        const form = fakeForm( {
          "sketch.mode": "b"
        } );
        const effect = {
          kind: "cycle" as const,
          target: "mode",
          values: [
            "a",
            "b",
            "c"
          ]
        };

        applyFieldEffect(
          effect,
          form,
          "sketch",
          noConfig
        );
        expect( form.store[ "sketch.mode" ] ).toBe( "c" );

        applyFieldEffect(
          effect,
          form,
          "sketch",
          noConfig
        );
        expect( form.store[ "sketch.mode" ] ).toBe( "a" );

        form.store[ "sketch.mode" ] = "zzz";
        applyFieldEffect(
          effect,
          form,
          "sketch",
          noConfig
        );
        expect( form.store[ "sketch.mode" ] ).toBe( "a" );
      }
    );

    it(
      "randomize draws from the TARGET's own range, found through its config",
      () => {
        const form = fakeForm();
        const seen: string[] = [];

        applyFieldEffect(
          {
            kind: "randomize",
            target: "seed"
          },
          form,
          "sketch",
          ( target ) => {
            seen.push( target );

            return SLIDER;
          }
        );

        expect( seen ).toEqual( [
          "seed"
        ] );
        const value = form.store[ "sketch.seed" ] as number;

        expect( value ).toBeGreaterThanOrEqual( 10 );
        expect( value ).toBeLessThanOrEqual( 20 );
        expect( Number.isInteger( value ) ).toBe( true );
      }
    );

    it(
      "randomize does nothing when the target has no config to draw from",
      () => {
        const form = fakeForm();

        applyFieldEffect(
          {
            kind: "randomize",
            target: "seed"
          },
          form,
          "sketch",
          noConfig
        );

        expect( form.writes ).toEqual( [] );
      }
    );

    it(
      "reset prefers the declared default, then the loaded value, then leaves the field alone",
      () => {
        const form = fakeForm(
          {
            "sketch.a": 5,
            "sketch.b": 5,
            "sketch.c": 5
          },
          {
            "sketch.b": 2
          }
        );

        applyFieldEffect(
          {
            kind: "reset",
            target: "a"
          },
          form,
          "sketch",
          () => ( {
            ...SLIDER,
            default: 17
          } as FieldConfig )
        );
        expect( form.store[ "sketch.a" ] ).toBe( 17 );

        applyFieldEffect(
          {
            kind: "reset",
            target: "b"
          },
          form,
          "sketch",
          () => SLIDER
        );
        expect( form.store[ "sketch.b" ] ).toBe( 2 );

        applyFieldEffect(
          {
            kind: "reset",
            target: "c"
          },
          form,
          "sketch",
          noConfig
        );
        // Nothing known: a write of `undefined` would be worse than no write.
        expect( form.store[ "sketch.c" ] ).toBe( 5 );
      }
    );

    it(
      "ignores an effect with no target",
      () => {
        const form = fakeForm();

        applyFieldEffect(
          {
            kind: "set",
            target: "",
            value: 1
          },
          form,
          "sketch",
          noConfig
        );

        expect( form.writes ).toEqual( [] );
      }
    );
  }
);
