import type {
  AssetInstance
} from "../../types";
import {
  loadVideoAsset, type VideoSource
} from "./loadVideoAsset";
import type {
  VideoParams
} from "./types";

export type VideoSyncOptions = {
  /** Reads the current ordered list of video instances from sketch options. */
  getInstances: () => AssetInstance<VideoParams>[] | undefined;
  /** Resolves the job id (for S3-backed paths) at refresh time. */
  jobId?: () => string | undefined;
  /**
   * Subscribe to option changes. Called once; the returned function is
   * invoked on teardown. When provided, the manager refreshes itself on
   * every change so videos added/removed after setup are picked up.
   */
  subscribe?: ( onChange: () => void ) => () => void;
  /** When `false`, video elements stay visible (debugging). */
  hidden?: boolean;
};

/**
 * Keeps a set of live {@link VideoSource}s in sync with the video instances
 * stored in sketch options, keyed by instance id:
 *
 *  - new instance        → `loadVideoAsset`
 *  - removed instance     → `dispose`
 *  - same id, new path    → `source.load(newPath)` (reuses the element)
 *  - same id, new params  → `source.updateParams`
 *
 * This is what makes video assets resilient to being added *after* the
 * sketch's `setup()` ran: as long as a `subscribe` is provided, the pool
 * reacts to option changes and loads the video on the fly.
 */
export type VideoSync = {
  /** Live sources, in the same order as the option instances. */
  sources(): VideoSource[];
  /** The first source, or `undefined` when none. Convenience for single-video sketches. */
  first(): VideoSource | undefined;
  /** Re-diff against the current instances. Called automatically on change. */
  refresh(): void;
  /** Dispose every source and unsubscribe. */
  dispose(): void;
};

export function createVideoSync( options: VideoSyncOptions ): VideoSync {
  const byId = new Map<string, VideoSource>();
  let order: string[] = [];

  function refresh(): void {
    const instances = options.getInstances() ?? [];
    const jobId = options.jobId?.();
    const seen = new Set<string>();

    order = [];

    for ( const instance of instances ) {
      if ( !instance?.id ) {
        continue;
      }

      seen.add( instance.id );
      order.push( instance.id );

      const existing = byId.get( instance.id );

      if ( !existing ) {
        byId.set(
          instance.id,
          loadVideoAsset(
            instance,
            {
              jobId,
              hidden: options.hidden
            }
          )
        );
        continue;
      }

      // Reuse the element: load() bails early when the path is unchanged
      // but always refreshes params, so this covers both path and param
      // changes in one call.
      if ( existing.path !== instance.path ) {
        existing.load( instance );
      } else {
        existing.updateParams( instance.params );
      }
    }

    // Dispose sources whose instance disappeared.
    for ( const [
      id,
      source
    ] of byId ) {
      if ( !seen.has( id ) ) {
        source.dispose();
        byId.delete( id );
      }
    }
  }

  const unsubscribe = options.subscribe?.( refresh );

  refresh();

  return {
    sources() {
      return order
        .map( ( id ) => byId.get( id ) )
        .filter( ( source ): source is VideoSource => Boolean( source ) );
    },

    first() {
      const id = order[ 0 ];

      return id ? byId.get( id ) : undefined;
    },

    refresh,

    dispose() {
      unsubscribe?.();
      for ( const source of byId.values() ) {
        source.dispose();
      }
      byId.clear();
      order = [];
    }
  };
}
