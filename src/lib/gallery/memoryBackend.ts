import type {
  GalleryBackend
} from "./store";
import type {
  GalleryEntry
} from "./types";

/**
 * The store's shape over a Map: for tests, and for a runtime without
 * IndexedDB (server rendering, a locked-down browser), where the gallery then
 * lasts as long as the page.
 */
export function memoryBackend( seed: GalleryEntry[] = [] ): GalleryBackend {
  const entries = new Map( seed.map( ( entry ) => [
    entry.id,
    entry
  ] ) );

  return {
    all: async() => [
      ...entries.values()
    ],
    get: async( id ) => entries.get( id ),
    put: async( entry ) => {
      entries.set(
        entry.id,
        entry
      );
    },
    delete: async( id ) => {
      entries.delete( id );
    },
    clear: async() => {
      entries.clear();
    }
  };
}
