/**
 * What each piece BECAME on the networks (lab 3): the sends this browser kept
 * (`publishStore`'s publications, one per Publish run) matched to the posts
 * Postiz lists (`GET /posts`, read once when the gallery opens), and tied to
 * the gallery piece they left from (`Publication.pieceId`; an older send
 * falls back to the sketch and the date).
 *
 * A SEND is one tile on the calendars and one block in the sketch sheet: the
 * posts of one Publish run, account by account, each with Postiz's state, its
 * live link once out, and what went wrong.
 *
 * Pure and DOM-free.
 */

import {
  PROVIDER_LABEL, providerOf, type PostizChannel, type PostizPost, type PostState, type Provider
} from "@/lib/postiz/client";
import {
  readOutcomes
} from "@/lib/postiz/outcome";
import type {
  Publication
} from "@/lib/postiz/publishStore";
import {
  localDay, slotLabel
} from "@/lib/postiz/rhythm";
import type {
  GalleryEntry
} from "./types";

export type AccountState = PostState | "unknown";

export interface SendAccount {
  postId: string;
  channelId: string;
  /** The account as Postiz names it. */
  name: string;
  provider: Provider;
  /** The story sent beside an Instagram post. */
  story: boolean;
  state: AccountState;
  error: string | null;
  /** The live post (Postiz's `releaseURL`), once published. */
  url: string | null;
}

export interface GallerySend {
  /** Stable for React: the first post's id. */
  key: string;
  /** The Export dialog's key for the sketch: `<engine>/<name>`. */
  sketchKey: string;
  /** The gallery piece it left from, when this browser still has it. */
  pieceId: string | null;
  /** When it goes (or went) out, epoch ms: Postiz's date when it lists it, else what was asked. */
  at: number;
  target: Publication[ "target" ];
  kind: Publication[ "kind" ];
  variantName: string;
  accounts: SendAccount[];
  /** The publication as kept, for *Take back* and *Send again*; null for a post this browser did not send. */
  publication: Publication | null;
}

/** A send's state as one word: failed as soon as one account failed, out when all are, else planned. */
export type SendState = "failed" | "published" | "planned" | "draft" | "unknown";

/** The filter chips of the Grid. */
export type PieceFilter = "all" | "planned" | "published" | "failed" | "none";

export const PIECE_FILTERS: readonly { id: PieceFilter;
  label: string }[] = [
  {
    id: "all",
    label: "All"
  },
  {
    id: "planned",
    label: "Planned"
  },
  {
    id: "published",
    label: "Published"
  },
  {
    id: "failed",
    label: "Failed"
  },
  {
    id: "none",
    label: "Not posted"
  }
];

/** The Export dialog's key for a piece's sketch. */
export function pieceSketchKey( entry: Pick<GalleryEntry, "engine" | "name"> ): string {
  return `${ entry.engine }/${ entry.name }`;
}

/** How long after its keep a send can still be the piece's, when the send did not record it. */
const FALLBACK_SLACK_MS = 60_000;

/**
 * The piece a send left from: the one it recorded, when this browser still
 * has it; else (an older send) the newest piece of the same sketch kept no
 * later than the send — an export run keeps its piece before it sends.
 */
export function pieceOfPublication(
  publication: Publication,
  sketchKey: string,
  entries: readonly GalleryEntry[]
): string | null {
  if ( publication.pieceId && entries.some( ( e ) => e.id === publication.pieceId ) ) {
    return publication.pieceId;
  }

  let best: GalleryEntry | null = null;

  for ( const entry of entries ) {
    if ( pieceSketchKey( entry ) === sketchKey && entry.at <= publication.sentAt + FALLBACK_SLACK_MS && ( !best || entry.at > best.at ) ) {
      best = entry;
    }
  }

  return best?.id ?? null;
}

function channelOf(
  channelId: string, listed: PostizPost | undefined, channels: readonly PostizChannel[]
): { name: string;
  provider: Provider } {
  const known = channels.find( ( c ) => c.id === channelId );
  const identifier = listed?.channel?.identifier || known?.identifier || "";

  return {
    name: listed?.channel?.name || known?.name || "An account",
    provider: providerOf( identifier )
  };
}

