/**
 * @jest-environment jsdom
 *
 * State that belongs to a sketch instance rather than to its module.
 *
 * A sketch module evaluates once, but a "sketch" content item can run it as a
 * layer several times over, next to the page — and then a `const sketchState =
 * { … }` at the module's top level is one object shared by all of them. These
 * tests pin the replacement's contract: a Proxy that reads and writes like the
 * plain object it stands in for, resolving to a separate record per instance,
 * with a strongly-held record for the page (no key) and weakly-held ones for
 * the layers.
 */

export {};

/* eslint-disable @typescript-eslint/no-require-imports */
const {
  createKeyedStore, createInstanceState
} = require( "@/p5/utils/instanceState.js" );
/* eslint-enable @typescript-eslint/no-require-imports */

type Rec = Record<string, unknown>;

describe(
  "createKeyedStore",
  () => {
    it(
      "hands each key its own record, created once",
      () => {
        let key: object | null = null;
        let inits = 0;
        const store = createKeyedStore(
          () => key,
          () => ( {
            id: ++inits
          } )
        );
        const layerA = {};
        const layerB = {};

        key = layerA;
        const a = store.current();

        key = layerB;
        const b = store.current();

        key = layerA;

        expect( store.current() ).toBe( a );
        expect( a ).not.toBe( b );
        expect( inits ).toBe( 2 );
      }
    );

    it(
      "treats a nullish key as the host, kept across key objects",
      () => {
        let key: object | null = null;
        const store = createKeyedStore(
          () => key,
          () => ( {} )
        );
        const host = store.current();

        key = {};
        store.current();
        key = null;

        expect( store.current() ).toBe( host );
      }
    );
  }
);

describe(
  "createInstanceState",
  () => {
    let key: object | null = null;
    const makeState = () => createInstanceState(
      () => key,
      () => ( {
        shapes: [] as number[],
        lastLayout: ""
      } )
    ) as Rec & {
      shapes: number[];
      lastLayout?: string;
    };

    beforeEach( () => {
      key = null;
    } );

    it(
      "reads and writes like the object it replaces",
      () => {
        const state = makeState();

        state.lastLayout = "2x3";
        state.shapes.push( 1 );

        expect( state.lastLayout ).toBe( "2x3" );
        expect( state.shapes ).toEqual( [
          1
        ] );
        expect( "shapes" in state ).toBe( true );
        expect( Object.keys( state ) ).toEqual( [
          "shapes",
          "lastLayout"
        ] );
        expect( {
          ...state
        } ).toEqual( {
          shapes: [
            1
          ],
          lastLayout: "2x3"
        } );

        delete state.lastLayout;
        expect( "lastLayout" in state ).toBe( false );
      }
    );

    it(
      "keeps one record per instance, so two layers never see each other's",
      () => {
        const state = makeState();
        const layerA = {};
        const layerB = {};

        key = layerA;
        state.lastLayout = "A";
        state.shapes.push( 1 );

        key = layerB;
        expect( state.lastLayout ).toBe( "" );
        expect( state.shapes ).toEqual( [] );
        state.lastLayout = "B";

        key = layerA;
        expect( state.lastLayout ).toBe( "A" );
        expect( state.shapes ).toEqual( [
          1
        ] );

        key = null;
        expect( state.lastLayout ).toBe( "" );
      }
    );

    it(
      "runs the initialiser per instance, so nothing is shared by reference",
      () => {
        let built = 0;
        const state = createInstanceState(
          () => key,
          () => {
            built++;

            return {
              memo: new Map()
            };
          }
        ) as Rec & {
          memo: Map<string, number>;
        };

        const hostMemo = state.memo;

        key = {};

        expect( state.memo ).not.toBe( hostMemo );
        expect( built ).toBe( 2 );
      }
    );

    it(
      "accepts a plain object and clones it per instance",
      () => {
        const state = createInstanceState(
          () => key,
          {
            count: 0,
            list: [
              1
            ]
          }
        ) as Rec & {
          count: number;
          list: number[];
        };

        state.count = 5;
        state.list.push( 2 );

        key = {};

        expect( state.count ).toBe( 0 );
        expect( state.list ).toEqual( [
          1
        ] );
      }
    );

    it(
      "refuses a plain object it cannot clone, rather than sharing it silently",
      () => {
        const state = createInstanceState(
          () => key,
          {
            fn: () => 1
          }
        ) as Rec;

        expect( () => state.fn ).toThrow( /initialiser function/ );
      }
    );
  }
);
