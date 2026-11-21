/**
 * Tying a figure to a piece and a sketch, and comparing like with like.
 *
 * **Attribution** is the gallery's, unchanged (`gallery/sends.ts`): a send of
 * this browser knows its sketch and its piece (`Publication.pieceId`); a post
 * from another device is known by Sketchbook's tag and the sketch its caption
 * links to. A post made outside Sketchbook is in neither list, so it is never
 * read and never attributed — it is not guessed.
 *
 * **Comparison** is per ACCOUNT, at equal age: a post's index is its settled
 * headline (reach, else views — `metrics.ts`) over the median of that same
 * account's settled posts, «× your usual». A reach on Instagram and an
 * impression on X are never added nor compared raw; their indexes are.
 *
 * **Floors** (lab 8): an account has no «usual» under `MIN_USUAL` settled
 * posts, and a group (a pillar, a series, a slot) says nothing under
 * `MIN_GROUP` — its row still shows its count, marked too few.
 *
 * Pure and DOM-free.
 */

import type {
  GallerySend
} from "../gallery/sends";
import type {
  Provider
} from "../postiz/client";
import {
  slotHead, wallClock, type Rhythm
} from "../postiz/rhythm";
import {
  REEL_HOST, sketchKeyOf, type PlanSketch
} from "../planner/planner";
import {
  headline, keepRate, median, NO_POST_FIGURES, type Figure
} from "./metrics";
import type {
  Candidate
} from "./schedule";
import type {
  PostRecord, Reading, StatsState
} from "./store";

/** An account's «usual» needs this many settled posts. */
export const MIN_USUAL = 5;
/** A group says nothing under this many measured sends. */
export const MIN_GROUP = 3;

/** What a send was FOR, as the plan would call it today; a reel (series or recap) is posted from the empty host and the two cannot be told apart afterwards. */
export type StatPillar = "drop" | "favourite" | "reel";

export const STAT_PILLAR_LABEL: Record<StatPillar, string> = {
  drop: "New",
  favourite: "Favourite",
  reel: "Series & recaps"
};

export const OFF_SLOT = "Another time";

/** Where a post's figures stand. */
export type AccountStats =
  /** Figures are kept. */
  | "figures"
  /** Out for less than a day, or simply not asked about yet. */
  | "unread"
  /** Postiz was asked and had no figure. */
  | "none"
  /** Postiz lost the post's id on the network. */
  | "missing"
  /** Postiz reads no figure from this network at all. */
  | "no-network";

export interface MeasuredAccount {
  postId: string;
  channelId: string;
  name: string;
  provider: Provider;
  publishedAt: number;
  stats: AccountStats;
  record: PostRecord | null;
  /** What the eye gets: the settled reading, else the latest. */
  shown: Reading | null;
  /** True when `shown` is the settled reading. */
  settled: boolean;
  /** The settled headline over the account's usual; null without one or the other. */
  index: number | null;
}

export interface MeasuredSend {
  key: string;
  sketchKey: string;
  pieceId: string | null;
  at: number;
  /** The sketch's category (its name when it has none); null when the catalogue does not know the sketch. */
  series: string | null;
  pillar: StatPillar | null;
  /** The rhythm's slot it went out on (`Sun 10:00`), or `OFF_SLOT`. */
  slot: string;
  accounts: MeasuredAccount[];
  /** The median of its accounts' indexes; null when none has one. */
  index: number | null;
}

/** An account's usual: the median settled headline of its posts. */
export interface Usual {
  channelId: string;
  /** Settled posts with a headline. */
  posts: number;
  /** Null under `MIN_USUAL`. */
  value: number | null;
  /** The headline's label on this account (`Reach`, `Views`, `Impressions`). */
  label: string;
}

/** The posts of `sends` that are out (or should be) and may be asked about: never a draft, a story, a queued or a failed post. */
export function candidatesOf(
  sends: readonly GallerySend[], now: number
): Candidate[] {
  return sends.flatMap( ( send ) => send.target === "draft" || send.at > now ? [] : send.accounts
    .filter( ( a ) => !a.story && ( a.state === "published" || a.state === "unknown" ) )
    .map( ( a ) => ( {
      postId: a.postId,
      provider: a.provider,
      publishedAt: send.at
    } ) ) );
}

