import {
  readCampaigns
} from "@/lib/planner/campaignStore";
import {
  readChoices
} from "@/lib/planner/planStore";
import {
  readConnection, type PostizConnection
} from "@/lib/postiz/store";
import {
  readDraft, type Publication
} from "@/lib/postiz/publishStore";
import {
  readLevel
} from "@/lib/stats/settings";
import {
  readStats, STATS_KEY
} from "@/lib/stats/store";

/**
 * What a browser hands another one besides its gallery: the Plan, the
 * campaigns, every sketch's post (draft + sends), the post readings, the
 * Results switch, every sketch's export list and the Postiz connection
 * WITHOUT its key. It rides in the gallery archive (`archive.ts`, version 2)
 * so one file carries a whole studio from a Mac to an iPhone.
 *
 * What stays per browser on purpose: the layout and the panels, sound, dev
 * toggles, a render run in progress (two machines would render the same
 * line), and every sessionStorage handoff. The API key never leaves: it is
 * pasted again on the new machine, where the carried settings wait for it
 * (`PENDING_POSTIZ_KEY`).
 *
 * The merge is per store and conservative: a store this browser does not have
 * is taken whole; a store it has keeps its own values, and only records with
 * an identity are added to it (sends, readings, campaigns). Everything written
 * goes through the store's own reader first, so a hand-edited file cannot
 * plant what the app would not have written itself.
 */

const POSTIZ_KEY = "sketchbook.postiz.v1";
const PLAN_KEY = "sketchbook.plan.v1";
const CAMPAIGNS_KEY = "sketchbook.campaigns.v1";
const LEVEL_KEY = "sketchbook.stats.level.v1";
const PUBLISH_PREFIX = "sketchbook.publish.v1:";
const VARIANTS_PREFIX = "sketchbook.export.variants.v2:";

/** The carried connection, kept until a key is pasted here (`PublishingDialog`). */
export const PENDING_POSTIZ_KEY = "sketchbook.postiz.pending.v1";
const MAX_PUBLICATIONS = 20;

export type CarriedPostiz = Omit<PostizConnection, "apiKey">;
export type Carried = Record<string, unknown>;

export interface CarryOutcome {
  /** Keys written in this browser. */
  written: string[];
  /** The Postiz settings wait for a key to be pasted here. */
  postizPending: boolean;
}

function carriedKey( key: string ): boolean {
  return key === PLAN_KEY || key === CAMPAIGNS_KEY || key === STATS_KEY || key === LEVEL_KEY || key === POSTIZ_KEY
    || key.startsWith( PUBLISH_PREFIX ) || key.startsWith( VARIANTS_PREFIX );
}

function parse( raw: string | null ): unknown {
  try {
    return raw === null ? undefined : JSON.parse( raw );
  } catch {
    return undefined;
  }
}

function record( raw: unknown ): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray( raw ) ? raw as Record<string, unknown> : {};
}

/** A connection minus its key, or null. Pure. */
export function withoutKey( raw: unknown ): CarriedPostiz | null {
  // The reader insists on a key; lend it one so the rest is checked the same way.
  const conn = readConnection( {
    ...record( raw ),
    apiKey: "-"
  } );

  if ( !conn ) {
    return null;
  }

  const {
    apiKey: _apiKey, ...rest
  } = conn;

  return rest;
}

/** Everything this browser carries, read from `storage`. */
export function collectCarried( storage: Storage ): Carried {
  const out: Carried = {};

  for ( let i = 0; i < storage.length; i++ ) {
    const key = storage.key( i );

    if ( !key || !carriedKey( key ) ) {
      continue;
    }

    const value = parse( storage.getItem( key ) );

    if ( value === undefined ) {
      continue;
    }
    if ( key === POSTIZ_KEY ) {
      const conn = withoutKey( value );

      if ( conn ) {
        out[ key ] = conn;
      }
      continue;
    }
    out[ key ] = value;
  }

  return out;
}

/** An archive's `local` section read back: only carried keys, as an object. Pure. */
export function readCarried( raw: unknown ): Carried {
  return Object.fromEntries( Object.entries( record( raw ) ).filter( ( [
    key
  ] ) => carriedKey( key ) ) );
}

function publicationsOf( raw: unknown ): Publication[] {
  const list = record( raw ).publications;

  return Array.isArray( list ) ? list.filter( ( p ): p is Publication => {
    const r = record( p );

    return Array.isArray( r.postIds ) && typeof r.sentAt === "number";
  } ) : [];
}

/** A send's identity: its Postiz posts, else the instant it left. */
function sendId( p: Publication ): string {
  return p.postIds.length ? p.postIds.join( "," ) : `at:${ p.sentAt }`;
}

/** This browser's sends plus the carried ones it lacks, oldest first, capped as the store caps them. Pure. */
export function mergePublications(
  here: readonly Publication[], carried: readonly Publication[]
): Publication[] {
  const seen = new Set( here.map( sendId ) );

  return [
    ...here,
    ...carried.filter( ( p ) => !seen.has( sendId( p ) ) )
  ].sort( (
    a, b
  ) => a.sentAt - b.sentAt ).slice( -MAX_PUBLICATIONS );
}

/**
 * The value to store for `key`, given what this browser has (`undefined` when
 * nothing) and what came; `undefined` back means leave the key as it is. Pure.
 */
