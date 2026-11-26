import {
  readEntry
} from "@/lib/gallery/archive";
import {
  fingerprintDocument
} from "@/lib/gallery/canonical";
import {
  getGalleryStore
} from "@/lib/gallery/store";
import type {
  GalleryEntry
} from "@/lib/gallery/types";
import {
  type Carried, collectCarried, readCarried, writeCarried
} from "@/lib/workspace/carry";

import {
  deleteDoc, getDoc, getFile, listDocs, listFileIds, putDoc, putFile, sha256Hex, StockageError
} from "./client";
import {
  type KnownPiece, mergeSettings, planGallery, sameSettings
} from "./plan";
import {
  getSession
} from "./session";

/**
 * One sync of this browser with the store: the gallery's pieces (a document
 * per piece, its thumbnail a file by hash) and the studio's settings (one
 * document of carried stores, never the Postiz key). The rules are
 * `plan.ts`'s; this file only moves bytes.
 *
 * What a sync remembers, per person (`sketchbook.stockage.v1`): each piece's
 * revision and hash at the last sync, and the settings the last sync agreed
 * on. That memory is what tells «deleted here» from «new there». Signing in
 * as someone else starts it over.
 *
 * Settings written into localStorage are only read by the stores at the
 * page's next load (each keeps a copy in memory), so a sync that wrote some
 * says so (`reload`).
 */

const MEMORY_KEY = "sketchbook.stockage.v1";
const LOCK = "sketchbook-stockage-sync";
const PIECE = "piece";
const SETTINGS_ID = "settings";
const PIECE_VERSION = 1;

interface Memory {
  sub: string;
  known: Record<string, KnownPiece>;
  base: Carried;
  syncedAt: number | null;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  deleted: number;
  /** Settings changed here: the page shows them after a reload. */
  reload: boolean;
  postizPending: boolean;
}

function memoryFor( sub: string ): Memory {
  try {
    const raw = JSON.parse( localStorage.getItem( MEMORY_KEY ) ?? "null" ) as Memory | null;

    if ( raw && raw.sub === sub && raw.known && raw.base ) {
      return raw;
    }
  } catch {
    // Unreadable: start over, which only costs a full comparison.
  }

  return {
    sub,
    known: {},
    base: {},
    syncedAt: null
  };
}

function remember( memory: Memory ): void {
  try {
    localStorage.setItem(
      MEMORY_KEY,
      JSON.stringify( memory )
    );
  } catch {
    // Quota: the next sync compares everything again.
  }
}

export function lastSyncedAt(): number | null {
  const session = getSession();

  return session ? memoryFor( session.sub ).syncedAt : null;
}

/** A piece as hashed: everything but its thumbnail, which never changes. */
function pieceHash( entry: GalleryEntry ): string {
  const {
    thumbnail: _thumbnail, ...rest
  } = entry;

  return fingerprintDocument( rest );
}

async function pieceBody(
  entry: GalleryEntry, files: Set<string>
) {
  const {
    thumbnail, ...rest
  } = entry;
  let thumbnailId: string | null = null;

  if ( thumbnail ) {
    thumbnailId = await sha256Hex( thumbnail );
    if ( !files.has( thumbnailId ) ) {
      await putFile(
        thumbnailId,
        thumbnail
      );
      files.add( thumbnailId );
    }
  }

  return {
    kind: PIECE,
    version: PIECE_VERSION,
    doc: {
      ...rest,
      thumbnail: thumbnailId
        ? {
          id: thumbnailId,
          type: thumbnail?.type || "image/jpeg"
        }
        : null
    },
    // What a list needs to decide, without the bodies.
    summary: {
      sketch: entry.sketch,
      at: entry.at,
      hash: pieceHash( entry )
    }
  };
}

async function pieceFrom( doc: Record<string, unknown> ): Promise<GalleryEntry> {
  const thumb = doc.thumbnail as { id?: unknown;
    type?: unknown } | null;
  // The archive's reader checks every field, as an import does.
  const entry = readEntry(
    {
      ...doc,
      thumbnail: null
    },
    0
  );
  const blob = thumb && typeof thumb.id === "string" ? await getFile( thumb.id ) : null;

  return {
    ...entry,
    thumbnail: blob ? new Blob(
      [
        blob
      ],
      {
        type: typeof thumb?.type === "string" ? thumb.type : "image/jpeg"
      }
    ) : null
  };
}

