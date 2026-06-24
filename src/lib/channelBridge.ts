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

/** CSS variable name for a (source, projection) pair, matching a binding. */
export function channelVarName(
  source: string, project?: string
): string {
  if ( project ) {
    return `--ch-${ source }-${ project }`;
  }

  return `--ch-${ source }`;
}

function writeCssVars( snapshot: ChannelSnapshot ): void {
  if ( typeof document === "undefined" ) {
    return;
  }

  const root = document.documentElement.style;

  for ( const [
    id,
    channel
  ] of Object.entries( snapshot ) ) {
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
  latest = snapshot ?? {};
  writeCssVars( latest );

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

/** Subscribe to per-frame channel snapshots. Returns an unsubscribe function. */
export function subscribeChannels( cb: Subscriber ): () => void {
  subscribers.add( cb );

  return () => {
    subscribers.delete( cb );
  };
}
