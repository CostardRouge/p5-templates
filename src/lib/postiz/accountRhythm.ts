/**
 * The rhythm ACCOUNT BY ACCOUNT (lab 10, his choice the matrix): each account
 * its own week of slots, each slot the FORMAT it takes (a Reel, a carousel, a
 * picture, a story, a video). Its slots ARE its week: there is no separate
 * ceiling to set (a stepper was built and dropped 2026-11-25 — it only fed a
 * warning, and he read it as a control that did nothing). The slots of
 * every account at one instant are ONE send, each account in its own format —
 * the routes `planPost` already makes.
 *
 * The rest of the app still reads the rhythm's `slots` and `perWeek`: they are
 * DERIVED here from the accounts (`withAccounts`), the union of their instants
 * and that union's size, so every reader keeps working unchanged. A rhythm
 * without `accounts` is the one-for-every-account rhythm it always was, and
 * `seedAccounts` turns it into accounts the first time the matrix opens.
 *
 * Pure and DOM-free.
 */

import type {
  Provider
} from "./client";
import type {
  Rhythm, RhythmSlot
} from "./rhythm";

export type SlotFormat = "reel" | "carousel" | "picture" | "story" | "video";

export const SLOT_FORMATS: readonly SlotFormat[] = [
  "reel",
  "carousel",
  "picture",
  "story",
  "video"
];

export const FORMAT_LABEL: Record<SlotFormat, string> = {
  reel: "Reel",
  carousel: "Carousel",
  picture: "Picture",
  story: "Story",
  video: "Video"
};

/** One account's slot: a weekday (0 = Sunday), a wall-clock time, a format. */
export interface AccountSlot extends RhythmSlot {
  format: SlotFormat;
}

export interface AccountRhythm {
  slots: AccountSlot[];
}

/** Keyed by the Postiz account (channel) id. */
export type AccountRhythms = Record<string, AccountRhythm>;

/** The most slots one account holds, and the most distinct sends a week. */
export const MAX_ACCOUNT_SLOTS = 14;
export const MAX_SENDS = 21;

/** What Sketchbook can send to each network, the first the usual. */
const FORMATS_BY_PROVIDER: Record<Provider, readonly SlotFormat[]> = {
  instagram: [
    "reel",
    "carousel",
    "picture",
    "story"
  ],
  tiktok: [
    "video"
  ],
  youtube: [
    "video"
  ],
  x: [
    "picture",
    "video"
  ],
  threads: [
    "picture",
    "video"
  ],
  bluesky: [
    "picture",
    "video"
  ],
  other: []
};

export function formatsFor( provider: Provider ): readonly SlotFormat[] {
  return FORMATS_BY_PROVIDER[ provider ];
}

/** The format `want` becomes on `provider`: itself when allowed, a moving format stays moving, a still stays still. */
export function fitFormat(
  provider: Provider, want: SlotFormat
): SlotFormat | null {
  const ok = formatsFor( provider );

  if ( ok.includes( want ) ) {
    return want;
  }
  const moving = want === "reel" || want === "video" || want === "story";
  const pick = moving
    ? ok.find( ( f ) => f === "reel" || f === "video" )
    : ok.find( ( f ) => f === "picture" || f === "carousel" );

  return pick ?? ok[ 0 ] ?? null;
}

