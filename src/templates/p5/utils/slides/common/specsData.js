import options from "../../options.js";

const MAX_LINES = 40;

// Top-level sketch keys that hold overlay configuration rather than sketch
// parameters — excluded from the flattened spec dump so the boot-log/ticker
// don't list their own (and the title's) settings.
const EXCLUDED_TOP_LEVEL = new Set( [
  "hud",
  "title"
] );

function formatNumber( value ) {
  if ( Number.isInteger( value ) ) {
    return String( value );
  }

  return String( Math.round( value * 100 ) / 100 );
}

function looksLikeColor( arr ) {
  return (
    ( arr.length === 3 || arr.length === 4 ) &&
    arr.every( ( v ) => typeof v === "number" )
  );
}

function formatValue( value ) {
  if ( value === null || value === undefined ) {
    return null;
  }

  switch ( typeof value ) {
    case "number":
      return formatNumber( value );
    case "boolean":
      return value ? "on" : "off";
    case "string":
      return value;
    case "function":
      return null;
    default:
      break;
  }

  if ( Array.isArray( value ) ) {
    if ( looksLikeColor( value ) ) {
      return `rgba(${ value.map( formatNumber ).join( ", " ) })`;
    }

    return `[${ value.length }]`;
  }

  return null; // objects are recursed by the flattener, not formatted here
}

function flatten(
  obj, prefix, out
) {
  if ( !obj || typeof obj !== "object" ) {
    return;
  }

  for ( const key of Object.keys( obj ) ) {
    if ( out.length >= MAX_LINES ) {
      return;
    }

    if ( !prefix && EXCLUDED_TOP_LEVEL.has( key ) ) {
      continue;
    }

    const value = obj[ key ];
    const label = prefix ? `${ prefix }.${ key }` : key;

    if (
      value &&
      typeof value === "object" &&
      !Array.isArray( value )
    ) {
      flatten(
        value,
        label,
        out
      );
      continue;
    }

    const formatted = formatValue( value );

    if ( formatted !== null ) {
      out.push( {
        label: label.toUpperCase(),
        value: formatted
      } );
    }
  }
}

/**
 * Build the list of { label, value } lines displayed by the specs overlay.
 *
 * `specsOption.content` is a list ticked in any combination:
 *   - "general": render options (resolution, framerate, duration, slides)
 *   - "sketch": the flattened sketch settings (options.sketch, already merged
 *     with per-slide overrides via the options proxy)
 */
export default function buildSpecsLines( specsOption ) {
  const content = Array.isArray( specsOption?.content )
    ? specsOption.content
    : [
      "general",
      "sketch"
    ];

  const includeGeneral = content.includes( "general" );
  const includeSketch = content.includes( "sketch" );

  const lines = [];

  if ( includeGeneral ) {
    const size = options.size || {};
    const animation = options.animation || {};
    const slides = options.slides || [];

    const framerate = animation.framerate || 0;
    const duration = animation.duration || 0;

    lines.push(
      {
        label: "RESOLUTION",
        value: `${ size.width || 0 }x${ size.height || 0 }`
      },
      {
        label: "FRAMERATE",
        value: `${ framerate } fps`
      },
      {
        label: "DURATION",
        value: `${ duration }s`
      },
      {
        label: "FRAMES",
        value: String( Math.round( duration * framerate ) )
      },
      {
        label: "SLIDES",
        value: String( slides.length || 1 )
      }
    );
  }

  if ( includeSketch ) {
    flatten(
      options.sketch || {},
      "",
      lines
    );
  }

  return lines;
}
