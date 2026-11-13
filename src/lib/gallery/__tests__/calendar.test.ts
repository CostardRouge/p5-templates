/**
 * The gallery's month and week: fixed six-week months, Monday weeks, and the
 * rhythm's free slots counted against EVERY post.
 */

import {
  addDays, freeSlots, mondayOf, monthGrid, monthLabel, monthOf, monthsBetween, shiftMonth, weekDays, weekLabel
} from "../calendar";
import {
  DEFAULT_RHYTHM
} from "@/lib/postiz/rhythm";

describe(
  "monthGrid",
  () => {
    it(
      "always lays out six Monday weeks",
      () => {
        const nov = monthGrid(
          {
            y: 2026,
            mo: 11
          },
          "2026-11-13"
        );

        expect( nov ).toHaveLength( 42 );
        // 1 Nov 2026 is a Sunday: the grid opens on Monday 26 Oct.
        expect( nov[ 0 ].day ).toBe( "2026-10-26" );
        expect( nov[ 0 ].inMonth ).toBe( false );
        expect( nov[ 6 ] ).toMatchObject( {
          day: "2026-11-01",
          inMonth: true,
          weekday: "Sun"
        } );
        expect( nov.filter( ( d ) => d.today ).map( ( d ) => d.day ) ).toEqual( [
          "2026-11-13"
        ] );
        expect( nov.find( ( d ) => d.day === "2026-11-12" )?.past ).toBe( true );
        expect( nov.find( ( d ) => d.day === "2026-11-14" )?.past ).toBe( false );
      }
    );

    it(
      "starts on the 1st when the month starts on a Monday",
      () => {
        expect( monthGrid(
          {
            y: 2026,
            mo: 6
          },
          "2026-06-10"
        )[ 0 ].day ).toBe( "2026-06-01" );
      }
    );
  }
);

describe(
  "months and weeks",
  () => {
    it(
      "moves across years",
      () => {
        expect( shiftMonth(
          {
            y: 2026,
            mo: 11
          },
          2
        ) ).toEqual( {
          y: 2027,
          mo: 1
        } );
        expect( shiftMonth(
          {
            y: 2026,
            mo: 1
          },
          -1
        ) ).toEqual( {
          y: 2025,
          mo: 12
        } );
        expect( monthsBetween(
          monthOf( "2026-11-13" ),
          {
            y: 2027,
            mo: 2
          }
        ) ).toBe( 3 );
        expect( monthLabel( monthOf( "2026-11-13" ) ) ).toBe( "November 2026" );
      }
    );

    it(
      "finds the Monday and the seven days",
      () => {
        expect( mondayOf( "2026-11-13" ) ).toBe( "2026-11-09" );
        expect( mondayOf( "2026-11-15" ) ).toBe( "2026-11-09" );
        expect( mondayOf(
          "2026-11-13",
          1
        ) ).toBe( "2026-11-16" );
        expect( addDays(
          "2026-10-31",
          1
        ) ).toBe( "2026-11-01" );

        const week = weekDays(
          "2026-11-09",
          "2026-11-13"
        );

        expect( week.map( ( d ) => `${ d.weekday } ${ d.n }` ) ).toEqual( [
          "Mon 9",
          "Tue 10",
          "Wed 11",
          "Thu 12",
          "Fri 13",
          "Sat 14",
          "Sun 15"
        ] );
        expect( week[ 4 ].today ).toBe( true );
        expect( weekLabel( "2026-11-09" ) ).toBe( "9–15 Nov" );
        expect( weekLabel( "2026-11-30" ) ).toBe( "30 Nov – 6 Dec" );
      }
    );
  }
);

describe(
  "freeSlots",
  () => {
    // Fri 13 Nov 2026, 12:00 in Paris. The rhythm: Tue 9:00, Fri 19:00, Sun 10:00.
    const now = new Date( "2026-11-13T11:00:00Z" );

    it(
      "offers the week's future slots",
      () => {
        const free = freeSlots(
          DEFAULT_RHYTHM,
          [],
          "2026-11-09",
          now
        );

        expect( [
          ...free.keys()
        ] ).toEqual( [
          "2026-11-13",
          "2026-11-15"
        ] );
      }
    );

    it(
      "drops a day another app's post holds, and keeps drafts and failures out of the count",
      () => {
        const free = freeSlots(
          DEFAULT_RHYTHM,
          [
            {
              publishDate: "2026-11-15T15:00:00Z",
              state: "queue"
            },
            {
              publishDate: "2026-11-13T18:00:00Z",
              state: "error"
            }
          ],
          "2026-11-09",
          now
        );

        expect( [
          ...free.keys()
        ] ).toEqual( [
          "2026-11-13"
        ] );
      }
    );

    it(
      "offers every slot of a week ahead",
      () => {
        expect( [
          ...freeSlots(
            DEFAULT_RHYTHM,
            [],
            "2026-11-16",
            now
          ).keys()
        ] ).toEqual( [
          "2026-11-17",
          "2026-11-20",
          "2026-11-22"
        ] );
      }
    );
  }
);
