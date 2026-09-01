/**
 * @jest-environment jsdom
 */

import {
  __resetPanelStateCache,
  isPersistableCollapsibleKey,
  readSketchPanelState,
  saveCollapsibleKeys,
  saveOpenLayer
} from "../usePanelState";

const STORAGE_KEY = "sketchbook:panel-state";

const readRaw = () => JSON.parse( localStorage.getItem( STORAGE_KEY ) ?? "null" );

describe(
  "usePanelState",
  () => {
    beforeEach( () => {
      localStorage.clear();
      __resetPanelStateCache();
    } );

    describe(
      "isPersistableCollapsibleKey",
      () => {
        it(
          "keeps the named sections and the schema-shaped keys",
          () => {
            expect( isPersistableCollapsibleKey( "rootSettings" ) ).toBe( true );
            expect( isPersistableCollapsibleKey( "content" ) ).toBe( true );
            expect( isPersistableCollapsibleKey( "transition" ) ).toBe( true );
            expect( isPersistableCollapsibleKey( "nested-sketch.palette" ) ).toBe( true );
            expect( isPersistableCollapsibleKey( "list-sketch.photos" ) ).toBe( true );
          }
        );

        it(
          "rejects content-shaped keys, which address an item by index",
          () => {
            expect( isPersistableCollapsibleKey( "conditional-content.2.visual" ) ).toBe( false );
            expect( isPersistableCollapsibleKey( "item-content.0" ) ).toBe( false );
          }
        );
      }
    );

    it(
      "round-trips a sketch's keys and open layer",
      () => {
        saveCollapsibleKeys(
          "p5:braid",
          {
            rootSettings: false,
            "nested-sketch.palette": true
          }
        );
        saveOpenLayer(
          "p5:braid",
          "content.1"
        );

        __resetPanelStateCache();

        expect( readSketchPanelState( "p5:braid" ) ).toEqual( {
          keys: {
            rootSettings: false,
            "nested-sketch.palette": true
          },
          layer: "content.1"
        } );
      }
    );

    it(
      "never writes a content-shaped key, even when handed one",
      () => {
        saveCollapsibleKeys(
          "p5:braid",
          {
            content: true,
            "conditional-content.2.visual": true
          }
        );

        expect( readRaw().sketches[ "p5:braid" ].keys ).toEqual( {
          content: true
        } );
      }
    );

    it(
      "merges writes instead of replacing, so two stores can share a record",
      () => {
        saveCollapsibleKeys(
          "p5:braid",
          {
            rootSettings: false
          }
        );
        saveCollapsibleKeys(
          "p5:braid",
          {
            "nested-sketch.palette": true
          }
        );

        expect( readSketchPanelState( "p5:braid" )?.keys ).toEqual( {
          rootSettings: false,
          "nested-sketch.palette": true
        } );
      }
    );

    it(
      "keeps sketches apart",
      () => {
        saveCollapsibleKeys(
          "p5:braid",
          {
            content: false
          }
        );
        saveCollapsibleKeys(
          "gsap:ticker",
          {
            content: true
          }
        );

        expect( readSketchPanelState( "p5:braid" )?.keys.content ).toBe( false );
        expect( readSketchPanelState( "gsap:ticker" )?.keys.content ).toBe( true );
      }
    );

    it(
      "returns null for a sketch it has never seen",
      () => {
        expect( readSketchPanelState( "p5:unknown" ) ).toBeNull();
      }
    );

    it(
      "evicts the least recently written sketch past the cap",
      () => {
        const now = jest.spyOn(
          Date,
          "now"
        );

        for ( let index = 0; index < 21; index++ ) {
          now.mockReturnValue( 1000 + index );
          saveCollapsibleKeys(
            `p5:sketch-${ index }`,
            {
              content: true
            }
          );
        }

        now.mockRestore();

        const stored = readRaw().sketches;

        expect( Object.keys( stored ) ).toHaveLength( 20 );
        // The first one written is the one that goes.
        expect( stored[ "p5:sketch-0" ] ).toBeUndefined();
        expect( stored[ "p5:sketch-20" ] ).toBeDefined();
      }
    );

    it(
      "ignores a file written by a different version",
      () => {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify( {
            v: 99,
            sketches: {
              "p5:braid": {
                keys: {
                  content: false
                },
                layer: null,
                at: 1
              }
            }
          } )
        );

        expect( readSketchPanelState( "p5:braid" ) ).toBeNull();
      }
    );

    it(
      "survives corrupt JSON without throwing",
      () => {
        const warn = jest.spyOn(
          console,
          "warn"
        ).mockImplementation( () => {} );

        localStorage.setItem(
          STORAGE_KEY,
          "{ not json"
        );

        expect( () => readSketchPanelState( "p5:braid" ) ).not.toThrow();
        expect( readSketchPanelState( "p5:braid" ) ).toBeNull();
        expect( warn ).toHaveBeenCalled();

        warn.mockRestore();
      }
    );

    it(
      "drops entries whose shape is wrong rather than trusting them",
      () => {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify( {
            v: 1,
            sketches: {
              "p5:braid": {
                keys: {
                  content: "yes",
                  rootSettings: true
                },
                layer: 42,
                at: 1
              }
            }
          } )
        );

        expect( readSketchPanelState( "p5:braid" ) ).toEqual( {
          keys: {
            rootSettings: true
          },
          layer: null
        } );
      }
    );
  }
);