/** The rhythm's slot `at` falls on, to the minute, in the rhythm's zone — or `OFF_SLOT`. */
export function slotOf(
  at: number, rhythm: Rhythm
): string {
  const w = wallClock(
    new Date( at ),
    rhythm.timeZone
  );
  const time = `${ String( w.h ).padStart(
    2,
    "0"
  ) }:${ String( w.mi ).padStart(
    2,
    "0"
  ) }`;
  const slot = rhythm.slots.find( ( s ) => s.day === w.wd && s.time === time );

  return slot ? slotHead( slot ) : OFF_SLOT;
}

function shownOf( record: PostRecord | null ): Reading | null {
  return record?.settled ?? record?.last ?? null;
}

function statsOf(
  provider: Provider, record: PostRecord | null
): AccountStats {
  if ( NO_POST_FIGURES.has( provider ) ) {
    return "no-network";
  }

  if ( shownOf( record ) ) {
    return "figures";
  }

  return record?.empty ?? "unread";
}

/** Each account's usual, from the settled readings of its posts. */
export function usuals( accounts: readonly Pick<MeasuredAccount, "channelId" | "record">[] ): Map<string, Usual> {
  const heads = new Map<string, Figure[]>();

  for ( const a of accounts ) {
    const head = a.record?.settled ? headline( a.record.settled.figures ) : null;

    if ( head ) {
      heads.set(
        a.channelId,
        [
          ...( heads.get( a.channelId ) ?? [] ),
          head
        ]
      );
    }
  }

  return new Map( [
    ...heads.entries()
  ].map( ( [
    channelId,
    list
  ] ) => [
    channelId,
    {
      channelId,
      posts: list.length,
      value: list.length >= MIN_USUAL ? median( list.map( ( f ) => f.value ) ) : null,
      label: list[ list.length - 1 ].label
    }
  ] ) );
}

export interface Measured {
  sends: MeasuredSend[];
  usual: Map<string, Usual>;
}

/**
 * Every send that is out, with what is kept of each of its posts, its index
 * against its account's usual, and what it was for. `catalogue` null (the
 * sketch's sheet outside the gallery) leaves series and pillar unknown.
 */
export function measure( input: {
  sends: readonly GallerySend[];
  state: StatsState;
  catalogue: readonly PlanSketch[] | null;
  rhythm: Rhythm;
  now: number;
} ): Measured {
  const byKey = new Map( ( input.catalogue ?? [] ).map( ( s ) => [
    sketchKeyOf( s ),
    s
  ] ) );
  const host = sketchKeyOf( REEL_HOST );
  const drafts = input.sends.flatMap( ( send ) => {
    if ( send.target === "draft" || send.at > input.now ) {
      return [];
    }

    const accounts = send.accounts
      .filter( ( a ) => !a.story && ( a.state === "published" || a.state === "unknown" ) )
      .map( ( a ) => {
        const record = input.state.posts[ a.postId ] ?? null;

        return {
          postId: a.postId,
          channelId: a.channelId,
          name: a.name,
          provider: a.provider,
          publishedAt: send.at,
          stats: statsOf(
            a.provider,
            record
          ),
          record,
          shown: shownOf( record ),
          settled: Boolean( record?.settled ),
          index: null as number | null
        };
      } );

    if ( !accounts.length ) {
      return [];
    }

    const sketch = byKey.get( send.sketchKey );

    return [
      {
        key: send.key,
        sketchKey: send.sketchKey,
        pieceId: send.pieceId,
        at: send.at,
        series: send.sketchKey === host ? null : sketch ? sketch.category || sketch.name : null,
        pillar: send.sketchKey === host ? "reel" as const : sketch ? ( sketch.favorite ? "favourite" as const : "drop" as const ) : null,
        slot: slotOf(
          send.at,
          input.rhythm
        ),
        accounts,
        index: null as number | null
      }
    ];
  } );
  const usual = usuals( drafts.flatMap( ( s ) => s.accounts ) );

  for ( const send of drafts ) {
    for ( const a of send.accounts ) {
      const head = a.record?.settled ? headline( a.record.settled.figures ) : null;
      const base = usual.get( a.channelId )?.value ?? null;

      a.index = head && base !== null && base > 0 ? head.value / base : null;
    }

    send.index = median( send.accounts.flatMap( ( a ) => a.index === null ? [] : [
      a.index
    ] ) );
  }

  return {
    sends: drafts.sort( (
      a, b
    ) => b.at - a.at ),
    usual
  };
}

