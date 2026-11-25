import {
  withAccounts
} from "../accountRhythm";
import {
  DEFAULT_RHYTHM
} from "../rhythm";
import {
  connAccounts, routeWords, sendAt, shortNamer
} from "../slotAsks";

const channels = [
  {
    id: "ig",
    name: "Steeve Pommier",
    identifier: "instagram",
    picture: null,
    disabled: false,
    handle: null
  },
  {
    id: "ph",
    name: "Steeve taking photos",
    identifier: "instagram-standalone",
    picture: null,
    disabled: false,
    handle: null
  },
  {
    id: "x",
    name: "Steeve Pommier",
    identifier: "x",
    picture: null,
    disabled: false,
    handle: null
  }
];

describe(
  "what a slot of the rhythm asks for",
  () => {
    const conn = {
      rhythm: withAccounts(
        DEFAULT_RHYTHM,
        {
          ig: {
            slots: [
              {
                day: 2,
                time: "09:00",
                format: "reel"
              },
              {
                day: 2,
                time: "09:00",
                format: "story"
              }
            ]
          },
          x: {
            slots: [
              {
                day: 2,
                time: "09:00",
                format: "picture"
              }
            ]
          }
        }
      ),
      channels,
      defaultChannelIds: [],
      usual: {}
    };

    it(
      "finds the send at an instant, in the rhythm's zone",
      () => {
        // Tuesday 24 November 2026, 9:00 in Paris.
        const send = sendAt(
          connAccounts( conn ),
          new Date( "2026-11-24T08:00:00Z" ),
          "Europe/Paris"
        );
        const nameOf = shortNamer( channels );

        expect( send?.routes.map( ( r ) => routeWords(
          r,
          nameOf
        ) ) ).toEqual( [
          "Reel + Story → Steeve Pommier",
          "Picture → X"
        ] );
        expect( sendAt(
          connAccounts( conn ),
          new Date( "2026-11-24T09:00:00Z" ),
          "Europe/Paris"
        ) ).toBeNull();
      }
    );

    it(
      "reads the old one-for-all rhythm spread over the ticked accounts",
      () => {
        const send = sendAt(
          connAccounts( {
            ...conn,
            rhythm: DEFAULT_RHYTHM,
            defaultChannelIds: [
              "ig",
              "x"
            ],
            usual: {
              ig: "video 9:16"
            }
          } ),
          new Date( "2026-11-27T18:00:00Z" ),
          "Europe/Paris"
        );

        expect( send?.routes ).toEqual( [
          {
            formats: [
              "reel"
            ],
            ids: [
              "ig"
            ]
          },
          {
            formats: [
              "picture"
            ],
            ids: [
              "x"
            ]
          }
        ] );
      }
    );
  }
);
