/**
 * Probe bridge — a sketch's exposed internal values, from the runtime to React.
 *
 * `probe.js` publishes the page's live probes once per frame; the studio reads
 * them here: the HUD source picker lists what the running sketch exposes, and
 * the Probes inspector shows each one's value and write count. A snapshot
 * lands every frame, so — like `channelBridge` — nothing here becomes React
 * state per frame: consumers compare the set of ids and re-render only when a
 * probe appears or disappears, and write live values straight into the DOM.
 *
 * Mirrors `channelBridge`: the engine publishes, the UI reads.
 */

export type ProbeShape = "scalar" | "boolean" | "text" | "point" | "list" | "other";

export type ProbeEntry = {
  /** The name the sketch wrote it under ("head", "arc.t"). */
  name: string;
  value: unknown;
  shape: ProbeShape;
  /** Writes this frame — more than one means the value is a fold. */
  count: number;
  fold: "last" | "min" | "max" | "mean" | "sum" | "count";
  label: string | null;
  unit: string | null;
  min: number | null;
  max: number | null;
  decimals: number | null;
};

export type ProbeSnapshot = ProbeEntry[];

type Subscriber = ( snapshot: ProbeSnapshot ) => void;

let latest: ProbeSnapshot = [];
const subscribers = new Set<Subscriber>();

/** Called by the engine once per frame with the page's live probes. */
export function publishProbes( snapshot: ProbeSnapshot ): void {
  latest = Array.isArray( snapshot ) ? snapshot : [];

  for ( const subscriber of subscribers ) {
    try {
      subscriber( latest );
    } catch {
      // A subscriber must never break the publish loop.
    }
  }
}

/** Latest snapshot, for imperative one-off reads. */
export function getProbesSnapshot(): ProbeSnapshot {
  return latest;
}

/** Subscribe to per-frame probe snapshots. Returns an unsubscribe function. */
export function subscribeProbes( cb: Subscriber ): () => void {
  subscribers.add( cb );

  return () => {
    subscribers.delete( cb );
  };
}

/**
 * Print a probe's value the way the inspector shows it: numbers trimmed of
 * float noise (or to the probe's own `decimals`), booleans as ON / OFF, points
 * as "x, y", lists joined, an absent value as an em dash.
 */
export function formatProbeValue(
  value: unknown, decimals: number | null = null
): string {
  if ( value === null || value === undefined || value === "" ) {
    return "—";
  }

  if ( typeof value === "boolean" ) {
    return value ? "ON" : "OFF";
  }

  if ( typeof value === "number" ) {
    if ( !Number.isFinite( value ) ) {
      return "—";
    }

    if ( decimals !== null ) {
      return value.toFixed( decimals );
    }

    return String( Math.round( value * 10000 ) / 10000 );
  }

  if ( Array.isArray( value ) ) {
    return value.map( ( entry ) => formatProbeValue( entry ) )
      .join( ", " );
  }

  if ( typeof value === "object" ) {
    const point = value as { x?: unknown;
      y?: unknown; };

    if ( typeof point.x === "number" && typeof point.y === "number" ) {
      return `${ formatProbeValue( point.x ) }, ${ formatProbeValue( point.y ) }`;
    }

    return Object.values( value as Record<string, unknown> )
      .map( ( entry ) => formatProbeValue( entry ) )
      .join( ", " );
  }

  return String( value );
}
