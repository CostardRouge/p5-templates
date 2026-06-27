// ── Pure channel adapter ────────────────────────────────────────────────────
// The pure part of the interaction→channel mapping, split out from channels.js
// so it is unit-testable WITHOUT importing the heavy interaction handler module
// (index.js → MediaPipe). channels.js imports these.

export function clamp01( v ) {
  if ( v < 0 ) {
    return 0;
  }

  if ( v > 1 ) {
    return 1;
  }

  return v;
}

/**
 * Map `getPointersDebug()` output — `[{ vector, source }]` in canvas-pixel
 * space — to normalized vector2d channels keyed by source. Keeps the FIRST
 * vector per source (indexed channels like hands.0 / audio.band.N are a future
 * follow-up) and normalizes each by the canvas dimensions. Out-of-canvas
 * vectors clamp to 0..1; a zero-sized canvas falls back to the center.
 *
 * @param {Array<{ vector: { x: number, y: number }, source: string }>} tagged
 * @param {number} width
 * @param {number} height
 * @returns {Record<string, { type: "vector2d", x: number, y: number }>}
 */
export function buildChannelsFromDebug(
  tagged, width, height
) {
  const channels = {};

  if ( !Array.isArray( tagged ) ) {
    return channels;
  }

  const safe = width > 0 && height > 0;

  for ( const item of tagged ) {
    if ( !item || !item.source || channels[ item.source ] ) {
      continue; // first vector per source wins
    }

    const v = item.vector;

    if ( !v ) {
      continue;
    }

    channels[ item.source ] = safe
      ? {
        type: "vector2d",
        x: clamp01( v.x / width ),
        y: clamp01( v.y / height )
      }
      : {
        type: "vector2d",
        x: 0.5,
        y: 0.5
      };
  }

  return channels;
}