/** One row of «What works». */
export interface GroupRow {
  id: string;
  label: string;
  /** Sends of the group that have an index (all accounts) or a settled headline (one account). */
  posts: number;
  /** True under `MIN_GROUP`: the row says its count and nothing else. */
  thin: boolean;
  /** All accounts: the median index. One account: null. */
  index: number | null;
  /** One account: the median settled headline, and its label. */
  head: number | null;
  /** One account: the median keep rate, when its network gives saves and shares. */
  rate: number | null;
}

export type GroupBy = "pillar" | "series" | "slot";

const capital = ( text: string ) => text.charAt( 0 ).toUpperCase() + text.slice( 1 );

function groupId(
  send: MeasuredSend, by: GroupBy
): { id: string;
  label: string } | null {
  if ( by === "pillar" ) {
    return send.pillar ? {
      id: send.pillar,
      label: STAT_PILLAR_LABEL[ send.pillar ]
    } : null;
  }

  if ( by === "series" ) {
    return send.series ? {
      id: send.series,
      label: capital( send.series.replace(
        /-/g,
        " "
      ) )
    } : null;
  }

  return {
    id: send.slot,
    label: send.slot
  };
}

/**
 * «What works», by pillar, series or slot. With `channelId` null the rows
 * compare every account through the index; with an account they give its raw
 * medians. Rows with the most posts first; a thin row carries no figure.
 */
export function groups(
  sends: readonly MeasuredSend[], by: GroupBy, channelId: string | null = null
): GroupRow[] {
  const rows = new Map<string, { label: string;
    index: number[];
    head: number[];
    rate: number[]; }>();

  for ( const send of sends ) {
    const group = groupId(
      send,
      by
    );

    if ( !group ) {
      continue;
    }

    const row = rows.get( group.id ) ?? {
      label: group.label,
      index: [],
      head: [],
      rate: []
    };

    if ( channelId === null ) {
      if ( send.index !== null ) {
        row.index.push( send.index );
      }
    } else {
      for ( const a of send.accounts ) {
        const figures = a.channelId === channelId ? a.record?.settled?.figures : undefined;
        const head = figures ? headline( figures ) : null;

        if ( figures && head ) {
          const rate = keepRate( figures );

          row.head.push( head.value );
          if ( rate ) {
            row.rate.push( rate.value );
          }
        }
      }
    }

    rows.set(
      group.id,
      row
    );
  }

  return [
    ...rows.entries()
  ].map( ( [
    id,
    row
  ] ) => {
    const posts = channelId === null ? row.index.length : row.head.length;
    const thin = posts < MIN_GROUP;

    return {
      id,
      label: row.label,
      posts,
      thin,
      index: thin || channelId !== null ? null : median( row.index ),
      head: thin || channelId === null ? null : median( row.head ),
      rate: thin || channelId === null || row.rate.length < MIN_GROUP ? null : median( row.rate )
    };
  } )
    .filter( ( row ) => row.posts > 0 )
    .sort( (
      a, b
    ) => b.posts - a.posts || a.label.localeCompare( b.label ) );
}

/** A sketch's own score: the index of its most recent send that has one. */
export function sketchScores( sends: readonly MeasuredSend[] ): Map<string, MeasuredSend> {
  const out = new Map<string, MeasuredSend>();

  for ( const send of [
    ...sends
  ].sort( (
    a, b
  ) => b.at - a.at ) ) {
    if ( send.index !== null && send.pillar !== "reel" && !out.has( send.sketchKey ) ) {
      out.set(
        send.sketchKey,
        send
      );
    }
  }

  return out;
}

/** How many sends have an index — what every comparison rests on. */
export function measuredCount( sends: readonly MeasuredSend[] ): number {
  return sends.filter( ( s ) => s.index !== null ).length;
}
