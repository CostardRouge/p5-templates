import {
  getP5
} from "../sketch.js";

/**
 * Per-source ring-buffer history for sparkline widgets. Fed automatically by the
 * sparkline renderer each frame (no push API needed). Keyed on frameCount so it
 * replays identically during recording; multiple appends in one frame overwrite
 * the latest slot.
 *
 * The buffer auto-clears when the p5 instance changes (i.e. between sketches),
 * so values never leak across sketch loads.
 */

const CAP = 180; // ~3s at 60fps

const store = new Map();
let activeP5 = null;

function ensureSession() {
  const p = getP5();

  if ( p !== activeP5 ) {
    store.clear();
    activeP5 = p;
  }
}

export function pushHistory(
  source, value
) {
  if ( !source || typeof value !== "number" || !Number.isFinite( value ) ) {
    return;
  }

  ensureSession();

  let entry = store.get( source );

  if ( !entry ) {
    entry = {
      buf: new Float32Array( CAP ),
      head: 0,
      len: 0,
      lastFrame: -1
    };
    store.set(
      source,
      entry
    );
  }

  const frame = getP5()?.frameCount ?? 0;

  if ( entry.lastFrame === frame && entry.len > 0 ) {
    entry.buf[ ( entry.head - 1 + CAP ) % CAP ] = value;

    return;
  }

  entry.buf[ entry.head ] = value;
  entry.head = ( entry.head + 1 ) % CAP;
  entry.len = Math.min(
    entry.len + 1,
    CAP
  );
  entry.lastFrame = frame;
}

/**
 * History values for `source`, ordered oldest → newest. Empty array if none.
 */
export function series( source ) {
  const entry = store.get( source );

  if ( !entry || entry.len === 0 ) {
    return [];
  }

  const out = new Array( entry.len );
  const start = ( entry.head - entry.len + CAP ) % CAP;

  for ( let i = 0; i < entry.len; i++ ) {
    out[ i ] = entry.buf[ ( start + i ) % CAP ];
  }

  return out;
}
