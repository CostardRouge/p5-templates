import {
  LEGACY_HUD_WIDGETS
} from "@/types/sketch.types";

/**
 * Legacy-shape migration for the HUD split.
 *
 * The HUD used to be ONE content item (`type: "hud"`) carrying a slot per
 * telemetry widget plus a shared style the slots inherited. Widgets are now
 * standalone content-item types (`hud-badge`, `hud-gauge`, …), so this expands
 * every legacy container into sibling items at its position, in the old draw
 * order (boundingBox lowest → badge on top) so the stacking the renderer used
 * to force is reproduced by array order.
 *
 * It MUST run BEFORE `OptionsSchema` parses: `content` is a strictly-parsed
 * discriminated union, so an unrecognised `type: "hud"` would fail the array
 * and initOptions' top-level `.catch` would reset the WHOLE options to
 * defaults (see durationBoundary.test.ts for that hazard). That is also why
 * every slot is `safeParse`d here — a malformed slot heals to nothing instead
 * of resurrecting the nuke downstream.
 *
 * Expansion rule, per slot: keep iff it was enabled OR its config (the
 * `enabled` flag aside) differs from the slot's own parsed defaults — "was
 * visible, or was configured". A pristine container therefore expands to
 * exactly gauge + sparkline (the two slots that defaulted to enabled — visual
 * parity with what rendered), a disabled-but-customised slot survives as a
 * disabled item (toggleable from the layers list), and slots that were merely
 * left or switched off are dropped so no container explodes into seven
 * layers. The container's shared style flows into each expanded item wherever
 * the slot did not override it.
 *
 * NON-MUTATING, same discipline as migrateInteractiveOptions: the input is
 * shared by reference with page props and the live store, so touched holders
 * are shallow-copied and the original object is returned untouched (===) when
 * no legacy item exists. Storage is never rewritten — persisted presets and
 * jobs migrate lazily on every read.
 */

type AnyRecord = Record<string, any>;

const CONTAINER_STYLE_DEFAULTS = {
  fill: [
    0,
    255,
    120,
    255
  ],
  font: "spaceMonoRegular",
  blend: "source-over",
  backgroundColor: [
    0,
    0,
    0,
    0
  ],
  backgroundStroke: [
    0,
    255,
    120,
    0
  ],
  backgroundRadius: 0
};

// The two overlay types draw no background panel and carry no background
// fields; the container's panel style must not be copied onto them.
const OVERLAY_TYPES = new Set( [
  "hud-crosshairs",
  "hud-bounding-box"
] );

// The "was configured" comparison ignores `enabled`: flipping a slot off is a
// statement that the widget isn't wanted, not configuration worth carrying
// over as a disabled layer.
function slotConfigJson( slot: AnyRecord ): string {
  const {
    enabled: _enabled, ...config
  } = slot;

  return JSON.stringify( config );
}

// Per-widget JSON of the slot's parsed defaults, computed once. Both operands
// of the "differs from defaults" comparison come out of the same zod schema,
// so key order is schema-declaration order and JSON equality is deterministic.
const defaultSlotJson = new Map( LEGACY_HUD_WIDGETS.map( ( widget ) => [
  widget.key,
  slotConfigJson( widget.legacy.parse( {} ) )
] ) );

function expandHudItem( raw: AnyRecord ): AnyRecord[] {
  const style = {
    fill: raw.fill ?? CONTAINER_STYLE_DEFAULTS.fill,
    font: raw.font ?? CONTAINER_STYLE_DEFAULTS.font,
    blend: raw.blend ?? CONTAINER_STYLE_DEFAULTS.blend,
    backgroundColor: raw.backgroundColor ?? CONTAINER_STYLE_DEFAULTS.backgroundColor,
    backgroundStroke: raw.backgroundStroke ?? CONTAINER_STYLE_DEFAULTS.backgroundStroke,
    backgroundRadius: raw.backgroundRadius ?? CONTAINER_STYLE_DEFAULTS.backgroundRadius
  };

  const items: AnyRecord[] = [];

  for ( const widget of LEGACY_HUD_WIDGETS ) {
    const parsed = widget.legacy.safeParse( raw[ widget.key ] ?? {} );

    if ( !parsed.success ) {
      continue;
    }

    const slot = parsed.data as AnyRecord;
    const keep =
      slot.enabled === true ||
      slotConfigJson( slot ) !== defaultSlotJson.get( widget.key );

    if ( !keep ) {
      continue;
    }

    const item = widget.item.safeParse( {
      ...slot,
      type: widget.type,
      fill: slot.fill ?? style.fill,
      font: slot.font ?? style.font,
      blend: slot.blend ?? style.blend,
      ...( OVERLAY_TYPES.has( widget.type )
        ? {}
        : {
          backgroundColor: style.backgroundColor,
          backgroundStroke: style.backgroundStroke,
          backgroundRadius: style.backgroundRadius
        } )
    } );

    if ( item.success ) {
      items.push( item.data );
    }
  }

  return items;
}

function migrateList( content: unknown ): unknown {
  if ( !Array.isArray( content ) ) {
    return content;
  }

  if ( !content.some( ( item ) => item?.type === "hud" ) ) {
    return content;
  }

  return content.flatMap( ( item ) =>
    item?.type === "hud" ? expandHudItem( item ) : [
      item
    ] );
}

export default function migrateLegacyHudItems<T>( options: T ): T {
  if ( !options || typeof options !== "object" || Array.isArray( options ) ) {
    return options;
  }

  const record = options as AnyRecord;
  let migrated: AnyRecord = record;

  const content = migrateList( record.content );

  if ( content !== record.content ) {
    migrated = {
      ...migrated,
      content
    };
  }

  if ( Array.isArray( record.slides ) ) {
    let slidesChanged = false;
    const slides = record.slides.map( ( slide: AnyRecord ) => {
      const slideContent = migrateList( slide?.content );

      if ( slideContent === slide?.content ) {
        return slide;
      }

      slidesChanged = true;

      return {
        ...slide,
        content: slideContent
      };
    } );

    if ( slidesChanged ) {
      migrated = migrated === record
        ? {
          ...migrated,
          slides
        }
        : Object.assign(
          migrated,
          {
            slides
          }
        );
    }
  }

  return migrated as T;
}
