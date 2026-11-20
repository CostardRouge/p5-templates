/**
 * One value kept in this browser's `localStorage` — `planStore`'s shape made
 * once for the two things statistics keep (the level, the readings): the same
 * object comes back until something changes (it feeds `useSyncExternalStore`),
 * a change tells every reader of this tab, and the `storage` event carries it
 * to the other tabs. Where there is no storage (a server render, a test) the
 * value lasts as long as the module.
 */

export interface Kept<T> {
  get: () => T;
  update: ( change: ( value: T ) => T ) => T;
  subscribe: ( listener: () => void ) => () => void;
  /** Forget everything, storage or not. */
  clear: () => void;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function kept<T>(
  key: string, read: ( raw: unknown ) => T
): Kept<T> {
  const empty = read( null );
  const listeners = new Set<() => void>();
  let memory = empty;
  let cache: { raw: string | null;
    value: T } | null = null;

  const get = (): T => {
    const store = storage();

    if ( !store ) {
      return memory;
    }

    let raw: string | null = null;

    try {
      raw = store.getItem( key );
    } catch {
      return empty;
    }

    if ( cache && cache.raw === raw ) {
      return cache.value;
    }

    let parsed: unknown = null;

    try {
      parsed = JSON.parse( raw ?? "null" );
    } catch {
      // Not ours: start over.
    }

    cache = {
      raw,
      value: read( parsed )
    };

    return cache.value;
  };

  return {
    get,
    update( change ) {
      const next = change( get() );
      const store = storage();

      if ( !store ) {
        memory = next;
      }

      try {
        store?.setItem(
          key,
          JSON.stringify( next )
        );
      } catch {
        // Storage full or off: the value lasts as long as the page.
        cache = {
          raw: cache?.raw ?? null,
          value: next
        };
      }

      listeners.forEach( ( listener ) => listener() );

      return get();
    },
    subscribe( listener ) {
      const onStorage = ( event: StorageEvent ) => {
        if ( event.key === key || event.key === null ) {
          listener();
        }
      };

      listeners.add( listener );
      if ( typeof window !== "undefined" ) {
        window.addEventListener(
          "storage",
          onStorage
        );
      }

      return () => {
        listeners.delete( listener );
        if ( typeof window !== "undefined" ) {
          window.removeEventListener(
            "storage",
            onStorage
          );
        }
      };
    },
    clear() {
      memory = empty;
      cache = null;
      try {
        storage()?.removeItem( key );
      } catch {
        // Nothing kept.
      }
      listeners.forEach( ( listener ) => listener() );
    }
  };
}
