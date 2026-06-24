/**
 * Input-boundary regression tests for the duration setting.
 *
 * Two defects lived here:
 *  1. The duration slider allowed `min: 0`, but the schema is `.min(1)`; a 0
 *     slipped through `watch()` un-validated and tripped the downstream
 *     `duration || default` fallbacks.
 *  2. `initOptions` wraps the WHOLE schema in `.catch`, so a single invalid
 *     value (e.g. duration 0) reverted the entire `animation` sub-object to
 *     defaults — silently snapping framerate back too. Leaf-level `.catch`
 *     now heals each field independently.
 */

import {
  SketchAnimationSchema, OptionsSchema
} from "@/types/sketch.types";
import {
  DURATION_DEFAULT, FRAMERATE_DEFAULT
} from "@/lib/animationConfig";
import initOptions from "@/utils/initOptions";
import rootFormConfig from "@/components/ClientProcessingSketch/components/TemplateOptions/components/RootSettings/constants/root-field-config";

describe(
  "duration slider ↔ schema invariant",
  () => {
    test(
      "the slider's minimum is not below the schema's minimum (1)",
      () => {
        // `animation` is a nested-object field; reach its `duration` sub-field.
        const animation = rootFormConfig.animation as {
          fields?: Record<string, { component?: string;
            min?: number }>;
        };
        const durationField = animation.fields?.duration;

        expect( durationField?.component ).toBe( "slider" );
        // Schema floor is 1; the slider must not let the user pick below it.
        expect( durationField?.min ).toBeGreaterThanOrEqual( 1 );
      }
    );
  }
);

describe(
  "SketchAnimationSchema self-heals per field",
  () => {
    test(
      "a 0 duration heals to the default WITHOUT dropping a valid framerate",
      () => {
        const parsed = SketchAnimationSchema.parse( {
          duration: 0,
          framerate: 30
        } );

        expect( parsed.duration ).toBe( DURATION_DEFAULT );
        expect( parsed.framerate ).toBe( 30 ); // sibling preserved, not reset to 60
      }
    );

    test(
      "numeric strings are coerced",
      () => {
        expect( SketchAnimationSchema.parse( {
          duration: "4",
          framerate: "30"
        } ) ).toEqual( {
          duration: 4,
          framerate: 30
        } );
      }
    );

    test(
      "out-of-range values heal to the default",
      () => {
        expect( SketchAnimationSchema.parse( {
          duration: 9999,
          framerate: 9999
        } ) ).toEqual( {
          duration: DURATION_DEFAULT,
          framerate: FRAMERATE_DEFAULT
        } );
      }
    );

    test(
      "a partial block keeps the present value and defaults the absent one",
      () => {
        expect( SketchAnimationSchema.parse( {
          framerate: 30
        } ) ).toEqual( {
          duration: DURATION_DEFAULT,
          framerate: 30
        } );
      }
    );
  }
);

describe(
  "initOptions does not nuke siblings on one bad field",
  () => {
    test(
      "an invalid duration heals but framerate survives",
      () => {
        const result = initOptions( {
          animation: {
            duration: 0,
            framerate: 30
          }
        } );

        expect( result.animation.framerate ).toBe( 30 );
        expect( result.animation.duration ).toBe( DURATION_DEFAULT );
      }
    );

    test(
      "a valid duration round-trips untouched",
      () => {
        const result = initOptions( {
          animation: {
            duration: 4,
            framerate: 30
          }
        } );

        expect( result.animation.duration ).toBe( 4 );
        expect( result.animation.framerate ).toBe( 30 );
      }
    );

    test(
      "OptionsSchema top-level default matches the shared constants",
      () => {
        const defaults = OptionsSchema.parse( {} );

        expect( defaults.animation ).toEqual( {
          duration: DURATION_DEFAULT,
          framerate: FRAMERATE_DEFAULT
        } );
      }
    );
  }
);
