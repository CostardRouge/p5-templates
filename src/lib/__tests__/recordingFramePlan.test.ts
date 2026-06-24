/**
 * Tests for the SINGLE SOURCE OF TRUTH used to resolve a sketch's recording
 * length: `resolveAnimation`, `framesForAnimation` and `getRecordingFramePlan`
 * in @/lib/effectiveSlideSettings.
 *
 * Why this exists: the "setting template duration doesn't work" bug came from
 * three places computing the recording length differently —
 *   • the browser recorder via `engine.getTotalFrames` (getEffectiveSlideSettings),
 *   • the server recorder via a private `calculateTotalFrames` that used
 *     `slideOptions.animation || options.animation` (NO merge) and a default
 *     duration of 5,
 *   • the p5 clock via `duration || 10`.
 * They disagreed whenever a duration was changed and/or a slide carried a
 * partial override, so the preview, the front recording and the back recording
 * came out different lengths. Everything now funnels through the functions
 * tested here; the engines (`P5Engine`/`GsapEngine`) and the server recorder
 * (`recordSketch`) all call `getRecordingFramePlan`, so testing it thoroughly
 * pins the front/back parity in place.
 */
import {
  resolveAnimation,
  framesForAnimation,
  getRecordingFramePlan,
  getEffectiveSlideSettings,
  DEFAULT_DURATION,
  DEFAULT_FRAMERATE
} from "@/lib/effectiveSlideSettings";

describe(
  "resolveAnimation",
  () => {
    test(
      "returns valid values unchanged",
      () => {
        expect( resolveAnimation( {
          framerate: 30,
          duration: 8
        } ) ).toEqual( {
          framerate: 30,
          duration: 8
        } );
      }
    );

    test(
      "coerces numeric strings (persisted / imported jobs)",
      () => {
        expect( resolveAnimation( {
          framerate: "24" as unknown as number,
          duration: "6" as unknown as number
        } ) ).toEqual( {
          framerate: 24,
          duration: 6
        } );
      }
    );

    test.each( [
      [
        "zero duration (slider floor)",
        {
          framerate: 60,
          duration: 0
        }
      ],
      [
        "negative duration",
        {
          framerate: 60,
          duration: -4
        }
      ],
      [
        "NaN duration",
        {
          framerate: 60,
          duration: Number.NaN
        }
      ],
      [
        "missing duration",
        {
          framerate: 60
        }
      ],
      [
        "garbage duration",
        {
          framerate: 60,
          duration: "abc" as unknown as number
        }
      ]
    ] )(
      "falls back to the default duration for %s",
      (
        _label, animation
      ) => {
        expect( resolveAnimation( animation as never ).duration ).toBe( DEFAULT_DURATION );
      }
    );

    test(
      "falls back to the default framerate for invalid framerates",
      () => {
        expect( resolveAnimation( {
          framerate: 0,
          duration: 5
        } ).framerate ).toBe( DEFAULT_FRAMERATE );
        expect( resolveAnimation( {
          framerate: Number.NaN,
          duration: 5
        } ).framerate ).toBe( DEFAULT_FRAMERATE );
      }
    );

    test(
      "fully missing animation resolves to both defaults",
      () => {
        expect( resolveAnimation( undefined ) ).toEqual( {
          framerate: DEFAULT_FRAMERATE,
          duration: DEFAULT_DURATION
        } );
        expect( resolveAnimation( null ) ).toEqual( {
          framerate: DEFAULT_FRAMERATE,
          duration: DEFAULT_DURATION
        } );
      }
    );
  }
);

describe(
  "framesForAnimation",
  () => {
    test(
      "multiplies duration by framerate",
      () => {
        expect( framesForAnimation( {
          framerate: 30,
          duration: 4
        } ) ).toBe( 120 );
      }
    );

    test(
      "rounds to the nearest whole frame",
      () => {
        expect( framesForAnimation( {
          framerate: 30,
          duration: 1.5
        } ) ).toBe( 45 );
        expect( framesForAnimation( {
          framerate: 24,
          duration: 2.02
        } ) ).toBe( Math.round( 24 * 2.02 ) );
      }
    );

    test(
      "never returns fewer than one frame",
      () => {
        // Even a degenerate animation must give the recorder a positive budget.
        expect( framesForAnimation( {
          framerate: 60,
          duration: 0
        } ) ).toBeGreaterThanOrEqual( 1 );
        expect( framesForAnimation( undefined ) ).toBeGreaterThanOrEqual( 1 );
      }
    );
  }
);

