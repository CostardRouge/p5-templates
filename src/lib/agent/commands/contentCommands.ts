/**
 * Content items — text, title, image, QR code, HUD widgets, sketch layers,
 * background… — on the root (shown on every slide) or a slide's own list:
 * add, change, remove, duplicate, reorder, show/hide, place, select. Built as
 * the content rail builds them (`makeDefaultItem`), checked by the app's own
 * schema, written through the form.
 */
import {
  CommandError, isRecord, type CommandSpec
} from "../../../../scripts/mcp/registry.ts";
import {
  mergeOptions
} from "../../../../scripts/mcp/sketchForm.ts";
import {
  leafWrites, sketchBase, type StudioHandles
} from "../handles";
import {
  targetSlide
} from "./sketchCommands";

/** The kinds the content rail offers (`item-kinds.ts`). */
export const ITEM_KINDS = [
  "text",
  "title",
  "image",
  "images-stack",
  "qrcode",
  "background",
  "meta",
  "specs",
  "breakdown",
  "sketch",
  "hud-badge",
  "hud-gauge",
  "hud-sparkline",
  "hud-counter",
  "hud-crosshairs",
  "hud-swatch",
  "hud-readout",
  "hud-vector",
  "hud-bounding-box"
] as const;

/** Placed by `offset` (`contentDrag.js` OFFSET_DRAGGABLE_TYPES), the rest by `position`. */
const OFFSET_PLACED = new Set( [
  "hud-badge",
  "hud-gauge",
  "hud-sparkline",
  "hud-counter",
  "hud-swatch",
  "hud-readout",
  "hud-vector"
] );
/** Placed by `position` (`contentDrag.js` DRAGGABLE_TYPES). */
const POSITION_PLACED = new Set( [
  "text",
  "title",
  "image",
  "images-stack",
  "qrcode",
  "specs",
  "breakdown",
  "sketch"
] );

const ITEM_PATH = /^(content|slides\.(\d+)\.content)\.(\d+)$/;

export type ItemAddress = { list: string;
  index: number };

/** `content.2` / `slides.1.content.0` → its list and index, or a refusal. */
export function parseItemPath( path: unknown ): ItemAddress {
  const match = ITEM_PATH.exec( String( path ) );

  if ( !match ) {
    throw new CommandError(
      "invalid",
      `"${ String( path ) }" is not a content item path — "content.<n>" (on every slide) or "slides.<s>.content.<n>" (content.list shows them)`
    );
  }

  return {
    list: match[ 1 ],
    index: Number( match[ 3 ] )
  };
}

function listAt(
  h: StudioHandles, list: string
): Record<string, unknown>[] {
  const items = h.getValues( list );

  return Array.isArray( items ) ? items as Record<string, unknown>[] : [];
}

function itemAt(
  h: StudioHandles, path: unknown
): { address: ItemAddress;
  item: Record<string, unknown>;
  items: Record<string, unknown>[] } {
  const address = parseItemPath( path );
  const items = listAt(
    h,
    address.list
  );
  const item = items[ address.index ];

  if ( !item ) {
    throw new CommandError(
      "invalid",
      `no item at ${ String( path ) } — ${ address.list } holds ${ items.length }`
    );
  }

  return {
    address,
    item,
    items
  };
}

/** Where a new item goes: the active (or named) slide's list, the root's when asked or when there are no slides. */
function addList(
  h: StudioHandles, scope: unknown, slide: unknown
): string {
  if ( scope === "global" ) {
    return "content";
  }

  const index = targetSlide(
    h,
    slide
  );

  if ( index === undefined ) {
    if ( scope === "slide" ) {
      throw new CommandError(
        "invalid",
        "this piece has no slides — slides.add makes one, or use scope \"global\""
      );
    }

    return "content";
  }

  return `slides.${ index }.content`;
}

/** The app's schema verdict on one item, issues re-pathed onto the item. */
function checkedItem(
  h: StudioHandles, item: Record<string, unknown>, where: string
): Record<string, unknown> {
  const verdict = h.validateDocument( {
    content: [
      item
    ]
  } );

  if ( verdict.issues.length ) {
    throw new CommandError(
      "invalid",
      `${ where } does not fit its schema — ${ verdict.issues.slice(
        0,
        8
      ).map( ( issue ) => `${ issue.path.replace(
        /^content\.0\.?/,
        ""
      ) || "(item)" }: ${ issue.message }` )
        .join( "; " ) }`
    );
  }

  const normalized = verdict.normalized?.content;

  return Array.isArray( normalized ) && isRecord( normalized[ 0 ] ) ? normalized[ 0 ] : item;
}

