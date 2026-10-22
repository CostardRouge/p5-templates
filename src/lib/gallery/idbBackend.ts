import type {
  GalleryBackend
} from "./store";
import type {
  GalleryEntry
} from "./types";

/**
 * The gallery's IndexedDB: one database, one object store keyed by `id`, the
 * thumbnails stored as Blobs beside the document. The first browser store this
 * app has (everything else is small JSON in local/sessionStorage); a hand-rolled
 * wrapper rather than idb/dexie because five operations do not earn a
 * dependency. Every request is wrapped once in `request()`, and each call opens
 * its own transaction — there is no long-lived connection to lose.
 */
export const GALLERY_DB_NAME = "sketchbook-gallery";
const DB_VERSION = 1;
const STORE = "entries";
const BLOCKED_TIMEOUT_MS = 5000;

function request<T>( req: IDBRequest<T> ): Promise<T> {
  return new Promise( (
    resolve, reject
  ) => {
    req.onsuccess = () => resolve( req.result );
    req.onerror = () => reject( req.error ?? new Error( "IndexedDB request failed" ) );
  } );
}

function done( tx: IDBTransaction ): Promise<void> {
  return new Promise( (
    resolve, reject
  ) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject( tx.error ?? new Error( "IndexedDB transaction failed" ) );
    tx.onabort = () => reject( tx.error ?? new Error( "IndexedDB transaction aborted" ) );
  } );
}

let opening: Promise<IDBDatabase> | null = null;

function openAt( version: number | undefined ): Promise<IDBDatabase> {
  return new Promise( (
    resolve, reject
  ) => {
    const req = version === undefined ? indexedDB.open( GALLERY_DB_NAME ) : indexedDB.open(
      GALLERY_DB_NAME,
      version
    );

    req.onupgradeneeded = () => {
      const db = req.result;

      if ( !db.objectStoreNames.contains( STORE ) ) {
        const store = db.createObjectStore(
          STORE,
          {
            keyPath: "id"
          }
        );

        store.createIndex(
          "at",
          "at"
        );
        store.createIndex(
          "sketch",
          "sketch"
        );
      }
    };
    req.onsuccess = () => {
      const db = req.result;

      // Another tab upgrading, or the user clearing site data: let go, and
      // reopen on the next call.
      db.onversionchange = () => {
        db.close();
        opening = null;
      };
      resolve( db );
    };
    req.onerror = () => reject( req.error ?? new Error( "IndexedDB could not be opened" ) );
    // `blocked` is not a failure: the upgrade waits for the other connections
    // (another tab's, which close on `versionchange`) and `success` follows.
    // A connection that never lets go would hang every keep, so give it a while.
    req.onblocked = () => {
      setTimeout(
        () => reject( new Error( "IndexedDB is blocked by another tab — close the other Sketchbook tabs" ) ),
        BLOCKED_TIMEOUT_MS
      );
    };
  } );
}

/**
 * Open the database, creating the store on the way. `upgradeneeded` only
 * fires when the version RISES, so a database of this name that exists at
 * our version without the store (opened once by something else — a DevTools
 * probe, a script, an older build) would stay unusable forever; such a
 * database is reopened one version up, which runs the upgrade again.
 */
async function openDatabase(): Promise<IDBDatabase> {
  if ( !opening ) {
    opening = ( async() => {
      let db = await openAt( DB_VERSION );

      if ( !db.objectStoreNames.contains( STORE ) ) {
        const next = db.version + 1;

        db.close();
        db = await openAt( next );
      }

      return db;
    } )().catch( ( error ) => {
      opening = null;
      throw error;
    } );
  }

  return opening;
}

async function store( mode: IDBTransactionMode ): Promise<{ os: IDBObjectStore;
  tx: IDBTransaction }> {
  const db = await openDatabase();
  const tx = db.transaction(
    STORE,
    mode
  );

  return {
    os: tx.objectStore( STORE ),
    tx
  };
}

export function idbBackend(): GalleryBackend {
  return {
    all: async() => {
      const {
        os
      } = await store( "readonly" );

      return request( os.getAll() ) as Promise<GalleryEntry[]>;
    },
    get: async( id ) => {
      const {
        os
      } = await store( "readonly" );

      return request( os.get( id ) ) as Promise<GalleryEntry | undefined>;
    },
    put: async( entry ) => {
      const {
        os, tx
      } = await store( "readwrite" );

      os.put( entry );
      await done( tx );
    },
    delete: async( id ) => {
      const {
        os, tx
      } = await store( "readwrite" );

      os.delete( id );
      await done( tx );
    },
    clear: async() => {
      const {
        os, tx
      } = await store( "readwrite" );

      os.clear();
      await done( tx );
    }
  };
}

export function hasIndexedDB(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    return false;
  }
}
