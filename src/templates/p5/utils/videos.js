import {
  subscribeSketchOptions
} from "@/p5/shared/syncSketchOptions.js";

import {
  createVideoSync
} from "@/lib/assets/kinds/videos/createVideoSync";

import animation from "./animation.js";
import events from "./events.js";
import options from "./options.js";
import {
  getP5
} from "./sketch.js";

/**
 * Per-sketch video pool that owns a `p5.Graphics` buffer per active video.
 *
 * Each frame (on `pre-draw`) the pool:
 *   1. nudges every `VideoSource` toward the sketch progression
 *      (fire-and-forget — the `<video>` element keeps its last decoded
 *      frame while a seek is in flight, so there is no black gap), and
 *   2. blits the current frame of each `<video>` into its dedicated
 *      `p5.Graphics` sized to the video's native resolution.
 *
 * Sketches then read `pool.first()` / `pool.list()` and draw the buffer
 * with `p.image(item.graphics, …)` — which works identically in 2D and
 * WEBGL (it becomes a textured quad in 3D mode).
 *
 * The pool is reactive: a video added after `setup()` is picked up via
 * `subscribeSketchOptions`, and a removed video disposes its buffer.
 */
function attach( getInstances ) {
  // Sweep `<video>` elements left behind by a previous sketch / hot reload.
  document
    .querySelectorAll( "video[data-video-asset]" )
    .forEach( ( element ) => element.remove() );

  const sync = createVideoSync( {
    getInstances,
    jobId: () => options.id,
    subscribe: ( onChange ) => subscribeSketchOptions( onChange )
  } );

  /** @type {Map<import("@/lib/assets").VideoSource, { graphics: any, sw: number, sh: number }>} */
  const buffers = new Map();

  function syncBuffer( source ) {
    source.seekToProgression( animation.progression ).catch( () => {} );

    const sw = source.element.videoWidth;
    const sh = source.element.videoHeight;

    if ( !sw || !sh ) {
      return null; // metadata not ready yet
    }

    let buffer = buffers.get( source );

    if ( !buffer || buffer.sw !== sw || buffer.sh !== sh ) {
      const p = getP5();

      if ( !p ) {
        return null;
      }

      buffer?.graphics.remove?.();
      buffer = {
        graphics: p.createGraphics(
          sw,
          sh
        ),
        sw,
        sh
      };
      buffers.set(
        source,
        buffer
      );
    }

    buffer.graphics.drawingContext.drawImage(
      source.element,
      0,
      0,
      sw,
      sh
    );

    return buffer;
  }

  function update() {
    const live = sync.sources();
    const alive = new Set( live );

    for ( const source of live ) {
      syncBuffer( source );
    }

    // Dispose buffers whose source is gone.
    for ( const [
      source,
      buffer
    ] of buffers ) {
      if ( !alive.has( source ) ) {
        buffer.graphics.remove?.();
        buffers.delete( source );
      }
    }
  }

  const unregisterPreDraw = events.register(
    "pre-draw",
    update
  );

  function describe( source ) {
    const buffer = buffers.get( source );

    return {
      source,
      graphics: buffer?.graphics,
      ready: Boolean( buffer?.graphics )
    };
  }

  return {
    /** All live videos, in option order. Items may be `ready: false` while loading. */
    list() {
      return sync.sources().map( describe );
    },

    /** First live video, or `undefined` when the pool is empty. */
    first() {
      const [
        head
      ] = sync.sources();

      return head ? describe( head ) : undefined;
    },

    /** Tear down everything: buffers, video elements, subscriptions. */
    dispose() {
      unregisterPreDraw();
      sync.dispose();
      for ( const buffer of buffers.values() ) {
        buffer.graphics.remove?.();
      }
      buffers.clear();
    }
  };
}

export default {
  attach
};
