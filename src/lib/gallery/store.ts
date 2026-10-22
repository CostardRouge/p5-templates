import {
  hasIndexedDB, idbBackend
} from "./idbBackend";
import {
  memoryBackend
} from "./memoryBackend";
import {
  summarize, type GalleryEntry, type GalleryEntrySummary, type GalleryFilter
} from "./types";

/** The five operations a backend provides; the store does the rest. */
export interface GalleryBackend {
  all: () => Promise<GalleryEntry[]>;
  get: ( id: string ) => Promise<GalleryEntry | undefined>;
  put: ( entry: GalleryEntry ) => Promise<void>;
  delete: ( id: string ) => Promise<void>;
  clear: () => Promise<void>;
}

/**
 * How many entries the gallery keeps. Past it the OLDEST are pruned on every
 * add: at ~30 KB an entry (a 240 px JPEG plus a document) that is ~15 MB,
 * far under any browser's IndexedDB quota, and five pieces a week fill it in
 * two years — the backup (`archive.ts`) is what keeps more.
 */
export const GALLERY_CAP = 500;

function newest(
  a: GalleryEntry, b: GalleryEntry
): number {
  return b.at - a.at || b.id.localeCompare( a.id );
}

export function applyFilter(
  entries: GalleryEntry[], filter: GalleryFilter = {}
): GalleryEntry[] {
  const sorted = entries
    .filter( ( entry ) => ( filter.sketch === undefined || entry.sketch === filter.sketch ) &&
      ( filter.since === undefined || entry.at >= filter.since ) &&
      ( filter.until === undefined || entry.at <= filter.until ) )
    .sort( newest );

  return filter.limit === undefined ? sorted : sorted.slice(
    0,
    Math.max(
      0,
      filter.limit
    )
  );
}

/**
 * The gallery, as both the page and the agent commands use it: newest first,
 * filtered by sketch and date, capped, and observable (`subscribe`) so a page
 * re-reads after a write — its own or an agent's in the same tab.
 */
export class GalleryStore {
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly backend: GalleryBackend, private readonly cap: number = GALLERY_CAP
  ) {}

  async list( filter: GalleryFilter = {} ): Promise<GalleryEntrySummary[]> {
    return applyFilter(
      await this.backend.all(),
      filter
    ).map( summarize );
  }

  /** The entries themselves — documents and thumbnails included. */
  async entries( filter: GalleryFilter = {} ): Promise<GalleryEntry[]> {
    return applyFilter(
      await this.backend.all(),
      filter
    );
  }

  get( id: string ): Promise<GalleryEntry | undefined> {
    return this.backend.get( id );
  }

  /** The newest entry of a sketch, what a keep dedupes against. */
  async latestOf( sketch: string ): Promise<GalleryEntry | undefined> {
    return applyFilter(
      await this.backend.all(),
      {
        sketch,
        limit: 1
      }
    )[ 0 ];
  }

  /** Store an entry, then prune the oldest past the cap. Answers what was pruned. */
  add( entry: GalleryEntry ): Promise<string[]> {
    return this.addMany( [
      entry
    ] );
  }

  /** Store several entries (an archive import), pruning once at the end. */
  async addMany( entries: GalleryEntry[] ): Promise<string[]> {
    for ( const entry of entries ) {
      await this.backend.put( entry );
    }

    const pruned = ( await this.backend.all() )
      .sort( newest )
      .slice( this.cap )
      .map( ( old ) => old.id );

    for ( const id of pruned ) {
      await this.backend.delete( id );
    }
    this.notify();

    return pruned;
  }

  async rename(
    id: string, title: string
  ): Promise<GalleryEntry | undefined> {
    const entry = await this.backend.get( id );

    if ( !entry ) {
      return undefined;
    }

    const renamed = {
      ...entry,
      title: title.trim()
    };

    await this.backend.put( renamed );
    this.notify();

    return renamed;
  }

  async remove( id: string ): Promise<boolean> {
    const entry = await this.backend.get( id );

    if ( !entry ) {
      return false;
    }

    await this.backend.delete( id );
    this.notify();

    return true;
  }

  async clear(): Promise<void> {
    await this.backend.clear();
    this.notify();
  }

  async count(): Promise<number> {
    return ( await this.backend.all() ).length;
  }

  subscribe( listener: () => void ): () => void {
    this.listeners.add( listener );

    return () => {
      this.listeners.delete( listener );
    };
  }

  /** Tell the listeners something changed outside `add`/`rename`/`remove` (an archive import). */
  notify(): void {
    for ( const listener of this.listeners ) {
      listener();
    }
  }
}

let shared: GalleryStore | null = null;

/**
 * The one store of this page: IndexedDB in a browser, memory where there is
 * none (server rendering, a test) so nothing has to check first.
 */
export function getGalleryStore(): GalleryStore {
  if ( !shared ) {
    shared = new GalleryStore( hasIndexedDB() ? idbBackend() : memoryBackend() );
  }

  return shared;
}

/** A unique id: the platform's UUID, or time plus randomness where it has none. */
export function galleryId(): string {
  if ( typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ) {
    return crypto.randomUUID();
  }

  return `${ Date.now().toString( 36 ) }-${ Math.random().toString( 36 )
    .slice( 2 ) }`;
}
