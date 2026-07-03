/**
 * Pure key-path helpers shared by the HUD runtime (resolving a widget's data
 * source) and the HUD options UI (populating the source dropdown).
 *
 * Deliberately free of any p5 / runtime imports so it can be pulled into the
 * React Template Options bundle as cheaply as into the sketch runtime. The
 * approach mirrors the `specs` overlay: enumerate the keys that already exist
 * in the sketch settings and read a value by its dotted key-path — no probe
 * registry, no runtime→UI bridge.
 */

// Live, computed sources that animate frame to frame (not present in the
// sketch settings tree). Listed first in the dropdown.
export const BUILTIN_SOURCES = [
  {
    value: "frame",
    label: "frame (live)"
  },
  {
    value: "progress%",
    label: "progress % (live)"
  },
  {
    value: "progression",
    label: "progression 0–1 (live)"
  },
  {
    value: "seconds",
    label: "seconds (live)"
  },
  {
    value: "fps",
    label: "fps"
  },
  {
    value: "framerate",
    label: "framerate"
  },
  {
    value: "resolution",
    label: "resolution"
  },
  {
    value: "width",
    label: "width"
  },
  {
    value: "height",
    label: "height"
  },
  {
    value: "duration",
    label: "duration"
  },
  {
    value: "frames",
    label: "frames"
  },
  {
    value: "center",
    label: "center (x, y)"
  },
  {
    value: "mouse",
    label: "mouse (x, y)"
  },
  {
    value: "fill",
    label: "fill (colour)"
  },
  {
    value: "stroke",
    label: "stroke (colour)"
  },
  {
    value: "background",
    label: "background (colour)"
  },
  {
    value: "engine",
    label: "engine label"
  },
  {
    value: "category",
    label: "sketch category"
  },
  {
    value: "name",
    label: "sketch name"
  }
];

export const BUILTIN_SOURCE_KEYS = BUILTIN_SOURCES.map( ( source ) => source.value );

// Overlay-config keys that live alongside sketch params but are not data.
const SKIP_TOP_LEVEL = new Set( [
  "hud",
  "title"
] );

/**
 * Read a value out of `obj` by a dotted key-path ("magnitude.start").
 */
export function getByPath(
  obj, path
) {
  if ( !obj || !path ) {
    return undefined;
  }

  return String( path )
    .split( "." )
    .reduce(
      (
        accumulator, key
      ) => ( accumulator == null ? accumulator : accumulator[ key ] ),
      obj
    );
}

/**
 * Flatten a sketch-settings object into the list of leaf key-paths whose values
 * are scalars (number/string/boolean) — the bindable sources for HUD widgets.
 */
export function flattenKeys(
  obj, prefix = "", out = []
) {
  if ( !obj || typeof obj !== "object" ) {
    return out;
  }

  for ( const key of Object.keys( obj ) ) {
    if ( !prefix && SKIP_TOP_LEVEL.has( key ) ) {
      continue;
    }

    const value = obj[ key ];
    const path = prefix ? `${ prefix }.${ key }` : key;

    if ( value && typeof value === "object" && !Array.isArray( value ) ) {
      flattenKeys(
        value,
        path,
        out
      );
    } else if (
      typeof value === "number" ||
      typeof value === "string" ||
      typeof value === "boolean"
    ) {
      out.push( path );
    }
  }

  return out;
}
