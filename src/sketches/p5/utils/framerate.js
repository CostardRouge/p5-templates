/**
 * Normalise a framerate coming from the option store or an engine event.
 *
 * Options travel through JSON imports, persisted jobs and form inputs, so a
 * framerate can arrive as a numeric string. p5's `frameRate()` silently
 * ignores anything that isn't a number — the loop keeps running at the old
 * rate with no error — so every call site funnels through this guard.
 *
 * @returns {number|null} a finite framerate > 0, or null when unusable.
 */
export function coerceFramerate( value ) {
  const fps = Number( value );

  if ( !Number.isFinite( fps ) || fps <= 0 ) {
    return null;
  }

  return fps;
}