async function syncGallery( memory: Memory ): Promise<Pick<SyncResult, "pushed" | "pulled" | "deleted">> {
  const store = getGalleryStore();
  const [
    local,
    remote,
    files
  ] = await Promise.all( [
    store.entries(),
    listDocs( PIECE ),
    listFileIds()
  ] );
  const byId = new Map( local.map( ( entry ) => [
    entry.id,
    entry
  ] ) );
  const here = new Map( local.map( ( entry ) => [
    entry.id,
    pieceHash( entry )
  ] ) );
  const there = new Map( remote.map( ( doc ) => [
    doc.id,
    {
      etag: doc.etag,
      hash: typeof doc.summary?.hash === "string" ? doc.summary.hash : null
    }
  ] ) );
  const plan = planGallery(
    here,
    there,
    memory.known
  );
  const known = {
    ...memory.known
  };
  let pushed = 0;
  let pulled = 0;
  let deleted = 0;

  for ( const id of plan.same ) {
    known[ id ] = {
      etag: there.get( id )!.etag,
      hash: here.get( id )!
    };
  }

  for ( const id of [
    ...plan.push,
    ...plan.update
  ] ) {
    const entry = byId.get( id )!;

    try {
      known[ id ] = {
        etag: await putDoc(
          id,
          await pieceBody(
            entry,
            files
          ),
          plan.update.includes( id ) ? known[ id ].etag : null
        ),
        hash: here.get( id )!
      };
      pushed += 1;
    } catch( error ) {
      // Written elsewhere meanwhile: the next sync pulls it.
      if ( !( error instanceof StockageError && error.status === 412 ) ) {
        throw error;
      }
    }
  }

  const fresh: GalleryEntry[] = [];

  for ( const id of plan.pull ) {
    const doc = await getDoc<Record<string, unknown>>( id );

    if ( !doc?.doc ) {
      continue;
    }

    const entry = await pieceFrom( doc.doc );

    fresh.push( entry );
    known[ id ] = {
      etag: doc.etag,
      hash: pieceHash( entry )
    };
  }
  if ( fresh.length ) {
    // Pruning past the cap deletes the oldest here; the next sync deletes them there too.
    await store.addMany( fresh );
    pulled = fresh.length;
  }

  for ( const id of plan.deleteHere ) {
    await store.remove( id );
    delete known[ id ];
    deleted += 1;
  }
  for ( const id of plan.deleteThere ) {
    await deleteDoc(
      id,
      there.get( id )!.etag
    );
    delete known[ id ];
    deleted += 1;
  }
  for ( const id of Object.keys( known ) ) {
    if ( !here.has( id ) && !there.has( id ) ) {
      delete known[ id ];
    }
  }

  memory.known = known;

  return {
    pushed,
    pulled,
    deleted
  };
}

async function syncSettings( memory: Memory ): Promise<Pick<SyncResult, "reload" | "postizPending">> {
  let reload = false;
  let postizPending = false;

  // Twice at most: a 412 means another device wrote between the read and the write.
  for ( let attempt = 0; attempt < 2; attempt++ ) {
    const remote = await getDoc<Carried>( SETTINGS_ID );
    const there = readCarried( remote?.doc ?? {} );
    const here = collectCarried( localStorage );
    // The first sync of a browser takes the store's settings over its own:
    // resuming elsewhere means finding the work as the other device left it.
    const merged = mergeSettings(
      memory.syncedAt === null ? here : memory.base,
      here,
      there,
      Date.now()
    );
    const outcome = writeCarried(
      localStorage,
      merged
    );

    reload = reload || outcome.written.length > 0;
    postizPending = postizPending || outcome.postizPending;
    if ( remote && sameSettings(
      merged,
      there
    ) ) {
      memory.base = merged;

      return {
        reload,
        postizPending
      };
    }
    try {
      await putDoc(
        SETTINGS_ID,
        {
          kind: "settings",
          version: 1,
          doc: merged
        },
        remote?.etag ?? null
      );
      memory.base = merged;

      return {
        reload,
        postizPending
      };
    } catch( error ) {
      if ( !( error instanceof StockageError && ( error.status === 412 || error.status === 404 ) ) || attempt === 1 ) {
        throw error;
      }
    }
  }

  return {
    reload,
    postizPending
  };
}

let running: Promise<SyncResult | null> | null = null;

/** Sync now; null when signed out. One at a time per tab, and across tabs under a Web Lock. */
export function syncNow(): Promise<SyncResult | null> {
  if ( !running ) {
    const run = async(): Promise<SyncResult | null> => {
      const session = getSession();

      if ( !session ) {
        return null;
      }

      const memory = memoryFor( session.sub );
      const gallery = await syncGallery( memory );
      const settings = await syncSettings( memory );

      memory.syncedAt = Date.now();
      remember( memory );

      return {
        ...gallery,
        ...settings
      };
    };

    running = ( typeof navigator !== "undefined" && navigator.locks
      ? navigator.locks.request(
        LOCK,
        run
      )
      : run() ).finally( () => {
      running = null;
    } );
  }

  return running;
}

/** Signing out forgets the sync's memory too: the next person starts over. */
export function forgetSync(): void {
  try {
    localStorage.removeItem( MEMORY_KEY );
  } catch {
    // Nothing kept.
  }
}
