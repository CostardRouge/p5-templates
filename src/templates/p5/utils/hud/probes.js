import {
  getP5
} from "../sketch.js";

/**
 * Probe registry for the HUD / telemetry overlay.
 *
 * A sketch pushes named values once per frame from its draw() loop:
 *
 *   import hud from "@/p5/utils/hud/index.js";
 *   hud.push( "speed", velocity.mag(), { unit: "px/f" } );
 *
 * Widgets later bind to those names. Numeric probes also feed a fixed-capacity
 * ring buffer so sparkline widgets can plot recent history.
 *
 * Determinism: history is keyed on p5's frameCount (never wall-clock), so two
 * recordings of the same options replay an identical buffer. Multiple push()
 * calls for the same probe within a single frame overwrite the latest slot
 * instead of appending, keeping the buffer frame-aligned.
 */

const HISTORY_CAP = 180; // ~3s at 60fps

function currentFrame() {
  return getP5()?.frameCount ?? 0;
}

const probes = {
  values: new Map(),
  history: new Map(),

  /**
   * Push a value for `name`. Returns `value` so it can wrap an expression.
   * `meta` may carry { label, unit, color } used by widgets for display.
   */
  push(
    name, value, meta = {}
  ) {
    this.values.set(
      name,
      {
        value,
        ...meta
      }
    );

    if ( typeof value === "number" && Number.isFinite( value ) ) {
      this._appendHistory(
        name,
        value
      );
    }

    return value;
  },

  /**
   * Optionally pre-seed a probe's label/unit/color before its first value.
   * Not required — push() auto-creates entries.
   */
  register(
    name, meta = {}
  ) {
    if ( !this.values.has( name ) ) {
      this.values.set(
        name,
        {
          value: meta.value ?? 0,
          ...meta
        }
      );
    }

    return name;
  },

  get( name ) {
    return this.values.get( name )?.value;
  },

  getMeta( name ) {
    return this.values.get( name );
  },

  has( name ) {
    return this.values.has( name );
  },

  _appendHistory(
    name, value
  ) {
    let entry = this.history.get( name );

    if ( !entry ) {
      entry = {
        buf: new Float32Array( HISTORY_CAP ),
        head: 0,
        len: 0,
        lastFrame: -1
      };
      this.history.set(
        name,
        entry
      );
    }

    const frame = currentFrame();

    // Same frame → refine the most recently written slot rather than append.
    if ( entry.lastFrame === frame && entry.len > 0 ) {
      const lastIndex = ( entry.head - 1 + HISTORY_CAP ) % HISTORY_CAP;

      entry.buf[ lastIndex ] = value;

      return;
    }

    entry.buf[ entry.head ] = value;
    entry.head = ( entry.head + 1 ) % HISTORY_CAP;
    entry.len = Math.min(
      entry.len + 1,
      HISTORY_CAP
    );
    entry.lastFrame = frame;
  },

  /**
   * History values for `name`, ordered oldest → newest. Empty array if none.
   */
  series( name ) {
    const entry = this.history.get( name );

    if ( !entry || entry.len === 0 ) {
      return [];
    }

    const out = new Array( entry.len );
    const start = ( entry.head - entry.len + HISTORY_CAP ) % HISTORY_CAP;

    for ( let i = 0; i < entry.len; i++ ) {
      out[ i ] = entry.buf[ ( start + i ) % HISTORY_CAP ];
    }

    return out;
  },

  reset() {
    this.values.clear();
    this.history.clear();
  }
};

export default probes;
