/**
 * @jest-environment jsdom
 *
 * Integration of the breakdown orchestrator:
 *   - intro → start values; past outroStart → the final object BY REFERENCE
 *   - mid-window numbers lerp between start and final; snap keys stay final
 *   - memoization: same refs + same progression → same object identity;
 *     changed store refs OR changed form-meta refs → recompute; the drag
 *     layer's { ...item, position } wrapper does NOT invalidate
 *   - no-op contract (null) for missing items / nothing changed
 *   - findActiveBreakdownItem scoping (slide wins over global, index wraps)
 */

import getBreakdownSketch, {
  __resetBreakdownCaches,
  findActiveBreakdownItem,
  getBreakdownState
} from "../index.js";

const makeItem = ( buildOverrides = {} ) => ( {
  type: "breakdown",
  placement: "fixed",
  build: {
    selection: "all",
    departure: 1,
    introRatio: 0.1,
    outroRatio: 0.1,
    holdRatio: 0,
    easing: "linear",
    snapKeys: [
      "seed"
    ],
    excludeKeys: [],
    ...buildOverrides
  }
} );

const globalSketch = {
  amplitude: 100,
  seed: 42,
  grid: {
    columns: 8
  }
};

beforeEach( () => {
  __resetBreakdownCaches();
  delete ( window as any ).getSketchFormMeta;
} );

describe(
  "getBreakdownSketch",
  () => {
    it(
      "returns start values during the intro",
      () => {
        const out = getBreakdownSketch(
          globalSketch,
          undefined,
          makeItem(),
          0.05
        );

        // no form ranges: numbers head to 0; snap key keeps final
        expect( out.amplitude ).toBe( 0 );
        expect( out.grid.columns ).toBe( 0 );
        expect( out.seed ).toBe( 42 );
      }
    );

    it(
      "returns the final object by reference once everything is locked",
      () => {
        const item = makeItem();
        const state = getBreakdownState(
          globalSketch,
          undefined,
          item,
          0
        );
        const out = getBreakdownSketch(
          globalSketch,
          undefined,
          item,
          0.95
        );

        expect( out ).toBe( state.finalSketch );
        expect( out.amplitude ).toBe( 100 );
      }
    );

    it(
      "lerps numbers inside their window",
      () => {
        // Three steps (AMPLITUDE, SEED-snap… actually SEED is its own step
        // but stays final via snapKeys; steps: amplitude, seed, grid) over
        // [0.1, 0.9]. Probe inside the FIRST window.
        const out = getBreakdownSketch(
          globalSketch,
          undefined,
          makeItem(),
          0.2
        );

        expect( out.amplitude ).toBeGreaterThan( 0 );
        expect( out.amplitude ).toBeLessThan( 100 );

        // later steps untouched yet; snap key always final
        expect( out.grid.columns ).toBe( 0 );
        expect( out.seed ).toBe( 42 );
      }
    );

    it(
      "applies per-slide overrides on top of the global sketch",
      () => {
        const slideSketch = {
          amplitude: 50
        };
        const out = getBreakdownSketch(
          globalSketch,
          slideSketch,
          makeItem(),
          0.95
        );

        expect( out.amplitude ).toBe( 50 );
      }
    );

    it(
      "memoizes per progression and invalidates on store ref changes",
      () => {
        const item = makeItem();
        const a = getBreakdownSketch(
          globalSketch,
          undefined,
          item,
          0.2
        );
        const b = getBreakdownSketch(
          globalSketch,
          undefined,
          item,
          0.2
        );

        expect( b ).toBe( a );

        const c = getBreakdownSketch(
          globalSketch,
          undefined,
          item,
          0.21
        );

        expect( c ).not.toBe( a );

        const editedSketch = {
          ...globalSketch
        };
        const d = getBreakdownSketch(
          editedSketch,
          undefined,
          item,
          0.21
        );

        expect( d ).not.toBe( c );
      }
    );

    it(
      "the drag layer's { ...item, position } wrapper does NOT invalidate",
      () => {
        const item = makeItem();
        const a = getBreakdownSketch(
          globalSketch,
          undefined,
          item,
          0.2
        );
        const wrapped = {
          ...item,
          position: {
            x: 0.4,
            y: 0.4
          }
        };
        const b = getBreakdownSketch(
          globalSketch,
          undefined,
          wrapped,
          0.2
        );

        expect( b ).toBe( a );
      }
    );

    it(
      "invalidates when the form-meta bridge's refs change",
      () => {
        const item = makeItem( {
          selection: "changed"
        } );
        const metaA = {
          formValues: {
            amplitude: 100,
            seed: 42,
            grid: {
              columns: 8
            }
          }
        };

        ( window as any ).getSketchFormMeta = () => metaA;

        // Everything matches stock → nothing changed → no-op
        expect( getBreakdownSketch(
          globalSketch,
          undefined,
          item,
          0.2
        ) ).toBeNull();

        // Stock changes (user edits) → amplitude now differs → steps appear
        const metaB = {
          formValues: {
            amplitude: 1,
            seed: 42,
            grid: {
              columns: 8
            }
          }
        };

        ( window as any ).getSketchFormMeta = () => metaB;

        const out = getBreakdownSketch(
          globalSketch,
          undefined,
          item,
          0.5
        );

        expect( out ).not.toBeNull();
      }
    );

    it(
      "reuses untouched subtrees of the final object",
      () => {
        const withStatic = {
          ...globalSketch,
          untouched: {
            deep: true
          }
        };
        const item = makeItem( {
          excludeKeys: [
            "untouched.deep"
          ]
        } );
        const state = getBreakdownState(
          withStatic,
          undefined,
          item,
          0.2
        );
        const out = getBreakdownSketch(
          withStatic,
          undefined,
          item,
          0.2
        );

        expect( out.untouched ).toBe( state.finalSketch.untouched );
      }
    );

    it(
      "is a no-op for missing items or empty step lists",
      () => {
        expect( getBreakdownSketch(
          globalSketch,
          undefined,
          undefined,
          0.2
        ) ).toBeNull();

        expect( getBreakdownSketch(
          {},
          undefined,
          makeItem(),
          0.2
        ) ).toBeNull();
      }
    );
  }
);

