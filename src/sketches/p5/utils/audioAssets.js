import {
  resolveAssetURL
} from "@/lib/assets/resolveAssetURL";
import {
  trackPendingMedia
} from "@/lib/assets/pendingMedia";

import audio from "./audio.js";
import cache from "./cache.js";
import options from "./options.js";
import {
  collectAudioPaths, isAudioPath
} from "./audioPaths.js";

/**
 * Audio assets: sound files uploaded through the form (an `asset` field of
 * kind `audios`) or shipped under `public/assets`, decoded once and handed to
 * the sketch audio engine.
 *
 * The sample is registered in `audio.js` under its own asset PATH, so
 * `audio.trigger( path )` — or the `play()` below — fires it exactly like a
 * built-in synth voice. That single detail is what makes uploaded sounds work
 * everywhere for free:
 *
 *   - live preview plays them through the master gain;
 *   - the realtime recorder muxes them from the same master gain;
 *   - the deterministic (async-loop / server) recorder logs the trigger with
 *     its sketch-time stamp and replays the sample offline, sample-accurate
 *     against the rendered frames.
 *
 * Loading is idempotent and reactive: call `sync( node )` with any options
 * block and every audio-looking string under it is decoded once. A path whose
 * URL changes (a fresh upload resolves to a `blob:` first, then to S3) is
 * re-decoded; anything else is a Map lookup, so calling `sync` every frame is
 * free.
 *
 * This module is deliberately NOT wired into `options.js` the way images are:
 * importing it pulls in `audio.js`, which registers the audio bridge and would
 * therefore add a (silent) audio track to every recording of every sketch.
 * Sound is opt-in — a sketch that wants it imports this module.
 */

/** @type {Map<string, { path: string, filename: string, url: string, status: "loading"|"ready"|"error", buffer: AudioBuffer|null }>} */
const _assets = new Map();

// Last `sync()` path set, so the common no-change frame costs one join.
let _signature = null;

cache.set(
  "audiosMap",
  _assets
);

/**
 * Decode `path` and register it as a playable sample. Returns the asset entry
 * (already loading / ready ones are returned untouched), or `null` when the
 * value isn't an audio path.
 */
export function load( path ) {
  if ( !isAudioPath( path ) ) {
    return null;
  }

  const url = resolveAssetURL(
    path,
    options.id
  );

  if ( !url ) {
    return null;
  }

  const existing = _assets.get( path );

  // Re-decode only when the file behind the path actually moved (blob → S3),
  // or after a failure — a ready sample is never fetched twice.
  if ( existing && existing.url === url && existing.status !== "error" ) {
    return existing;
  }

  const entry = {
    path,
    filename: path.split( "/" ).pop(),
    url,
    status: "loading",
    buffer: null
  };

  _assets.set(
    path,
    entry
  );

  // Tracked as pending media so a capture that waits for in-flight media
  // never renders its audio before the samples are decoded.
  trackPendingMedia( audio
    .loadSample(
      path,
      url
    )
    .then( ( buffer ) => {
      // A newer load for the same path (re-upload) already replaced us.
      if ( _assets.get( path ) !== entry ) {
        return buffer;
      }

      entry.buffer = buffer ?? null;
      entry.status = buffer ? "ready" : "error";

      return buffer;
    } ) );

  return entry;
}

/**
 * Decode every audio path reachable from `node` (an options block, an array,
 * a single path). Cheap to call every frame: the collected set is compared
 * against the previous one and only new paths hit `load()`.
 */
export function sync( node ) {
  const paths = collectAudioPaths( node );
  const signature = paths.join( "|" );

  if ( signature === _signature ) {
    return paths;
  }

  _signature = signature;
  paths.forEach( load );

  return paths;
}

/** True once `path` is decoded and can be triggered. */
export function ready( path ) {
  return _assets.get( path )?.status === "ready";
}

/** The asset entry for `path` (status / buffer / resolved url), if any. */
export function get( path ) {
  return _assets.get( path );
}

/** Every known asset entry, for debugging / HUD readouts. */
export function list() {
  return [
    ..._assets.values()
  ];
}

/**
 * Fire an uploaded sound. No-op (returning false) when the asset is missing or
 * still decoding, so a caller can fall back to a synth voice.
 *
 * @param {string} path - The asset path, as stored in the options.
 * @param {{ gain?: number, playbackRate?: number }} [params]
 * @returns {boolean} whether the sound was triggered.
 */
export function play(
  path, params
) {
  if ( !ready( path ) ) {
    return false;
  }

  audio.trigger(
    path,
    params
  );

  return true;
}

/**
 * Forget the sync signature so the next `sync()` re-resolves every URL.
 * Call from sketch setup — decoded samples themselves stay registered in the
 * audio engine, so a restart never re-fetches a file that hasn't moved.
 */
export function reset() {
  _signature = null;
}

const audioAssets = {
  load,
  sync,
  ready,
  get,
  list,
  play,
  reset
};

export default audioAssets;
