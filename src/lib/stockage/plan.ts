/**
 * What a sync must do, decided without a network or a browser: pure, so the
 * rules are tested (`__tests__/plan.test.ts`).
 *
 * The gallery's pieces and the studio's settings follow two different rules.
 *
 * PIECES are records with an id. Each side is compared with what both held at
 * the last sync (`known`: id → the store's revision and the piece's hash then),
 * which is what tells a piece deleted here from a piece added there:
 *   - here, there, known: the side that changed since wins; both changed → the
 *     store wins (the piece another device wrote is not lost, this one's edit
 *     is — a rename or a mark, never a document: a document change is a new
 *     piece);
 *   - here only: new → push; known → deleted there → delete here;
 *   - there only: new → pull; known → deleted here → delete there.
 *
 * SETTINGS are one document of carried stores (`src/lib/workspace/carry.ts`),
 * merged three ways against what the last sync agreed on (`base`):
 *   - a store of records with an identity (sends, readings, campaigns) is the
 *     union of both sides (`mergeOne`), as the archive import does;
 *   - a store that is one whole value (the Plan, the Results switch, an export
 *     list, the Postiz connection minus its key) takes the store's value when
 *     it did not change here since the last sync, and keeps this browser's
 *     when it did — two devices editing the same Plan between two syncs keep
 *     the last one to sync, never a blend of the two.
 */
import {
  canonicalDocument
} from "@/lib/gallery/canonical";
import {
  type Carried, mergeOne
} from "@/lib/workspace/carry";

export interface KnownPiece {
  etag: string;
  hash: string;
}

export interface GalleryPlan {
  push: string[];
  update: string[];
  pull: string[];
  deleteHere: string[];
  deleteThere: string[];
  /** Same piece both sides, never seen together before: only `known` learns it. */
  same: string[];
}

export function planGallery(
  here: ReadonlyMap<string, string>,
  there: ReadonlyMap<string, { etag: string;
    hash: string | null }>,
  known: Readonly<Record<string, KnownPiece>>
): GalleryPlan {
  const plan: GalleryPlan = {
    push: [],
    update: [],
    pull: [],
    deleteHere: [],
    deleteThere: [],
    same: []
  };
  const ids = new Set( [
    ...here.keys(),
    ...there.keys()
  ] );

  for ( const id of ids ) {
    const mine = here.get( id );
    const theirs = there.get( id );
    const before = known[ id ];

    if ( mine !== undefined && theirs ) {
      if ( !before ) {
        ( theirs.hash === mine ? plan.same : plan.pull ).push( id );
      } else if ( theirs.etag !== before.etag ) {
        plan.pull.push( id );
      } else if ( mine !== before.hash ) {
        plan.update.push( id );
      }
    } else if ( mine !== undefined ) {
      ( before ? plan.deleteHere : plan.push ).push( id );
    } else if ( theirs ) {
      ( before ? plan.deleteThere : plan.pull ).push( id );
    }
  }

  return plan;
}

const RECORD_STORES = /^(sketchbook\.publish\.v1:|sketchbook\.stats\.v1$|sketchbook\.campaigns\.v1$)/;

function same(
  a: unknown, b: unknown
): boolean {
  return canonicalDocument( a ) === canonicalDocument( b );
}

/**
 * The carried stores this browser should hold, and the store's document,
 * after a three-way merge. `here` and `there` are `collectCarried` shapes
 * (the Postiz connection without its key); `base` is the last merge, `{}`
 * before the first. Pure.
 */
export function mergeSettings(
  base: Carried, here: Carried, there: Carried, now: number
): Carried {
  const out: Carried = {};
  const keys = new Set( [
    ...Object.keys( here ),
    ...Object.keys( there )
  ] );

  for ( const key of keys ) {
    const mine = here[ key ];
    const theirs = there[ key ];

    if ( theirs === undefined ) {
      out[ key ] = mine;
      continue;
    }

    // Read through the store's own reader, as an import would.
    const theirsRead = mergeOne(
      key,
      undefined,
      theirs,
      now
    ) ?? theirs;

    if ( mine === undefined ) {
      out[ key ] = theirsRead;
    } else if ( RECORD_STORES.test( key ) ) {
      out[ key ] = mergeOne(
        key,
        mine,
        theirs,
        now
      ) ?? mine;
    } else {
      out[ key ] = same(
        mine,
        base[ key ]
      ) ? theirsRead : mine;
    }
  }

  return out;
}

export function sameSettings(
  a: Carried, b: Carried
): boolean {
  return same(
    a,
    b
  );
}