describe(
  "getBreakdownState",
  () => {
    it(
      "exposes the narration state for the same frame",
      () => {
        const state = getBreakdownState(
          globalSketch,
          undefined,
          makeItem(),
          0.2
        );

        expect( state.steps.map( ( s: any ) => s.label ) ).toEqual( [
          "AMPLITUDE",
          "SEED",
          "GRID"
        ] );
        expect( state.progress.phase ).toBe( "build" );
        expect( state.progress.currentStep ).toBe( 0 );
        expect( state.currentFlat.get( "amplitude" ) ).toBeGreaterThan( 0 );
        expect( state.schedule.windows ).toHaveLength( 3 );
      }
    );
  }
);

describe(
  "findActiveBreakdownItem",
  () => {
    const breakdownA = {
      type: "breakdown",
      id: "global"
    };
    const breakdownB = {
      type: "breakdown",
      id: "slide"
    };

    it(
      "prefers the current slide's item over the global one",
      () => {
        const store = {
          content: [
            breakdownA
          ],
          slides: [
            {
              content: []
            },
            {
              content: [
                {
                  type: "text"
                },
                breakdownB
              ]
            }
          ]
        };

        expect( findActiveBreakdownItem(
          store,
          1,
          2
        ) ).toBe( breakdownB );
        expect( findActiveBreakdownItem(
          store,
          0,
          2
        ) ).toBe( breakdownA );
      }
    );

    it(
      "wraps the slide index like getSlide does",
      () => {
        const store = {
          slides: [
            {
              content: [
                breakdownB
              ]
            }
          ]
        };

        expect( findActiveBreakdownItem(
          store,
          -1,
          1
        ) ).toBe( breakdownB );
      }
    );

    it(
      "falls back to global content with no slides",
      () => {
        expect( findActiveBreakdownItem(
          {
            content: [
              breakdownA
            ]
          },
          null,
          0
        ) ).toBe( breakdownA );
      }
    );
  }
);
