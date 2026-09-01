/**
 * @jest-environment jsdom
 */

import {
  addHudElementForControl, hudQuickAddKinds
} from "../hudQuickAdd";
import {
  CONTENT_ITEM_SELECT_EVENT
} from "../../constants/drawer-events";
import type {
  FieldConfig
} from "../../components/ContentItems/constants/field-config";

const sliderConfig = {
  label: "Magnitude",
  component: "slider",
  min: 10,
  max: 360,
  step: 1
} as FieldConfig;

const colorConfig = {
  label: "Text color",
  component: "color"
} as FieldConfig;

// A minimal RHF stand-in: getValues reads a plain tree, setValue records the
// last write.
function makeForm( tree: Record<string, unknown> ) {
  const writes: Array<{ path: string;
    value: unknown; }> = [];

  const getValues = ( ( path: string ) =>
    path.split( "." ).reduce<any>(
      (
        node, key
      ) => node?.[ key ],
      tree
    ) ) as any;

  const setValue = ( (
    path: string, value: unknown
  ) => {
    writes.push( {
      path,
      value
    } );
  } ) as any;

  return {
    getValues,
    setValue,
    writes
  };
}

describe(
  "hudQuickAddKinds",
  () => {
    it(
      "offers the numeric readouts on sketch-scoped sliders and numbers",
      () => {
        expect( hudQuickAddKinds(
          "sketch.magnitude.start",
          sliderConfig
        ) ).toEqual( [
          "hud-counter",
          "hud-gauge",
          "hud-sparkline"
        ] );
        expect( hudQuickAddKinds(
          "slides.2.sketch.count",
          {
            label: "Count",
            component: "number"
          } as FieldConfig
        ) ).toHaveLength( 3 );
      }
    );

    it(
      "offers a swatch on colour fields",
      () => {
        expect( hudQuickAddKinds(
          "sketch.colors.text",
          colorConfig
        ) ).toEqual( [
          "hud-swatch"
        ] );
      }
    );

    it(
      "offers nothing outside the sketch scope or on other components",
      () => {
        // A content-item field, a canvas setting, and a vector2d sketch param
        // (crosshairs consumes canvas-pixel points, sketch vectors are
        // normalized — a misleading entry is worse than none).
        expect( hudQuickAddKinds(
          "content.0.size",
          sliderConfig
        ) ).toEqual( [] );
        expect( hudQuickAddKinds(
          "animation.duration",
          sliderConfig
        ) ).toEqual( [] );
        expect( hudQuickAddKinds(
          "sketch.position",
          {
            label: "Position",
            component: "vector2d"
          } as FieldConfig
        ) ).toEqual( [] );
      }
    );
  }
);

describe(
  "addHudElementForControl",
  () => {
    it(
      "appends a bound, range-seeded gauge to root content and reveals it",
      () => {
        const form = makeForm( {
          content: [
            {
              type: "text",
              content: "existing"
            }
          ]
        } );

        const events: Array<Record<string, unknown>> = [];
        const listener = ( event: Event ) =>
          events.push( ( event as CustomEvent ).detail );

        window.addEventListener(
          CONTENT_ITEM_SELECT_EVENT,
          listener
        );

        const path = addHudElementForControl(
          form.getValues,
          form.setValue,
          "sketch.magnitude.start",
          sliderConfig,
          "hud-gauge"
        );

        window.removeEventListener(
          CONTENT_ITEM_SELECT_EVENT,
          listener
        );

        expect( path ).toBe( "content.1" );
        expect( form.writes ).toHaveLength( 1 );
        expect( form.writes[ 0 ].path ).toBe( "content" );

        const items = form.writes[ 0 ].value as Array<Record<string, unknown>>;

        expect( items ).toHaveLength( 2 );
        expect( items[ 1 ].type ).toBe( "hud-gauge" );
        expect( items[ 1 ].source ).toBe( "magnitude.start" );
        // The gauge inherits the slider's own domain.
        expect( items[ 1 ].min ).toBe( 10 );
        expect( items[ 1 ].max ).toBe( 360 );

        expect( events ).toEqual( [
          {
            scope: "global",
            index: 1
          }
        ] );
      }
    );

    it(
      "targets the owning slide's content for slide-scoped controls",
      () => {
        const form = makeForm( {
          slides: [
            {
              content: []
            },
            {
              content: []
            }
          ]
        } );

        const path = addHudElementForControl(
          form.getValues,
          form.setValue,
          "slides.1.sketch.colors.text",
          colorConfig,
          "hud-swatch"
        );

        expect( path ).toBe( "slides.1.content.0" );
        expect( form.writes[ 0 ].path ).toBe( "slides.1.content" );

        const items = form.writes[ 0 ].value as Array<Record<string, unknown>>;

        expect( items[ 0 ].type ).toBe( "hud-swatch" );
        expect( items[ 0 ].source ).toBe( "colors.text" );
        // A swatch has no min/max to seed — nothing leaks in.
        expect( items[ 0 ] ).not.toHaveProperty( "min" );
      }
    );

    it(
      "does not seed a counter with the slider's range",
      () => {
        const form = makeForm( {
          content: []
        } );

        addHudElementForControl(
          form.getValues,
          form.setValue,
          "sketch.magnitude.start",
          sliderConfig,
          "hud-counter"
        );

        const items = form.writes[ 0 ].value as Array<Record<string, unknown>>;

        // The counter schema has no min/max fields at all; the seed must not
        // smuggle them in through the zod parse.
        expect( items[ 0 ] ).not.toHaveProperty( "min" );
        expect( items[ 0 ] ).not.toHaveProperty( "max" );
        expect( items[ 0 ].source ).toBe( "magnitude.start" );
      }
    );

    it(
      "bails on a non-sketch path",
      () => {
        const form = makeForm( {
          content: []
        } );

        expect( addHudElementForControl(
          form.getValues,
          form.setValue,
          "content.0.size",
          sliderConfig,
          "hud-gauge"
        ) ).toBeNull();
        expect( form.writes ).toHaveLength( 0 );
      }
    );
  }
);
