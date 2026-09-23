/**
 * Tests for the pad LED bridge: the merge across owners and the identity the
 * engine relies on to skip its per-frame diff.
 */
import {
  getPadLeds, publishPadLeds, resetPadLeds
} from "../padLedBridge";

describe(
  "padLedBridge",
  () => {
    beforeEach( () => {
      resetPadLeds();
    } );

    it(
      "merges every owner's wishes, the last publisher winning a contested pad",
      () => {
        publishPadLeds(
          "sketch.rack.effect",
          [
            {
              control: "pad.1",
              color: 9
            },
            {
              control: "pad.2",
              color: 1
            }
          ]
        );
        publishPadLeds(
          "sketch.reset",
          [
            {
              control: "pad.2",
              color: 5
            }
          ]
        );

        expect( getPadLeds() ).toEqual( [
          {
            control: "pad.1",
            color: 9
          },
          {
            control: "pad.2",
            color: 5
          }
        ] );
      }
    );

    it(
      "hands back the SAME array until something is published",
      () => {
        publishPadLeds(
          "a",
          [
            {
              control: "pad.1",
              color: 1
            }
          ]
        );
        const first = getPadLeds();

        expect( getPadLeds() ).toBe( first );

        // Withdrawing an owner that never published is not a change either.
        publishPadLeds(
          "never",
          null
        );
        expect( getPadLeds() ).toBe( first );

        publishPadLeds(
          "a",
          [
            {
              control: "pad.1",
              color: 9
            }
          ]
        );
        expect( getPadLeds() ).not.toBe( first );
      }
    );

    it(
      "withdraws an owner on null or an empty list",
      () => {
        publishPadLeds(
          "a",
          [
            {
              control: "pad.1",
              color: 1
            }
          ]
        );
        publishPadLeds(
          "a",
          null
        );
        expect( getPadLeds() ).toEqual( [] );

        publishPadLeds(
          "a",
          [
            {
              control: "pad.1",
              color: 1
            }
          ]
        );
        publishPadLeds(
          "a",
          []
        );
        expect( getPadLeds() ).toEqual( [] );
      }
    );
  }
);
