/**
 * The gallery from the tab: keep the piece on screen, list what was kept,
 * look at a thumbnail, reopen an entry, remove one. The same archive the
 * /gallery page shows (`src/lib/gallery/`), so an agent gets a memory in the
 * tab: "take last week's pieces and make variants".
 */
import {
  CommandError, type CommandSpec, type ImageResult
} from "../../../../scripts/mcp/registry.ts";
import {
  keepPiece
} from "../../gallery/keep";
import type {
  GalleryEntrySummary
} from "../../gallery/types";
import {
  galleryEntryHref
} from "../../gallery/open";
import type {
  StudioHandles
} from "../handles";
import {
  until
} from "./slideCommands";

const ID_PARAM = {
  id: {
    type: "string" as const,
    description: "An entry id from gallery.list"
  }
};

/** How long a sketch may take to load and register its commands (as studio.open). */
const OPEN_TIMEOUT_MS = 60_000;
/** How long the new page may take to consume the handed-over document once its commands answer. */
const APPLY_TIMEOUT_MS = 10_000;
const DEFAULT_LIMIT = 50;

/** An entry as answered: dates readable, nothing heavy. */
function describe( entry: GalleryEntrySummary ) {
  return {
    id: entry.id,
    at: new Date( entry.at ).toISOString(),
    sketch: entry.sketch,
    title: entry.title,
    origin: entry.origin,
    size: `${ entry.width }×${ entry.height }`,
    hadAssets: entry.hadAssets,
    hasThumbnail: entry.hasThumbnail
  };
}

/** An ISO date (or anything Date.parse reads) as epoch ms; refused when it is not one. */
function dateParam(
  value: unknown, name: string
): number | undefined {
  if ( value === undefined ) {
    return undefined;
  }

  const at = Date.parse( String( value ) );

  if ( Number.isNaN( at ) ) {
    throw new CommandError(
      "invalid",
      `${ name } "${ String( value ) }" is not a date — give an ISO date such as 2026-10-04 or 2026-10-04T18:00:00Z`
    );
  }

  return at;
}

async function entryOrRefuse(
  h: StudioHandles, id: unknown
) {
  const entry = await h.gallery.store.get( String( id ) );

  if ( !entry ) {
    throw new CommandError(
      "invalid",
      `no gallery entry "${ String( id ) }" — gallery.list shows the ids`
    );
  }

  return entry;
}