describe(
  "getRecordingFramePlan",
  () => {
    const options = {
      animation: {
        framerate: 60,
        duration: 12
      },
      slides: [
        {
          name: "full override",
          animation: {
            framerate: 24,
            duration: 4
          }
        },
        {
          // The regression case: only the framerate is overridden. The old
          // server path collapsed the missing duration to a hard-coded 5; the
          // browser path merged the global 12. They must now agree on 12.
          name: "framerate-only override",
          animation: {
            framerate: 30
          }
        },
        {
          name: "duration-only override",
          animation: {
            duration: 6
          }
        },
        {
          name: "no override"
        }
      ]
    };

    test(
      "global plan without a slide index",
      () => {
        expect( getRecordingFramePlan( options ) ).toEqual( {
          duration: 12,
          framerate: 60,
          totalFrames: 720
        } );
      }
    );

    test(
      "full per-slide override",
      () => {
        expect( getRecordingFramePlan(
          options,
          0
        ) ).toEqual( {
          duration: 4,
          framerate: 24,
          totalFrames: 96
        } );
      }
    );

    test(
      "framerate-only slide keeps the global duration (the fixed bug)",
      () => {
        const plan = getRecordingFramePlan(
          options,
          1
        );

        expect( plan.duration ).toBe( 12 );
        expect( plan.framerate ).toBe( 30 );
        expect( plan.totalFrames ).toBe( 360 );
      }
    );

    test(
      "duration-only slide keeps the global framerate",
      () => {
        expect( getRecordingFramePlan(
          options,
          2
        ) ).toEqual( {
          duration: 6,
          framerate: 60,
          totalFrames: 360
        } );
      }
    );

    test(
      "slide without overrides falls back to the global plan",
      () => {
        expect( getRecordingFramePlan(
          options,
          3
        ) ).toEqual( getRecordingFramePlan( options ) );
      }
    );

    test(
      "missing animation resolves to the default plan instead of NaN frames",
      () => {
        const plan = getRecordingFramePlan( {} );

        expect( plan.duration ).toBe( DEFAULT_DURATION );
        expect( plan.framerate ).toBe( DEFAULT_FRAMERATE );
        expect( Number.isFinite( plan.totalFrames ) ).toBe( true );
        expect( plan.totalFrames ).toBeGreaterThanOrEqual( 1 );
      }
    );
  }
);

describe(
  "front/back recording parity",
  () => {
    // The browser engines compute totalFrames/frameRate as
    // `getRecordingFramePlan(options, slideIndex).{totalFrames,framerate}`, and
    // the server recorder destructures the same call. This reproduces that
    // contract across a representative matrix so a future change that makes one
    // side diverge fails here.
    const enginePlan = (
      options: Record<string, unknown>,
      slideIndex?: number
    ) => {
      const plan = getRecordingFramePlan(
        options,
        slideIndex
      );

      return {
        totalFrames: plan.totalFrames,
        framerate: plan.framerate
      };
    };

    const serverPlan = (
      options: Record<string, unknown>,
      slideIndex?: number
    ) => {
      const plan = getRecordingFramePlan(
        options,
        slideIndex
      );

      return {
        totalFrames: plan.totalFrames,
        framerate: plan.framerate
      };
    };

    const scenarios: Array<{ label: string;
      options: Record<string, unknown>;
      slideIndex?: number }> = [
      {
        label: "single sketch, custom duration",
        options: {
          animation: {
            framerate: 30,
            duration: 7
          }
        }
      },
      {
        label: "deck, full per-slide override",
        options: {
          animation: {
            framerate: 60,
            duration: 12
          },
          slides: [
            {
              animation: {
                framerate: 24,
                duration: 3
              }
            }
          ]
        },
        slideIndex: 0
      },
      {
        label: "deck, framerate-only override (legacy mismatch case)",
        options: {
          animation: {
            framerate: 60,
            duration: 12
          },
          slides: [
            {
              animation: {
                framerate: 30
              }
            }
          ]
        },
        slideIndex: 0
      },
      {
        label: "deck, no per-slide override",
        options: {
          animation: {
            framerate: 48,
            duration: 9
          },
          slides: [
            {
              name: "plain"
            }
          ]
        },
        slideIndex: 0
      }
    ];

    test.each( scenarios )(
      "front and back agree on frame count + rate: $label",
      ( {
        options, slideIndex
      } ) => {
        expect( serverPlan(
          options,
          slideIndex
        ) ).toEqual( enginePlan(
          options,
          slideIndex
        ) );
      }
    );

    test(
      "frame plan equals duration × framerate of the effective settings",
      () => {
        const options = scenarios[ 2 ].options;
        const slideIndex = scenarios[ 2 ].slideIndex;
        const {
          animation
        } = getEffectiveSlideSettings(
          options,
          slideIndex
        );
        const plan = getRecordingFramePlan(
          options,
          slideIndex
        );

        expect( plan.totalFrames ).toBe( Math.round( animation.duration * animation.framerate ) );
        // The legacy server default (5s) would have produced 150 frames here;
        // the merge keeps the global 12s → 360 frames.
        expect( plan.totalFrames ).toBe( 360 );
      }
    );
  }
);