function summary(
  item: Record<string, unknown>, path: string
) {
  const label = [
    "content",
    "source",
    "sketch",
    "text",
    "url"
  ].map( ( key ) => item[ key ] ).find( ( value ) => typeof value === "string" && value !== "" );

  return {
    path,
    type: item.type,
    ...( typeof item.enabled === "boolean" ? {
      enabled: item.enabled
    } : {} ),
    ...( label ? {
      label: String( label ).slice(
        0,
        80
      )
    } : {} ),
    ...( isRecord( item.position ) ? {
      position: item.position
    } : {} ),
    ...( isRecord( item.offset ) ? {
      offset: item.offset
    } : {} )
  };
}

const PATH_PARAM = {
  path: {
    type: "string" as const,
    description: "Item path from content.list: \"content.<n>\" or \"slides.<s>.content.<n>\""
  }
};

export function contentCommands( h: StudioHandles ): CommandSpec[] {
  return [
    {
      id: "content.kinds",
      title: "Content item kinds",
      description: "Every kind of content item with its fields and their defaults (text, title, image, qrcode, background, meta, specs, breakdown, sketch layer, the nine hud-* widgets…). Give a kind for one.",
      params: {
        kind: {
          type: "string",
          description: "One kind",
          enum: ITEM_KINDS,
          optional: true
        }
      },
      run( params ) {
        const kinds = params.kind ? [
          params.kind as string
        ] : [
          ...ITEM_KINDS
        ];

        return Object.fromEntries( kinds.map( ( kind ) => [
          kind,
          h.makeItem(
            kind,
            {}
          )
        ] ) );
      }
    },
    {
      id: "content.list",
      title: "List content items",
      description: "The content items of the root (drawn on every slide) and of each slide, in drawing order, with the path every other content command takes.",
      run() {
        const slides = h.getValues( "slides" );

        return {
          global: listAt(
            h,
            "content"
          ).map( (
            item, i
          ) => summary(
            item,
            `content.${ i }`
          ) ),
          slides: ( Array.isArray( slides ) ? slides : [] ).map( (
            _, s
          ) => listAt(
            h,
            `slides.${ s }.content`
          ).map( (
            item, i
          ) => summary(
            item,
            `slides.${ s }.content.${ i }`
          ) ) ),
          activeSlide: h.activeSlide() ?? null
        };
      }
    },
    {
      id: "content.add",
      title: "Add a content item",
      description: "Add a content item — e.g. { kind: \"text\", fields: { content: \"HELLO\", size: 96, fill: [255,255,255], position: { x: 0.5, y: 0.8 } } } — to the active slide (or the slide named), or to the root with scope \"global\" (drawn on every slide). Fields are checked by the item's schema (content.kinds shows them); a sketch layer takes fields.sketch (\"<category>/<name>\") and gets that sketch's defaults. Positions are 0–1 of the canvas.",
      params: {
        kind: {
          type: "string",
          description: "Item kind",
          enum: ITEM_KINDS
        },
        fields: {
          type: "object",
          description: "Fields over the kind's defaults",
          optional: true
        },
        scope: {
          type: "string",
          description: "\"slide\" (default when there are slides) or \"global\"",
          enum: [
            "slide",
            "global"
          ],
          optional: true
        },
        slide: {
          type: "number",
          description: "Slide index (default: the active one)",
          min: 0,
          max: 999,
          integer: true,
          optional: true
        },
        select: {
          type: "boolean",
          description: "Open the new item in the inspector (default true)",
          optional: true
        }
      },
      async run( params ) {
        const kind = params.kind as string;
        let fields = isRecord( params.fields ) ? params.fields : {};

        if ( "type" in fields ) {
          throw new CommandError(
            "invalid",
            "fields.type is the kind — pass it as kind"
          );
        }
        if ( kind === "sketch" ) {
          if ( typeof fields.sketch !== "string" ) {
            throw new CommandError(
              "invalid",
              "a sketch layer needs fields.sketch — the sketch to embed, \"<category>/<name>\""
            );
          }
          fields = {
            ...await h.sketchLayerSeed( fields.sketch ),
            ...fields
          };
        }

        const list = addList(
          h,
          params.scope,
          params.slide
        );

        // The schema first, on what was given: a misspelt field is refused
        // here instead of vanishing in the factory's parse.
        checkedItem(
          h,
          {
            type: kind,
            ...fields
          },
          `this ${ kind }`
        );

        const item = checkedItem(
          h,
          h.makeItem(
            kind,
            fields
          ),
          `this ${ kind }`
        );

        const items = listAt(
          h,
          list
        );
        const path = `${ list }.${ items.length }`;

        h.setValue(
          list,
          [
            ...items,
            item
          ]
        );
        if ( params.select !== false ) {
          h.selectPath( path );
        }

        return {
          path,
          item
        };
      }
    },
    {
      id: "content.update",
      title: "Change a content item",
      description: "Change some fields of a content item (nested objects merge, lists replace), checked by its schema — e.g. { path: \"content.0\", fields: { content: \"NEW\", size: 120 } }.",
      params: {
        ...PATH_PARAM,
        fields: {
          type: "object",
          description: "Fields to change"
        }
      },
      run( params ) {
        const {
          item
        } = itemAt(
          h,
          params.path
        );
        const fields = params.fields as Record<string, unknown>;

        if ( "type" in fields && fields.type !== item.type ) {
          throw new CommandError(
            "invalid",
            "an item's type cannot change — remove it and add another kind"
          );
        }

        checkedItem(
          h,
          mergeOptions(
            item,
            fields
          ),
          String( params.path )
        );

        const writes = leafWrites(
          String( params.path ),
          fields
        );

        for ( const [
          path,
          value
        ] of writes ) {
          h.setValue(
            path,
            value
          );
        }

        return summary(
          h.getValues( String( params.path ) ) as Record<string, unknown>,
          String( params.path )
        );
      }
    },
    {
      id: "content.remove",
      title: "Remove a content item",
      description: "Remove a content item. The items after it move up one index.",
      params: PATH_PARAM,
      run( params ) {
        const {
          address, items
        } = itemAt(
          h,
          params.path
        );

        h.selectPath( null );
        h.setValue(
          address.list,
          items.filter( (
            _, i
          ) => i !== address.index )
        );

        return {
          removed: params.path,
          remaining: items.length - 1
        };
      }
    },
    {
      id: "content.duplicate",
      title: "Duplicate a content item",
      description: "Insert a copy right after the item (drawn above it).",
      params: PATH_PARAM,
      run( params ) {
        const {
          address, item, items
        } = itemAt(
          h,
          params.path
        );
        const next = [
          ...items
        ];

        next.splice(
          address.index + 1,
          0,
          structuredClone( item )
        );
        h.setValue(
          address.list,
          next
        );

        return {
          path: `${ address.list }.${ address.index + 1 }`
        };
      }
    },
    {
      id: "content.move",
      title: "Reorder a content item",
      description: "Move an item to another index in its own list — the drawing order: a higher index draws above.",
      params: {
        ...PATH_PARAM,
        to: {
          type: "number",
          description: "New index",
          min: 0,
          max: 9999,
          integer: true
        }
      },
      run( params ) {
        const {
          address, item, items
        } = itemAt(
          h,
          params.path
        );
        const to = params.to as number;

        if ( to >= items.length ) {
          throw new CommandError(
            "invalid",
            `index ${ to } is past the end — ${ address.list } holds ${ items.length }`
          );
        }

        const next = items.filter( (
          _, i
        ) => i !== address.index );

        next.splice(
          to,
          0,
          item
        );
        h.setValue(
          address.list,
          next
        );

        return {
          path: `${ address.list }.${ to }`
        };
      }
    },
    {
      id: "content.toggle",
      title: "Show or hide a content item",
      description: "Show or hide an item, as its eye button does (only items that have one).",
      params: {
        ...PATH_PARAM,
        enabled: {
          type: "boolean",
          description: "true shows it, false hides it"
        }
      },
      run( params ) {
        const {
          item
        } = itemAt(
          h,
          params.path
        );

        if ( typeof item.enabled !== "boolean" ) {
          throw new CommandError(
            "invalid",
            `a ${ String( item.type ) } item has no show/hide switch`
          );
        }
        h.setValue(
          `${ String( params.path ) }.enabled`,
          params.enabled
        );

        return {
          path: params.path,
          enabled: params.enabled
        };
      }
    },
    {
      id: "content.place",
      title: "Move a content item",
      description: "Move an item on the canvas, as dragging it does: x and y are 0–1 of the canvas (0,0 top-left) and say where the item's VISIBLE CENTRE goes. Text, title, image, QR code, specs, breakdown and sketch layers move their position; the HUD widgets their offset; a background, meta labels, crosshairs and bounding boxes do not move. by=\"field\" writes x,y straight into that field instead (a text's position is the corner of its layout box, not its centre).",
      params: {
        ...PATH_PARAM,
        x: {
          type: "number",
          description: "Horizontal, 0 = left, 1 = right",
          min: 0,
          max: 1
        },
        y: {
          type: "number",
          description: "Vertical, 0 = top, 1 = bottom",
          min: 0,
          max: 1
        },
        by: {
          type: "string",
          description: "What x,y place (default centre: the drawn item's centre)",
          enum: [
            "centre",
            "field"
          ],
          optional: true
        }
      },
      async run( params ) {
        const {
          item
        } = itemAt(
          h,
          params.path
        );
        const type = String( item.type );
        const field = OFFSET_PLACED.has( type ) ? "offset" : POSITION_PLACED.has( type ) ? "position" : null;

        if ( !field ) {
          throw new CommandError(
            "invalid",
            `a ${ type } item is not placed by hand`
          );
        }

        const current = isRecord( item[ field ] ) ? item[ field ] as Record<string, unknown> : {};
        let x = params.x as number;
        let y = params.y as number;
        let placed = "field";

        if ( params.by !== "field" ) {
          const bounds = await h.itemBounds( String( params.path ) );

          if ( !bounds ) {
            throw new CommandError(
              "unavailable",
              `${ String( params.path ) } is not on screen, so its drawn centre is unknown — select its slide first, or pass by="field"`
            );
          }
          // The field translates the drawing: move it by the gap between the
          // drawn centre and the target.
          x = Number( current.x ?? 0 ) + x - ( bounds.x + bounds.w / 2 );
          y = Number( current.y ?? 0 ) + y - ( bounds.y + bounds.h / 2 );
          placed = "centre";
          // Stored coordinates are 0–1 (`Vec2`, which snaps anything else back
          // to 0.5 on load), so a centre the field cannot reach is refused.
          if ( x < 0 || x > 1 || y < 0 || y > 1 ) {
            throw new CommandError(
              "invalid",
              `${ field } would have to be (${ x.toFixed( 3 ) }, ${ y.toFixed( 3 ) }) to centre the item there, and it is stored 0–1${ type === "text" || type === "title" ? ` — a ${ type } is laid out in a box as wide as the canvas, so its centre only reaches part of it: set alignment.horizontal / alignment.vertical (content.update) to move its anchor, or place it by="field"` : "" }`
            );
          }
        }

        const value = {
          ...current,
          x: Math.round( x * 10000 ) / 10000,
          y: Math.round( y * 10000 ) / 10000
        };

        h.setValue(
          `${ String( params.path ) }.${ field }`,
          value
        );

        return {
          path: params.path,
          placed,
          [ field ]: value
        };
      }
    },
    {
      id: "content.select",
      title: "Select a content item",
      description: "Open an item in the content inspector, as clicking it does (no path closes it) — to show the person what you are working on.",
      params: {
        path: {
          type: "string",
          description: "Item path; omit to close the inspector",
          optional: true
        }
      },
      run( params ) {
        if ( params.path !== undefined ) {
          itemAt(
            h,
            params.path
          );
        }
        h.selectPath( ( params.path as string | undefined ) ?? null );

        return {
          selected: params.path ?? null
        };
      }
    },
    {
      id: "content.hudFor",
      title: "Add a HUD widget for a parameter",
      description: "Add a HUD widget bound to one of the sketch's parameters, as right-clicking its control does: the widget follows the value live (a gauge or counter for a number, a swatch for a colour, a readout for anything). Without kind, the answer lists the kinds that parameter allows.",
      params: {
        control: {
          type: "string",
          description: "Parameter path inside the sketch, e.g. \"render.hueSpeed\" (sketch.describe)"
        },
        kind: {
          type: "string",
          description: "Widget kind (default: the first the parameter allows)",
          enum: ITEM_KINDS.filter( ( kind ) => kind.startsWith( "hud-" ) ),
          optional: true
        },
        slide: {
          type: "number",
          description: "Slide whose parameter it reads (default: the active one)",
          min: 0,
          max: 999,
          integer: true,
          optional: true
        }
      },
      run( params ) {
        const slide = targetSlide(
          h,
          params.slide
        );
        const registered = `${ sketchBase( slide ) }.${ String( params.control ) }`;
        const {
          path, kinds
        } = h.addHudForControl(
          registered,
          params.kind as string | undefined
        );

        if ( !kinds.length ) {
          throw new CommandError(
            "invalid",
            `"${ String( params.control ) }" is not a parameter a HUD widget can read — sketch.describe lists them`
          );
        }
        if ( !path ) {
          throw new CommandError(
            "invalid",
            `"${ String( params.control ) }" takes ${ kinds.join( ", " ) }, not ${ String( params.kind ) }`
          );
        }

        return {
          path,
          kind: params.kind ?? kinds[ 0 ],
          allowed: kinds
        };
      }
    }
  ];
}
