import {
  accountWarnings, countedSlots, fitFormat, formatFromUsual, isRider, readAccountRhythms, seedAccounts, sendsOf, weekSends, withAccounts, type AccountRhythms
} from "../accountRhythm";
import {
  DEFAULT_RHYTHM, nextFreeSlot, readRhythm
} from "../rhythm";

const accounts: AccountRhythms = {
  ig: {
    perWeek: 3,
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
      },
      {
        day: 5,
        time: "19:00",
        format: "carousel"
      }
    ]
  },
  x: {
    perWeek: 3,
    slots: [
      {
        day: 2,
        time: "09:00",
        format: "picture"
      },
      {
        day: 0,
        time: "10:00",
        format: "video"
      }
    ]
  }
};

describe(
  "the rhythm, account by account",
  () => {
    it(
      "fits a format to what each network takes",
      () => {
        expect( fitFormat(
          "instagram",
          "carousel"
        ) ).toBe( "carousel" );
        expect( fitFormat(
          "x",
          "reel"
        ) ).toBe( "video" );
        expect( fitFormat(
          "threads",
          "carousel"
        ) ).toBe( "picture" );
        expect( fitFormat(
          "instagram",
          "video"
        ) ).toBe( "reel" );
        expect( fitFormat(
          "other",
          "reel"
        ) ).toBeNull();
        expect( formatFromUsual(
          "instagram",
          "video 9:16"
        ) ).toBe( "reel" );
        expect( formatFromUsual(
          "bluesky",
          "picture 4:5"
        ) ).toBe( "picture" );
        expect( formatFromUsual(
          "x",
          undefined
        ) ).toBe( "picture" );
      }
    );

    it(
      "reads what is stored, dropping what is not a slot",
      () => {
        expect( readAccountRhythms( undefined ) ).toBeNull();
        expect( readAccountRhythms( {
          ig: {
            perWeek: 99,
            slots: [
              {
                day: 5,
                time: "19:00",
                format: "carousel"
              },
              {
                day: 2,
                time: "09:00",
                format: "reel"
              },
              {
                day: 2,
                time: "09:00",
                format: "reel"
              },
              {
                day: 9,
                time: "09:00",
                format: "reel"
              },
              {
                day: 1,
                time: "9h",
                format: "reel"
              },
              {
                day: 1,
                time: "09:00",
                format: "gif"
              }
            ]
          }
        } ) ).toEqual( {
          ig: {
            perWeek: 2,
            slots: [
              {
                day: 2,
                time: "09:00",
                format: "reel"
              },
              {
                day: 5,
                time: "19:00",
                format: "carousel"
              }
            ]
          }
        } );
      }
    );

    it(
      "derives the sends every reader of the rhythm sees",
      () => {
        expect( sendsOf( accounts ) ).toEqual( [
          {
            day: 2,
            time: "09:00"
          },
          {
            day: 5,
            time: "19:00"
          },
          {
            day: 0,
            time: "10:00"
          }
        ] );
        const rhythm = withAccounts(
          DEFAULT_RHYTHM,
          accounts
        );

        expect( rhythm.perWeek ).toBe( 3 );
        // Stored and read back, the derived fields are rebuilt from the accounts, whatever they said.
        expect( readRhythm( {
          ...rhythm,
          slots: [],
          perWeek: 1
        } ) ).toEqual( rhythm );
        // The rest of the app reads it as before: the next free send.
        expect( nextFreeSlot(
          rhythm,
          [],
          new Date( "2026-11-23T12:00:00Z" )
        )?.toISOString() ).toBe( "2026-11-24T08:00:00.000Z" );
      }
    );

    it(
      "counts a story riding on a Reel with it, and a lone story alone",
      () => {
        const ig = accounts.ig;

        expect( isRider(
          ig.slots,
          ig.slots[ 1 ]
        ) ).toBe( true );
        expect( countedSlots( ig ) ).toHaveLength( 2 );
        expect( countedSlots( {
          perWeek: 1,
          slots: [
            {
              day: 1,
              time: "08:00",
              format: "story"
            }
          ]
        } ) ).toHaveLength( 1 );
      }
    );

    it(
      "groups each send by the formats its accounts take",
      () => {
        expect( weekSends( accounts )[ 0 ] ).toEqual( {
          day: 2,
          time: "09:00",
          routes: [
            {
              formats: [
                "reel",
                "story"
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
          ]
        } );
      }
    );

    it(
      "spreads the old one-for-all rhythm over the ticked accounts, each in its usual format",
      () => {
        const seeded = seedAccounts(
          DEFAULT_RHYTHM,
          [
            {
              id: "ig",
              provider: "instagram"
            },
            {
              id: "th",
              provider: "threads"
            },
            {
              id: "bs",
              provider: "bluesky"
            },
            {
              id: "odd",
              provider: "other"
            }
          ],
          [
            "ig",
            "th"
          ],
          {
            ig: "video 9:16"
          }
        );

        expect( Object.keys( seeded ) ).toEqual( [
          "ig",
          "th",
          "bs"
        ] );
        expect( seeded.ig.slots.map( ( s ) => s.format ) ).toEqual( [
          "reel",
          "reel",
          "reel"
        ] );
        expect( seeded.th.slots.map( ( s ) => s.format ) ).toEqual( [
          "picture",
          "picture",
          "picture"
        ] );
        expect( seeded.bs.slots ).toEqual( [] );
        // Spread, it gives the same sends the old rhythm had.
        expect( sendsOf( seeded ) ).toEqual( sendsOf( {
          a: {
            perWeek: 3,
            slots: DEFAULT_RHYTHM.slots.map( ( s ) => ( {
              ...s,
              format: "reel" as const
            } ) )
          }
        } ) );
        // A rhythm that has accounts keeps them, and gives a new account an empty row.
        const kept = seedAccounts(
          withAccounts(
            DEFAULT_RHYTHM,
            accounts
          ),
          [
            {
              id: "ig",
              provider: "instagram"
            },
            {
              id: "new",
              provider: "x"
            }
          ],
          [],
          {}
        );

        expect( kept.ig ).toEqual( accounts.ig );
        expect( kept.new ).toEqual( {
          perWeek: 3,
          slots: []
        } );
      }
    );

    it(
      "says what a rhythm breaks, and never more",
      () => {
        expect( accountWarnings(
          accounts,
          ( id ) => id
        ) ).toEqual( [] );
        expect( accountWarnings(
          {
            ig: {
              perWeek: 1,
              slots: [
                {
                  day: 2,
                  time: "09:00",
                  format: "reel"
                },
                {
                  day: 2,
                  time: "18:00",
                  format: "picture"
                }
              ]
            }
          },
          ( id ) => id.toUpperCase()
        ) ).toEqual( [
          "IG: 2 posts a week, its ceiling says 1.",
          "IG: 2 posts on Tuesday.",
          "2 sends on Tuesday: Export and the Plan take one post a day, so the 18:00 one stays empty."
        ] );
      }
    );
  }
);