export interface BuildSends {
  publications: readonly { key: string;
    publication: Publication }[];
  /** Postiz's posts over the window read; null when none were read (no Postiz, or not yet). */
  posts: readonly PostizPost[] | null;
  channels: readonly PostizChannel[];
  entries: readonly GalleryEntry[];
  now: number;
}

/**
 * Every send this browser kept, newest first, each account's state as Postiz
 * lists it. Without a listing, a draft reads `draft`, a send still ahead
 * `queue`, anything else `unknown` — the card says «Sent», never a guess.
 */
export function buildSends( input: BuildSends ): GallerySend[] {
  const byId = new Map( ( input.posts ?? [] ).map( ( p ) => [
    p.id,
    p
  ] ) );

  return input.publications.map( ( {
    key, publication
  } ) => {
    const asked = publication.at ? Date.parse( publication.at ) : publication.sentAt;
    const fallback: AccountState = publication.target === "draft"
      ? "draft"
      : input.posts === null && asked > input.now ? "queue" : "unknown";
    const accounts = readOutcomes(
      publication,
      input.posts ?? []
    ).map( ( o ) => {
      const listed = byId.get( o.postId );

      return {
        postId: o.postId,
        channelId: o.channelId,
        ...channelOf(
          o.channelId,
          listed,
          input.channels
        ),
        story: o.story,
        state: listed ? o.state : fallback,
        error: o.error,
        url: o.url
      };
    } );
    const listedDates = accounts.map( ( a ) => byId.get( a.postId ) )
      .flatMap( ( p ) => p ? [
        Date.parse( p.publishDate )
      ] : [] )
      .filter( Number.isFinite );

    return {
      key: publication.postIds[ 0 ] ?? `${ key }@${ publication.sentAt }`,
      sketchKey: key,
      pieceId: pieceOfPublication(
        publication,
        key,
        input.entries
      ),
      at: listedDates.length ? Math.min( ...listedDates ) : asked,
      target: publication.target,
      kind: publication.kind,
      variantName: publication.variantName,
      accounts,
      publication
    };
  } )
    .sort( (
      a, b
    ) => b.at - a.at );
}

/** A send's state: failed as soon as one account failed, out when all are, a draft when all are, planned while one is queued. */
export function sendState( send: Pick<GallerySend, "accounts"> ): SendState {
  const states = send.accounts.map( ( a ) => a.state );

  if ( !states.length ) {
    return "unknown";
  }

  if ( states.includes( "error" ) ) {
    return "failed";
  }

  if ( states.every( ( s ) => s === "published" ) ) {
    return "published";
  }

  if ( states.every( ( s ) => s === "draft" ) ) {
    return "draft";
  }

  return states.includes( "queue" ) ? "planned" : states.includes( "published" ) ? "published" : "unknown";
}

/** Each piece's sends, newest first. */
export function sendsByPiece( sends: readonly GallerySend[] ): Map<string, GallerySend[]> {
  const out = new Map<string, GallerySend[]>();

  for ( const send of sends ) {
    if ( send.pieceId ) {
      out.set(
        send.pieceId,
        [
          ...( out.get( send.pieceId ) ?? [] ),
          send
        ]
      );
    }
  }

  for ( const list of out.values() ) {
    list.sort( (
      a, b
    ) => b.at - a.at );
  }

  return out;
}

/** Which chip a piece answers to: its newest send's state, or «Not posted». */
export function pieceFilterOf( sends: readonly GallerySend[] | undefined ): Exclude<PieceFilter, "all"> | null {
  if ( !sends?.length ) {
    return "none";
  }

  const state = sendState( sends[ 0 ] );

  return state === "failed" || state === "published" || state === "planned" ? state : null;
}

/** How many pieces each chip holds. */
export function filterCounts(
  pieceIds: readonly string[], byPiece: ReadonlyMap<string, GallerySend[]>
): Record<PieceFilter, number> {
  const counts: Record<PieceFilter, number> = {
    all: pieceIds.length,
    planned: 0,
    published: 0,
    failed: 0,
    none: 0
  };

  for ( const id of pieceIds ) {
    const f = pieceFilterOf( byPiece.get( id ) );

    if ( f ) {
      counts[ f ] += 1;
    }
  }

  return counts;
}