export function galleryCommands( h: StudioHandles ): CommandSpec[] {
  const [
    engine,
    ...rest
  ] = h.sketchId.split( "/" );
  const name = rest[ rest.length - 1 ] ?? "";
  const category = rest.length > 1 ? rest[ 0 ] : null;

  return [
    {
      id: "gallery.keep",
      title: "Keep in the gallery",
      description: "Archive the piece on screen — the whole document plus a thumbnail of this frame — in the browser's gallery (/gallery), as the Keep button and a finished export do. Answers the entry; kept=false when the gallery's newest entry of this sketch already holds this exact document (then only the title is taken).",
      params: {
        title: {
          type: "string",
          description: "A label for the entry (default: none, shown as the sketch's name)",
          optional: true
        }
      },
      async run( params ) {
        const result = await keepPiece(
          h.gallery.store,
          {
            engine,
            category,
            name,
            options: h.getValues(),
            origin: "agent",
            title: params.title as string | undefined,
            thumbnail: await h.gallery.thumbnail()
          }
        );

        return {
          ...describe( {
            ...result.entry,
            hasThumbnail: result.entry.thumbnail !== null
          } ),
          kept: result.kept,
          pruned: result.pruned.length
        };
      }
    },
    {
      id: "gallery.list",
      title: "List the gallery",
      description: "The pieces kept in this browser, newest first: id, date, sketch, title, origin, size. Narrow by sketch and by date; gallery.thumbnail shows one, gallery.open relaunches one.",
      params: {
        sketch: {
          type: "string",
          description: "Only this sketch (\"engine/category/name\" as sketches.list names it; \"current\" for the open one)",
          optional: true
        },
        since: {
          type: "string",
          description: "Only entries kept at or after this ISO date",
          optional: true
        },
        until: {
          type: "string",
          description: "Only entries kept at or before this ISO date",
          optional: true
        },
        limit: {
          type: "number",
          description: `At most this many, newest first (default ${ DEFAULT_LIMIT })`,
          min: 1,
          max: 500,
          integer: true,
          optional: true
        }
      },
      async run( params ) {
        const sketch = params.sketch === "current" ? h.sketchId : params.sketch as string | undefined;
        const entries = await h.gallery.store.list( {
          sketch,
          since: dateParam(
            params.since,
            "since"
          ),
          until: dateParam(
            params.until,
            "until"
          ),
          limit: ( params.limit as number | undefined ) ?? DEFAULT_LIMIT
        } );

        return {
          count: entries.length,
          total: await h.gallery.store.count(),
          entries: entries.map( describe )
        };
      }
    },
    {
      id: "gallery.thumbnail",
      title: "Look at a kept piece",
      description: "An entry's thumbnail — the frame that was on screen when it was kept, ~240 px wide — as a picture you can LOOK at.",
      params: {
        ...ID_PARAM,
        maxEdge: {
          type: "number",
          description: "Longest edge of the picture handed back, px (default 512 — the thumbnail as kept, which is smaller)",
          min: 64,
          max: 1024,
          integer: true,
          optional: true
        }
      },
      async run( params ): Promise<ImageResult> {
        const entry = await entryOrRefuse(
          h,
          params.id
        );

        if ( !entry.thumbnail ) {
          throw new CommandError(
            "unavailable",
            `entry "${ entry.id }" was kept without a thumbnail`
          );
        }

        return h.imageResult(
          entry.thumbnail,
          ( params.maxEdge as number | undefined ) ?? 512,
          "jpeg",
          `${ entry.title || entry.name } (${ entry.sketch }, kept ${ new Date( entry.at ).toISOString() }).`
        );
      }
    },
    {
      id: "gallery.open",
      title: "Reopen a kept piece",
      description: "Relaunch an entry: its sketch opens in this tab (as studio.open does, when it is another sketch) with exactly the kept document applied. What the tab holds is NOT saved: when it has changes (anything undoable) this is refused unless discard is true. Uploaded files the piece used are not in the gallery and will be missing.",
      params: {
        ...ID_PARAM,
        discard: {
          type: "boolean",
          description: "Leave this tab's unsaved changes behind",
          optional: true
        }
      },
      async run( params ) {
        const entry = await entryOrRefuse(
          h,
          params.id
        );
        const document = {
          ...entry.options,
          name: entry.name
        };

        if ( h.history.canUndo() && !params.discard ) {
          throw new CommandError(
            "invalid",
            "this tab has changes that are not saved — reopening a piece replaces them; pass discard: true to go anyway"
          );
        }

        if ( entry.sketch === h.sketchId ) {
          const applied = h.gallery.importDocument( document );

          if ( !applied.ok ) {
            throw new CommandError(
              "failed",
              `the kept document was refused by the sketch — ${ applied.reason }`
            );
          }

          return {
            id: entry.id,
            sketch: entry.sketch,
            opened: false,
            applied: true,
            hadAssets: entry.hadAssets
          };
        }

        if ( !h.gallery.stageImport( document ) ) {
          throw new CommandError(
            "failed",
            "the document could not be handed to the next page (sessionStorage refused it)"
          );
        }

        h.navigation.open( galleryEntryHref( entry ) );

        if ( !await until(
          () => h.navigation.currentSketch() === entry.sketch,
          OPEN_TIMEOUT_MS
        ) ) {
          throw new CommandError(
            "failed",
            `${ entry.sketch } did not finish loading within ${ OPEN_TIMEOUT_MS / 1000 } s — studio.status tells when it is ready`
          );
        }

        // The new page consumes the handoff on mount and applies it through
        // its own import (the strict parse); a banner in the tab says if it refused.
        const applied = await until(
          () => !h.gallery.importPending(),
          APPLY_TIMEOUT_MS
        );

        return {
          id: entry.id,
          sketch: entry.sketch,
          opened: true,
          applied,
          hadAssets: entry.hadAssets
        };
      }
    },
    {
      id: "gallery.remove",
      title: "Remove from the gallery",
      description: "Delete one entry — its document and thumbnail — from the browser's gallery. Not undoable.",
      params: ID_PARAM,
      async run( params ) {
        const entry = await entryOrRefuse(
          h,
          params.id
        );

        await h.gallery.store.remove( entry.id );

        return {
          id: entry.id,
          removed: true,
          remaining: await h.gallery.store.count()
        };
      }
    }
  ];
}