export function mergeOne(
  key: string, here: unknown, carried: unknown, now: number
): unknown {
  if ( key.startsWith( PUBLISH_PREFIX ) ) {
    const draft = readDraft( record( here === undefined ? carried : here ).draft );
    const publications = mergePublications(
      publicationsOf( here ),
      publicationsOf( carried )
    );

    return {
      draft,
      publications
    };
  }
  if ( key === STATS_KEY ) {
    const mine = readStats( here );
    const theirs = readStats( carried );

    return {
      ...mine,
      posts: {
        ...theirs.posts,
        ...mine.posts
      }
    };
  }
  if ( key === CAMPAIGNS_KEY ) {
    const mine = readCampaigns(
      here,
      now
    );
    const ids = new Set( mine.map( ( c ) => c.id ) );

    return {
      campaigns: [
        ...mine,
        ...readCampaigns(
          carried,
          now
        ).filter( ( c ) => !ids.has( c.id ) )
      ]
    };
  }
  // Below: one whole value, never merged — this browser's wins when it has one.
  if ( here !== undefined ) {
    return undefined;
  }
  if ( key === PLAN_KEY ) {
    return readChoices(
      carried,
      now
    );
  }
  if ( key === LEVEL_KEY ) {
    return readLevel( carried );
  }
  if ( key.startsWith( VARIANTS_PREFIX ) ) {
    return Array.isArray( carried ) ? carried : undefined;
  }

  return undefined;
}

/**
 * Merge carried settings into `storage`. The Postiz connection is the one
 * exception to the per-store rule: with a connection here, only the handles
 * and usual formats it lacks are added; with none, the settings wait under
 * `PENDING_POSTIZ_KEY` for the key to be pasted.
 */
export function applyCarried(
  storage: Storage, carried: Carried, now: number = Date.now()
): CarryOutcome {
  const written: string[] = [];
  let postizPending = false;
  const put = (
    key: string, value: unknown
  ) => {
    const text = JSON.stringify( value );

    if ( storage.getItem( key ) !== text ) {
      storage.setItem(
        key,
        text
      );
      written.push( key );
    }
  };

  for ( const [
    key,
    value
  ] of Object.entries( readCarried( carried ) ) ) {
    if ( key === POSTIZ_KEY ) {
      const theirs = withoutKey( value );

      if ( !theirs ) {
        continue;
      }

      const mine = readConnection( parse( storage.getItem( POSTIZ_KEY ) ) );

      if ( !mine ) {
        put(
          PENDING_POSTIZ_KEY,
          theirs
        );
        postizPending = true;
      } else if ( mine.apiBase === theirs.apiBase ) {
        put(
          POSTIZ_KEY,
          {
            ...mine,
            handles: {
              ...theirs.handles,
              ...mine.handles
            },
            usual: {
              ...theirs.usual,
              ...mine.usual
            }
          }
        );
      }
      continue;
    }

    const next = mergeOne(
      key,
      parse( storage.getItem( key ) ),
      value,
      now
    );

    if ( next !== undefined ) {
      put(
        key,
        next
      );
    }
  }

  return {
    written,
    postizPending
  };
}

/**
 * Write a MERGED set of carried stores (the cloud sync's three-way merge,
 * `src/lib/stockage/plan.ts`) into `storage`, as they are: unlike
 * `applyCarried`, nothing here keeps this browser's value — the merge already
 * decided. The Postiz connection keeps this browser's key; with no connection
 * here, it waits under `PENDING_POSTIZ_KEY` as an import does.
 */
export function writeCarried(
  storage: Storage, merged: Carried
): CarryOutcome {
  const written: string[] = [];
  let postizPending = false;
  const put = (
    key: string, value: unknown
  ) => {
    const text = JSON.stringify( value );

    if ( storage.getItem( key ) !== text ) {
      storage.setItem(
        key,
        text
      );
      written.push( key );
    }
  };

  for ( const [
    key,
    value
  ] of Object.entries( readCarried( merged ) ) ) {
    if ( value === undefined ) {
      continue;
    }
    if ( key === POSTIZ_KEY ) {
      const theirs = withoutKey( value );
      const mine = readConnection( parse( storage.getItem( POSTIZ_KEY ) ) );

      if ( !theirs ) {
        continue;
      }
      if ( mine ) {
        const next = readConnection( {
          ...theirs,
          apiKey: mine.apiKey
        } );

        // Another Postiz's settings never land on this browser's key.
        if ( next && theirs.apiBase === mine.apiBase && JSON.stringify( withoutKey( mine ) ) !== JSON.stringify( theirs ) ) {
          put(
            POSTIZ_KEY,
            next
          );
        }
      } else {
        put(
          PENDING_POSTIZ_KEY,
          theirs
        );
        postizPending = true;
      }
      continue;
    }
    put(
      key,
      value
    );
  }

  return {
    written,
    postizPending
  };
}

/** The carried Postiz settings waiting for a key, or null. */
export function pendingPostiz( storage: Storage | null ): CarriedPostiz | null {
  try {
    return storage ? withoutKey( parse( storage.getItem( PENDING_POSTIZ_KEY ) ) ) : null;
  } catch {
    return null;
  }
}

export function clearPendingPostiz( storage: Storage | null ): void {
  try {
    storage?.removeItem( PENDING_POSTIZ_KEY );
  } catch {
    // Nothing to clear.
  }
}