/** An account named by its network; by name and network when the send has two of that network. */
export function accountLabel(
  account: Pick<SendAccount, "name" | "provider">, all: readonly Pick<SendAccount, "provider">[]
): string {
  const net = PROVIDER_LABEL[ account.provider ];

  return all.filter( ( a ) => a.provider === account.provider ).length > 1 ? `${ account.name } on ${ net }` : net;
}

/** The accounts that failed, each once (a story beside a post counts with its account). */
export function failedAccounts( send: Pick<GallerySend, "accounts"> ): SendAccount[] {
  const seen = new Set<string>();

  return send.accounts.filter( ( a ) => {
    if ( a.state !== "error" || seen.has( a.channelId ) ) {
      return false;
    }

    seen.add( a.channelId );

    return true;
  } );
}

/** The accounts a send went to, each once. */
function distinctAccounts( send: Pick<GallerySend, "accounts"> ): SendAccount[] {
  const seen = new Set<string>();

  return send.accounts.filter( ( a ) => !seen.has( a.channelId ) && Boolean( seen.add( a.channelId ) ) );
}

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
];

/** `11 Nov`, in `tz`. */
export function shortDate(
  at: number, tz: string
): string {
  const day = localDay(
    new Date( at ),
    tz
  );

  return `${ Number( day.slice( 8 ) ) } ${ SHORT_MONTHS[ Number( day.slice(
    5,
    7
  ) ) - 1 ] }`;
}

/** `Sun 10:00` — a time in the week ahead, in `tz`. */
export function weekdayTime(
  at: number, tz: string
): string {
  const label = slotLabel(
    new Date( at ),
    tz
  );
  const [
    date,
    time
  ] = label.split( " · " );

  return `${ date.split( " " )[ 0 ] } ${ time.padStart(
    5,
    "0"
  ) }`;
}

/**
 * The card's line under a piece (G2's overlay): «Planned · Sun 10:00»,
 * «Posted on 4 · 11 Nov», «X failed · 3 out», «Draft in Postiz», «Sent · 11 Nov».
 */
export function sendLine(
  send: GallerySend, tz: string, now: number
): string {
  const state = sendState( send );
  const accounts = distinctAccounts( send );

  if ( state === "failed" ) {
    const failed = failedAccounts( send );
    const out = accounts.filter( ( a ) => !failed.some( ( f ) => f.channelId === a.channelId ) && send.accounts.some( ( s ) => s.channelId === a.channelId && s.state === "published" ) ).length;

    return `${ failed.map( ( a ) => accountLabel(
      a,
      accounts
    ) ).join( ", " ) } failed · ${ out } out`;
  }

  if ( state === "planned" ) {
    return `Planned · ${ send.at - now < 6 * 86_400_000 && send.at > now ? weekdayTime(
      send.at,
      tz
    ) : `${ shortDate(
      send.at,
      tz
    ) } · ${ weekdayTime(
      send.at,
      tz
    ).split( " " )[ 1 ] }` }`;
  }

  if ( state === "published" ) {
    return `Posted on ${ accounts.length } · ${ shortDate(
      send.at,
      tz
    ) }`;
  }

  if ( state === "draft" ) {
    return "Draft in Postiz";
  }

  return `Sent · ${ shortDate(
    send.at,
    tz
  ) }`;
}

/** What a failure says first: Postiz's first sentence, or that it said nothing. */
export function firstSentence( error: string | null ): string {
  return ( error ?? "Postiz could not publish it, and said nothing more." ).split( /(?<=\.)\s/ )[ 0 ];
}

/** The day a send sits on in the calendars, in `tz`. */
export function sendDay(
  send: Pick<GallerySend, "at">, tz: string
): string {
  return localDay(
    new Date( send.at ),
    tz
  );
}

/** Items grouped by their day. */
export function byDay<T>(
  items: readonly T[], dayOf: ( item: T ) => string
): Map<string, T[]> {
  const out = new Map<string, T[]>();

  for ( const item of items ) {
    const day = dayOf( item );

    out.set(
      day,
      [
        ...( out.get( day ) ?? [] ),
        item
      ]
    );
  }

  return out;
}
