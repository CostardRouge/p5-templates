/**
 * Tests for the pad LED messages. Pure — no Web MIDI, no handler — like the
 * channel adapter and the controller map.
 */
import {
  LED_CHANNELS, desiredPadLeds, padLedDiff, padLedsOff
} from "../padLeds.js";
import {
  padNoteFor
} from "../controllerMap.js";

const DAW_PORT = "Launchkey Mini MK3 DAW Port";
const noteOnDaw = ( control: string ) => padNoteFor(
  DAW_PORT,
  control
);

describe(
  "desiredPadLeds",
  () => {
    it(
      "resolves each wish to the pad's note, with the channel its mode needs",
      () => {
        expect( desiredPadLeds(
          [
            {
              control: "pad.1",
              color: 9
            },
            {
              control: "pad.9",
              color: 1,
              mode: "pulse"
            }
          ],
          noteOnDaw
        ) ).toEqual( {
          96: {
            color: 9,
            channel: LED_CHANNELS.static
          },
          112: {
            color: 1,
            channel: LED_CHANNELS.pulse
          }
        } );
      }
    );

    it(
      "drops a wish the port cannot show, and clamps the colour to the palette",
      () => {
        expect( desiredPadLeds(
          [
            {
              control: "knob.1",
              color: 9
            },
            {
              control: "pad.17",
              color: 9
            },
            {
              control: "pad.2",
              color: 300
            },
            {
              control: "pad.3",
              color: Number.NaN
            }
          ],
          noteOnDaw
        ) ).toEqual( {
          97: {
            color: 127,
            channel: 1
          },
          98: {
            color: 0,
            channel: 1
          }
        } );
        expect( desiredPadLeds(
          null,
          noteOnDaw
        ) ).toEqual( {} );
      }
    );
  }
);

describe(
  "padLedDiff",
  () => {
    it(
      "sends a note-on for a new pad and for one whose colour or channel changed",
      () => {
        const {
          messages, next
        } = padLedDiff(
          {
            96: {
              color: 1,
              channel: 1
            },
            97: {
              color: 1,
              channel: 1
            }
          },
          {
            96: {
              color: 9,
              channel: 1
            },
            97: {
              color: 1,
              channel: 2
            },
            98: {
              color: 1,
              channel: 1
            }
          }
        );

        expect( messages ).toEqual( [
          [
            0x90,
            96,
            9
          ],
          [
            0x91,
            97,
            1
          ],
          [
            0x90,
            98,
            1
          ]
        ] );
        expect( next ).toEqual( {
          96: {
            color: 9,
            channel: 1
          },
          97: {
            color: 1,
            channel: 2
          },
          98: {
            color: 1,
            channel: 1
          }
        } );
      }
    );

    it(
      "sends nothing when nothing changed — this runs every frame",
      () => {
        const state = {
          96: {
            color: 9,
            channel: 1
          }
        };

        expect( padLedDiff(
          state,
          {
            ...state
          }
        ).messages ).toEqual( [] );
      }
    );

    it(
      "switches a pad off, on the static channel, when it leaves the wish list",
      () => {
        // Channel 1 is also what stops a flash, so a pulsing pad goes dark.
        const {
          messages, next
        } = padLedDiff(
          {
            96: {
              color: 9,
              channel: 3
            }
          },
          {}
        );

        expect( messages ).toEqual( [
          [
            0x90,
            96,
            0
          ]
        ] );
        expect( next ).toEqual( {} );
      }
    );

    it(
      "starts from nothing",
      () => {
        expect( padLedDiff(
          undefined,
          {
            96: {
              color: 1,
              channel: 1
            }
          }
        ).messages ).toEqual( [
          [
            0x90,
            96,
            1
          ]
        ] );
      }
    );
  }
);

describe(
  "padLedsOff",
  () => {
    it(
      "is every lit pad going dark — what a teardown sends before disarming",
      () => {
        expect( padLedsOff( {
          96: {
            color: 9,
            channel: 1
          },
          112: {
            color: 1,
            channel: 2
          }
        } ) ).toEqual( [
          [
            0x90,
            96,
            0
          ],
          [
            0x90,
            112,
            0
          ]
        ] );
        expect( padLedsOff( {} ) ).toEqual( [] );
      }
    );
  }
);
