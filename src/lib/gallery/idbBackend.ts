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

function openDatabase(): Promise<IDBDatabase> {
  if ( !opening ) {
    opening = new Promise( (
      resolve, reject
    ) => {
      const req = indexedDB.open(
        GALLERY_DB_NAME,
        DB_VERSION
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
      req.onerror = () => {
        opening = null;
        reject( req.error ?? new Error( "IndexedDB could not be opened" ) );
      };
      req.onblocked = () => {
        opening = null;
        reject( new Error( "IndexedDB is blocked by another tab" ) );
      };
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
