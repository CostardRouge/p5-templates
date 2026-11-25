/**
 * What a slot of the rhythm ASKS for (lab 10's canvas ②⑤⑥): at a given
 * instant, which accounts post and in which format, grouped as the send
 * groups them — read from the account-by-account rhythm, or from the old
 * one-for-all rhythm spread over the accounts as the matrix shows it.
 *
 * It says; it does not steer — routing still follows each account's usual
 * format (`planPost`).
 *
 * Pure and DOM-free.
 */

import {
  FORMAT_LABEL, seedAccounts, weekSends, type AccountRhythms, type WeekSend
} from "./accountRhythm";
import {
  PROVIDER_LABEL, providerOf, type PostizChannel
} from "./client";
import {
  wallClock, type Rhythm
} from "./rhythm";

/** The connection's fields this module reads. */
export interface RhythmSource {
  rhythm: Rhythm;
  channels: readonly PostizChannel[];
  defaultChannelIds: readonly string[];
  usual: Readonly<Record<string, string>>;
}

/** Every live account's week, as the matrix draws it. */
export function connAccounts( conn: RhythmSource ): AccountRhythms {
  return seedAccounts(
    conn.rhythm,
    conn.channels.filter( ( c ) => !c.disabled ).map( ( c ) => ( {
      id: c.id,
      provider: providerOf( c.identifier )
    } ) ),
    conn.defaultChannelIds,
    conn.usual
  );
}

/** The send of the week whose weekday and wall-clock time are `at`'s in `tz`, or null when `at` is not on the rhythm. */
export function sendAt(
  accounts: AccountRhythms, at: Date, tz: string
): WeekSend | null {
  const w = wallClock(
    at,
    tz
  );
  const time = `${ String( w.h ).padStart(
    2,
    "0"
  ) }:${ String( w.mi ).padStart(
    2,
    "0"
  ) }`;

  return weekSends( accounts ).find( ( s ) => s.day === w.wd && s.time === time ) ?? null;
}

/** How an account reads in a route: by its network when it is the only one of it, else by its name. */
export function shortNamer( channels: readonly PostizChannel[] ): ( id: string ) => string {
  return ( id ) => {
    const c = channels.find( ( x ) => x.id === id );

    if ( !c ) {
      return id;
    }
    const provider = providerOf( c.identifier );

    return channels.filter( ( x ) => providerOf( x.identifier ) === provider ).length > 1 ? c.name : PROVIDER_LABEL[ provider ];
  };
}

/** `Reel + Story → Steeve Pommier`, `Picture → X, Threads`. */
export function routeWords(
  route: WeekSend[ "routes" ][ number ], nameOf: ( id: string ) => string
): string {
  return `${ route.formats.map( ( f ) => FORMAT_LABEL[ f ] ).join( " + " ) } → ${ route.ids.map( nameOf ).join( ", " ) }`;
}
