/**
 * The gallery's Send again handoff: only for the sketch it names, fresh, once.
 */

import {
  readAsk, readPlannedAsk
} from "../reopen";

const NOW = 1_000_000_000;
const ask = ( over: Record<string, unknown> = {} ) => JSON.stringify( {
  sketchKey: "p5/iridescent-v7-peaks-shell",
  channelIds: [
    "bs"
  ],
  at: NOW - 1000,
  ...over
} );

describe(
  "readAsk",
  () => {
    it(
      "answers the accounts for the sketch it names",
      () => {
        expect( readAsk(
          ask(),
          "p5/iridescent-v7-peaks-shell",
          NOW
        ) ).toEqual( [
          "bs"
        ] );
      }
    );

    it(
      "ignores another sketch, a stale ask, an empty one and garbage",
      () => {
        expect( readAsk(
          ask(),
          "p5/materials-v5-ice",
          NOW
        ) ).toBeNull();
        expect( readAsk(
          ask( {
            at: NOW - 10 * 60 * 1000
          } ),
          "p5/iridescent-v7-peaks-shell",
          NOW
        ) ).toBeNull();
        expect( readAsk(
          ask( {
            channelIds: []
          } ),
          "p5/iridescent-v7-peaks-shell",
          NOW
        ) ).toBeNull();
        expect( readAsk(
          "{nope",
          "p5/iridescent-v7-peaks-shell",
          NOW
        ) ).toBeNull();
      }
    );
  }
);

describe(
  "readPlannedAsk",
  () => {
    const planned = ( over: Record<string, unknown> = {} ) => JSON.stringify( {
      sketchKey: "p5/materials-v1-flame",
      slot: new Date( NOW + 86_400_000 ).toISOString(),
      at: NOW - 1000,
      ...over
    } );

    it(
      "answers the slot for the sketch it names",
      () => {
        expect( readPlannedAsk(
          planned(),
          "p5/materials-v1-flame",
          NOW
        ) ).toBe( new Date( NOW + 86_400_000 ).toISOString() );
      }
    );

    it(
      "ignores another sketch, a stale ask, a slot gone by and garbage",
      () => {
        expect( readPlannedAsk(
          planned(),
          "p5/materials-v2-water",
          NOW
        ) ).toBeNull();
        expect( readPlannedAsk(
          planned( {
            at: NOW - 10 * 60 * 1000
          } ),
          "p5/materials-v1-flame",
          NOW
        ) ).toBeNull();
        expect( readPlannedAsk(
          planned( {
            slot: new Date( NOW - 1000 ).toISOString()
          } ),
          "p5/materials-v1-flame",
          NOW
        ) ).toBeNull();
        expect( readPlannedAsk(
          planned( {
            slot: "soon"
          } ),
          "p5/materials-v1-flame",
          NOW
        ) ).toBeNull();
        expect( readPlannedAsk(
          "{nope",
          "p5/materials-v1-flame",
          NOW
        ) ).toBeNull();
      }
    );
  }
);