/** `video 9:16`, `picture 4:5` — an account's usual variant format — as a slot format for its network. */
export function formatFromUsual(
  provider: Provider, usual: string | undefined
): SlotFormat | null {
  const media = usual?.split( " " )[ 0 ];

  return fitFormat(
    provider,
    media === "video" ? "reel" : media === "picture" ? "picture" : formatsFor( provider )[ 0 ] ?? "picture"
  );
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Monday first, then by time. */
export function bySlot(
  a: RhythmSlot, b: RhythmSlot
): number {
  return ( a.day + 6 ) % 7 - ( b.day + 6 ) % 7 || a.time.localeCompare( b.time );
}

/** The accounts as stored, whatever an older or a hand-edited copy holds; null when there are none. */
export function readAccountRhythms( raw: unknown ): AccountRhythms | null {
  if ( !raw || typeof raw !== "object" || Array.isArray( raw ) ) {
    return null;
  }
  const out: AccountRhythms = {};

  for ( const [
    id,
    value
  ] of Object.entries( raw as Record<string, unknown> ).slice(
      0,
      40
    ) ) {
    if ( !id || !value || typeof value !== "object" ) {
      continue;
    }
    const v = value as Record<string, unknown>;
    const seen = new Set<string>();
    const slots = ( Array.isArray( v.slots ) ? v.slots : [] ).flatMap( ( s ): AccountSlot[] => {
      const o = ( s && typeof s === "object" ? s : {} ) as Record<string, unknown>;
      const key = `${ String( o.day ) }|${ String( o.time ) }|${ String( o.format ) }`;

      if ( !Number.isInteger( o.day ) || ( o.day as number ) < 0 || ( o.day as number ) > 6 || typeof o.time !== "string" || !TIME_RE.test( o.time ) || !SLOT_FORMATS.includes( o.format as SlotFormat ) || seen.has( key ) ) {
        return [];
      }
      seen.add( key );

      return [
        {
          day: o.day as number,
          time: o.time,
          format: o.format as SlotFormat
        }
      ];
    } )
      .slice(
        0,
        MAX_ACCOUNT_SLOTS
      )
      .sort( bySlot );

    // A stored `perWeek` (the dropped stepper's) is ignored.
    out[ id ] = {
      slots
    };
  }

  return Object.keys( out ).length ? out : null;
}

/** The distinct instants of every account's slots — the sends — Monday first. */
export function sendsOf( accounts: AccountRhythms ): RhythmSlot[] {
  const seen = new Map<string, RhythmSlot>();

  for ( const a of Object.values( accounts ) ) {
    for ( const s of a.slots ) {
      seen.set(
        `${ s.day }|${ s.time }`,
        {
          day: s.day,
          time: s.time
        }
      );
    }
  }

  return [
    ...seen.values()
  ].sort( bySlot ).slice(
    0,
    MAX_SENDS
  );
}

/**
 * The rhythm carrying these accounts, its `slots` and `perWeek` derived from
 * them: every send is a slot, and the week holds them all.
 */
export function withAccounts(
  rhythm: Rhythm, accounts: AccountRhythms
): Rhythm {
  const slots = sendsOf( accounts );

  return {
    timeZone: rhythm.timeZone,
    slots,
    perWeek: Math.min(
      21,
      Math.max(
        1,
        slots.length
      )
    ),
    accounts
  };
}

/** The accounts a rhythm stores, or the one-for-all rhythm spread over `channels` (each in its usual format) when it has none. */
export function seedAccounts(
  rhythm: Rhythm,
  channels: readonly { id: string;
    provider: Provider }[],
  defaultIds: readonly string[],
  usual: Readonly<Record<string, string>>
): AccountRhythms {
  const live = channels.filter( ( c ) => formatsFor( c.provider ).length > 0 );
  const out: AccountRhythms = {};

  if ( rhythm.accounts ) {
    for ( const c of live ) {
      const a = rhythm.accounts[ c.id ];

      out[ c.id ] = {
        slots: a ? a.slots.filter( ( s ) => formatsFor( c.provider ).includes( s.format ) ) : []
      };
    }

    return out;
  }
  const ticked = new Set( defaultIds.length ? defaultIds : live.map( ( c ) => c.id ) );

  for ( const c of live ) {
    const format = formatFromUsual(
      c.provider,
      usual[ c.id ]
    );

    out[ c.id ] = {
      slots: ticked.has( c.id ) && format ? rhythm.slots.map( ( s ) => ( {
        day: s.day,
        time: s.time,
        format
      } ) ).sort( bySlot ) : []
    };
  }

  return out;
}

/** A story at the same instant as another format on its account: that post's «+ Story», counted with it. */
export function isRider(
  slots: readonly AccountSlot[], slot: AccountSlot
): boolean {
  return slot.format === "story" && slots.some( ( o ) => o !== slot && o.day === slot.day && o.time === slot.time && o.format !== "story" );
}

/** The slots of an account that count as posts: every one but a story riding on another. */
export function countedSlots( a: AccountRhythm ): AccountSlot[] {
  return a.slots.filter( ( s ) => !isRider(
    a.slots,
    s
  ) );
}

/** One send of the week: its instant, and which accounts take which formats. */
export interface WeekSend extends RhythmSlot {
  routes: { formats: SlotFormat[];
    ids: string[] }[];
}

/** The week's sends, each grouping the accounts that take the same formats. */
export function weekSends( accounts: AccountRhythms ): WeekSend[] {
  return sendsOf( accounts ).map( ( send ) => {
    const groups = new Map<string, { formats: SlotFormat[];
      ids: string[] }>();

    for ( const [
      id,
      a
    ] of Object.entries( accounts ) ) {
      const formats = a.slots.filter( ( s ) => s.day === send.day && s.time === send.time ).map( ( s ) => s.format )
        .sort( (
          x, y
        ) => Number( x === "story" ) - Number( y === "story" ) || SLOT_FORMATS.indexOf( x ) - SLOT_FORMATS.indexOf( y ) );

      if ( formats.length ) {
        const key = formats.join( "+" );
        const g = groups.get( key ) ?? {
          formats,
          ids: []
        };

        g.ids.push( id );
        groups.set(
          key,
          g
        );
      }
    }

    return {
      ...send,
      routes: [
        ...groups.values()
      ]
    };
  } );
}

const DAY_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
];

/** What the rhythm breaks, said plainly per account (by `nameOf`) — never a refusal. */
export function accountWarnings(
  accounts: AccountRhythms, nameOf: ( id: string ) => string
): string[] {
  const out: string[] = [];

  for ( const [
    id,
    a
  ] of Object.entries( accounts ) ) {
    const counted = countedSlots( a );

    for ( let day = 0; day < 7; day++ ) {
      const n = counted.filter( ( s ) => s.day === day ).length;

      if ( n > 1 ) {
        out.push( `${ nameOf( id ) }: ${ n } posts on ${ DAY_LONG[ day ] }.` );
      }
    }
  }
  const sends = sendsOf( accounts );

  for ( let day = 0; day < 7; day++ ) {
    const times = sends.filter( ( s ) => s.day === day );

    if ( times.length > 1 ) {
      out.push( `${ times.length } sends on ${ DAY_LONG[ day ] }: Export and the Plan take one post a day, so the ${ times.slice( 1 ).map( ( s ) => s.time )
        .join( ", " ) } ${ times.length > 2 ? "ones stay" : "one stays" } empty.` );
    }
  }

  return out;
}
