/**
 * Keystone regression test for duration/framerate resolution.
 *
 * The "setting duration doesn't work" bug was a divergence of DEFAULTS: the
 * server encode loop used `duration || 5`, the in-page p5 clock used `|| 10`,
 * the engines used `?? 12`, and the progression bar used `?? 10` + Math.floor.
 * They only agreed for a present, positive number; for a missing/zero duration
 * the recorded frame count and the clock's loop length disagreed, so the clip
 * was the wrong length and cut off partway.
 *
 * This locks every path to ONE resolver + ONE default, and — crucially —
 * asserts the recording-length invariant that the bug violated:
 *
 *     totalFramesFor(a) / resolveAnimation(a).framerate === resolveAnimation(a).duration
 *
 * i.e. the encoded video length (seconds) always equals the clock's loop length
 * for the SAME animation, for every input shape.
 */

import {
  DURATION_DEFAULT,
  FRAMERATE_DEFAULT,
  resolveAnimation,
  totalFramesFor
} from "@/lib/animationConfig";
import {
  getEffectiveSlideSettings
} from "@/lib/effectiveSlideSettings";

describe(
  "resolveAnimation",
  () => {
    test(
      "present positive numbers pass through unchanged",
      () => {
        expect( resolveAnimation( {
          duration: 4,
          framerate: 30
        } ) ).toEqual( {
          duration: 4,
          framerate: 30
        } );
      }
    );

    test(
      "missing block → shared defaults",
      () => {
        expect( resolveAnimation( undefined ) ).toEqual( {
          duration: DURATION_DEFAULT,
          framerate: FRAMERATE_DEFAULT
        } );
        expect( resolveAnimation( {} ) ).toEqual( {
          duration: DURATION_DEFAULT,
          framerate: FRAMERATE_DEFAULT
        } );
      }
    );

    test(
      "partial block keeps the present value, defaults the absent one",
      () => {
        expect( resolveAnimation( {
          framerate: 30
        } ) ).toEqual( {
          duration: DURATION_DEFAULT,
          framerate: 30
        } );
      }
    );

    test(
      "falsy 0 clamps to the default (NOT silently a different default)",
      () => {
        expect( resolveAnimation( {
          duration: 0,
          framerate: 0
        } ) ).toEqual( {
          duration: DURATION_DEFAULT,
          framerate: FRAMERATE_DEFAULT
        } );
      }
    );

    test(
      "numeric strings are coerced (z.coerce + watch() can leak strings)",
      () => {
        expect( resolveAnimation( {
          duration: "4",
          framerate: "30"
        } ) ).toEqual( {
          duration: 4,
          framerate: 30
        } );
      }
    );

    test(
      "NaN / negative / non-numeric → default",
      () => {
        expect( resolveAnimation( {
          duration: NaN,
          framerate: -5
        } ) ).toEqual( {
          duration: DURATION_DEFAULT,
          framerate: FRAMERATE_DEFAULT
        } );
        expect( resolveAnimation( {
          duration: "abc"
        } ).duration ).toBe( DURATION_DEFAULT );
      }
    );
  }
);

describe(
  "totalFramesFor",
  () => {
    test(
      "round(duration * framerate), floored at 1",
      () => {
        expect( totalFramesFor( {
          duration: 4,
          framerate: 30
        } ) ).toBe( 120 );
        expect( totalFramesFor( {} ) ).toBe( DURATION_DEFAULT * FRAMERATE_DEFAULT ); // 720
      }
    );

    test(
      "a missing/zero duration uses the shared default, never 5 (the old server fallback)",
      () => {
        // Old server bug: round(5 * 30) = 150. Now: round(12 * 30) = 360.
        expect( totalFramesFor( {
          duration: 0,
          framerate: 30
        } ) ).toBe( DURATION_DEFAULT * 30 );
        expect( totalFramesFor( {
          duration: 0,
          framerate: 30
        } ) ).not.toBe( 150 );
      }
    );

    test(
      "never zero frames for a degenerate config",
      () => {
        expect( totalFramesFor( {
          duration: 0,
          framerate: 0
        } ) ).toBeGreaterThanOrEqual( 1 );
      }
    );
  }
);

describe(
  "recording-length invariant (front == back == clock)",
  () => {
    // Every shape an animation can arrive in across the form, a persisted job,
    // an imported options.json, or a slider dragged to its edge.
    const INPUTS: Array<Record<string, unknown> | undefined> = [
      undefined,
      {},
      {
        framerate: 30
      },
      {
        duration: 0
      },
      {
        duration: 0,
        framerate: 30
      },
      {
        duration: "0"
      },
      {
        duration: "4",
        framerate: "30"
      },
      {
        duration: 4,
        framerate: 30
      },
      {
        duration: 12,
        framerate: 60
      }
    ];

    test.each( INPUTS )(
      "video seconds == clock loop length for %p",
      ( animation ) => {
        const {
          duration, framerate
        } = resolveAnimation( animation );
        const totalFrames = totalFramesFor( animation );

        // The encoded clip length in seconds is totalFrames / framerate; it must
        // equal the duration the clock loops over (to within one frame of
        // rounding). This is exactly the equality the ||5-vs-||10 split broke.
        const videoSeconds = totalFrames / framerate;

        expect( Math.abs( videoSeconds - duration ) ).toBeLessThanOrEqual( 1 / framerate );
      }
    );
  }
);

describe(
  "engine ↔ effective-settings composition (what both engines now compute)",
  () => {
    // P5Engine/GsapEngine can't be imported under jest (they pull the generated
    // sketch registry, which is modulePathIgnore'd), but both now compute
    // exactly `totalFramesFor(getEffectiveSlideSettings(opts, idx).animation)`.
    // Assert that composition is slide-aware and default-consistent.
    test(
      "global duration with no slide override",
      () => {
        const opts = {
          animation: {
            duration: 4,
            framerate: 30
          },
          slides: []
        };

        expect( totalFramesFor( getEffectiveSlideSettings(
          opts,
          undefined
        ).animation ) ).toBe( 120 );
      }
    );

    test(
      "per-slide duration override wins; partial override keeps global framerate",
      () => {
        const opts = {
          animation: {
            duration: 12,
            framerate: 30
          },
          slides: [
            {
              animation: {
                duration: 4
              }
            }
          ]
        };

        // slide 0 → duration 4 (override) × framerate 30 (inherited) = 120.
        expect( totalFramesFor( getEffectiveSlideSettings(
          opts,
          0
        ).animation ) ).toBe( 120 );
      }
    );

    test(
      "a slide whose override zeroes duration still resolves to the shared default",
      () => {
        const opts = {
          animation: {
            duration: 12,
            framerate: 30
          },
          slides: [
            {
              animation: {
                duration: 0
              }
            }
          ]
        };

        expect( totalFramesFor( getEffectiveSlideSettings(
          opts,
          0
        ).animation ) ).toBe( DURATION_DEFAULT * 30 );
      }
    );
  }
);
