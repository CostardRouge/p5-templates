/**
 * Channel bridge — live interaction values from the sketch runtime to React.
 *
 * The binding system's UI needs to *show* live channel activity (VU meters on
 * the modulation pastilles, the source picker's mini-meters). Driving those
 * from React state at 60fps would thrash the reconciler, so instead the engine
 * pushes the per-frame channel snapshot here and we write it into CSS custom
 * properties on `:root`. VU meters are then pure CSS — `width: calc(var(--ch-osc)
 * * 100%)` — and update every frame with no React render at all.
 *
 * A small pub/sub is kept alongside for the rare consumer that genuinely needs
 * the values in JS (e.g. a future MIDI-learn "wiggle to assign" mode).
 *
 * Mirrors the shape of `animationBridge`: the engine publishes, the UI reads.
 */

export type ScalarChannel = {
  type: "scalar";
  value: number;
};

export type Vector2dChannel = {
  type: "vector2d";
  x: number;
  y: number;
};

export type Channel = ScalarChannel | Vector2dChannel;
export type ChannelSnapshot = Record<string, Channel>;

type Subscriber = ( snapshot: ChannelSnapshot ) => void;

let latest: ChannelSnapshot = {};
const subscribers = new Set<Subscriber>();

// ── CSS custom property naming ──────────────────────────────────────────────
// scalar `osc`            → --ch-osc
// vector2d `mouse`        → --ch-mouse-x, --ch-mouse-y, --ch-mouse-mag,
//                           --ch-mouse-angle   (all normalized 0..1)
// The projections (mag/angle) are precomputed here so the meter for any
// vector2d projection is a plain CSS var lookup — CSS can't do atan2.

function clamp01( v: number ): number {
  if ( v < 0 ) {
    return 0;
  }

  if ( v > 1 ) {
    return 1;
  }

  return v;
}

// Sanitize a channel id for use inside a CSS custom-property name. Ids can be
// dotted/structured (e.g. "audio.level", later "audio.band.0") which isn't a
// valid custom-property ident, so non [A-Za-z0-9_-] chars become "-".
function cssId( id: string ): string {
  return String( id ).replace(
    /[^a-zA-Z0-9_-]/g,
    "-"
  );
}

/** CSS variable name for a (source, projection) pair, matching a binding. */
export function channelVarName(
  source: string, project?: string
): string {
  if ( project ) {
    return `--ch-${ cssId( source ) }-${ project }`;
  }

  return `--ch-${ cssId( source ) }`;
}

// A channel that stops publishing (a device unplugged, a source switched to
// a mode whose sensor has nothing yet) must take its meters with it: a live
// channel that is not there publishes NOTHING, and a var left at its last value
// would show that absence as a frozen reading instead.
function clearCssVars(
  root: CSSStyleDeclaration, previous: ChannelSnapshot, next: ChannelSnapshot
): void {
  for ( const rawId of Object.keys( previous ) ) {
    if ( rawId in next ) {
      continue;
    }

    const id = cssId( rawId );

    for ( const suffix of [
      "",
      "-x",
      "-y",
      "-mag",
      "-angle"
    ] ) {
      root.removeProperty( `--ch-${ id }${ suffix }` );
    }
  }
}

function writeCssVars(
  snapshot: ChannelSnapshot, previous: ChannelSnapshot
): void {
  if ( typeof document === "undefined" ) {
    return;
  }

  const root = document.documentElement.style;

  clearCssVars(
    root,
    previous,
    snapshot
  );

  for ( const [
    rawId,
    channel
  ] of Object.entries( snapshot ) ) {
    const id = cssId( rawId );

    if ( channel.type === "scalar" ) {
      root.setProperty(
        `--ch-${ id }`,
        String( clamp01( channel.value ) )
      );
      continue;
    }

    const x = clamp01( channel.x );
    const y = clamp01( channel.y );
    const mag = clamp01( Math.hypot(
      x - 0.5,
      y - 0.5
    ) / Math.SQRT1_2 );
    const angle = ( Math.atan2(
      y - 0.5,
      x - 0.5
    ) + Math.PI ) / ( 2 * Math.PI );

    root.setProperty(
      `--ch-${ id }-x`,
      String( x )
    );
    root.setProperty(
      `--ch-${ id }-y`,
      String( y )
    );
    root.setProperty(
      `--ch-${ id }-mag`,
      String( mag )
    );
    root.setProperty(
      `--ch-${ id }-angle`,
      String( angle )
    );
  }
}

/**
 * Called by the engine once per frame with the current channel snapshot.
 * Writes CSS vars (for the pure-CSS meters) and notifies any JS subscribers.
 */
export function publishChannels( snapshot: ChannelSnapshot ): void {
  const previous = latest;

  latest = snapshot ?? {};
  writeCssVars(
    latest,
    previous
  );

  for ( const subscriber of subscribers ) {
    try {
      subscriber( latest );
    } catch {
      // A subscriber must never break the publish loop.
    }
  }
}

/** Latest snapshot, for imperative one-off reads. */
export function getChannelsSnapshot(): ChannelSnapshot {
  return latest;
}

// ── Per-binding resolved signals ────────────────────────────────────────────
// The resolver publishes each active binding's normalized 0..1 "tension" keyed
// by its target. The UI's VU meters read `--bind-<target>`, so a meter reflects
// the resolved signal whatever the source is (input channel OR generator) — CSS
// can't compute a sine, but the resolver already has the number.

/** CSS variable name for a binding's resolved signal, by its target path. */
export function bindingSignalVarName( target: string ): string {
  return `--bind-${ String( target ).replace(
    /[^a-zA-Z0-9_-]/g,
    "-"
  ) }`;
}

/** Write each binding's resolved 0..1 signal to its CSS var on `:root`. */
export function publishBindingSignals( signals: Record<string, number> ): void {
  if ( typeof document === "undefined" || !signals ) {
    return;
  }

  const root = document.documentElement.style;

  for ( const [
    target,
    value
  ] of Object.entries( signals ) ) {
    root.setProperty(
      bindingSignalVarName( target ),
      String( clamp01( value ) )
    );
  }
}

/** Subscribe to per-frame channel snapshots. Returns an unsubscribe function. */
/**
 * The name of the MIDI input the engine is listening to, or "" when none is
 * picked (or every input is, which is the same as none for a controller map).
 *
 * Published here rather than imported from the interaction handler because the
 * editor bundle must not pull that module in — it drags MediaPipe behind it.
 * The engine already publishes a channel snapshot through this bridge every
 * frame; the port name rides along on the same path.
 */
let midiPort = "";

export function publishMidiPortName( name: string ): void {
  midiPort = typeof name === "string" ? name : "";
}

export function getMidiPortName(): string {
  return midiPort;
}

export function subscribeChannels( cb: Subscriber ): () => void {
  subscribers.add( cb );

  return () => {
    subscribers.delete( cb );
  };
}
