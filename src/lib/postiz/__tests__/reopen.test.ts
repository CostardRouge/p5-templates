/**
 * The gallery's Send again handoff: only for the sketch it names, fresh, once.
 */

import {
  readAsk
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
