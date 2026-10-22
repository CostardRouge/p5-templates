/**
 * The gallery from the tab: list the sketches and open one. Opening is a
 * client-side navigation (`router.push`, as every gallery link is), so the
 * page and the bridge's connection survive it; the commands of the old sketch
 * unregister with its form and the new sketch's register when it mounts.
 */
import {
  CommandError, type CommandSpec
} from "../../../../scripts/mcp/registry.ts";
import type {
  StudioHandles
} from "../handles";
import {
  until
} from "./slideCommands";

export type CatalogueEntry = {
  engine: string;
  category?: string | null;
  name: string;
  hiddenFromGallery?: boolean;
  hasSketchForm?: boolean;
  /** From the sketch's `about.json` (`sketches.md`); absent until written. */
  description?: string;
  tags?: string[];
};

/** What `sketches.list` says of one sketch: its id, and what it is when known. */
export function catalogueSummary( entry: CatalogueEntry ): { id: string;
  description?: string;
  tags?: string[] } {
  return {
    id: sketchPathOf( entry ),
    ...( entry.description ? {
      description: entry.description
    } : {} ),
    ...( entry.tags?.length ? {
      tags: entry.tags
    } : {} )
  };
}

/** Case-insensitive: the id, the description or a tag contains `query`. */
export function catalogueMatches(
  entry: CatalogueEntry, query: string
): boolean {
  if ( !query ) {
    return true;
  }

  return sketchPathOf( entry ).toLowerCase()
    .includes( query ) ||
    ( entry.description ?? "" ).toLowerCase().includes( query ) ||
    ( entry.tags ?? [] ).some( ( tag ) => tag.includes( query ) );
}

/** `engine/category/name` (or `engine/name` for a sketch with no category). */
export function sketchPathOf( entry: CatalogueEntry ): string {
  return [
    entry.engine,
    entry.category,
    entry.name
  ].filter( Boolean ).join( "/" );
}

/** How long a sketch may take to load and register its commands. */
const OPEN_TIMEOUT_MS = 60_000;

export function navigationCommands( h: StudioHandles ): CommandSpec[] {
  return [
    {
      id: "sketches.list",
      title: "List sketches",
      description: "The gallery: every sketch as { id: \"engine/category/name\", description, tags } — the description and tags exist for the sketches someone has described (the answer counts them), the others are named only. Narrow by engine, by a tag, or by text found in the id, the description or a tag. studio.open takes an id.",
      params: {
        engine: {
          type: "string",
          description: "Only this engine",
          enum: [
            "p5",
            "gsap",
            "threejs",
            "html"
          ],
          optional: true
        },
        query: {
          type: "string",
          description: "Case-insensitive text found in the id, the description or a tag, e.g. \"voronoi\" or \"letters\"",
          optional: true
        },
        tag: {
          type: "string",
          description: "Only sketches carrying this tag (the answer's `tags` lists every tag in use with its count)",
          optional: true
        },
        includeHidden: {
          type: "boolean",
          description: "Also list sketches hidden from the gallery (drafts, utilities)",
          optional: true
        }
      },
      run( params ) {
        const query = String( params.query ?? "" ).toLowerCase();
        const tag = params.tag === undefined ? undefined : String( params.tag ).toLowerCase();
        const visible = h.navigation.catalogue()
          .filter( ( entry ) => ( params.includeHidden || !entry.hiddenFromGallery ) &&
            ( params.engine === undefined || entry.engine === params.engine ) );
        const tags: Record<string, number> = {};

        for ( const entry of visible ) {
          for ( const name of entry.tags ?? [] ) {
            tags[ name ] = ( tags[ name ] ?? 0 ) + 1;
          }
        }
        if ( tag !== undefined && !( tag in tags ) ) {
          throw new CommandError(
            "invalid",
            `no sketch carries the tag "${ tag }"${ Object.keys( tags ).length ? ` — tags in use: ${ Object.keys( tags ).sort()
              .join( ", " ) }` : " — no sketch has tags yet" }`
          );
        }

        const sketches = visible
          .filter( ( entry ) => ( tag === undefined || ( entry.tags ?? [] ).includes( tag ) ) && catalogueMatches(
            entry,
            query
          ) )
          .map( catalogueSummary )
          .sort( (
            a, b
          ) => a.id.localeCompare( b.id ) );

        return {
          count: sketches.length,
          described: sketches.filter( ( sketch ) => sketch.description ).length,
          current: h.sketchId,
          tags,
          sketches
        };
      }
    },
    {
      id: "studio.open",
      title: "Open a sketch",
      description: "Open another sketch in this tab, as a gallery link does, and wait until its commands answer. What the current tab holds is NOT saved: when it has changes (anything undoable) this is refused unless discard is true.",
      params: {
        sketch: {
          type: "string",
          description: "\"engine/category/name\" from sketches.list"
        },
        discard: {
          type: "boolean",
          description: "Leave this tab's unsaved changes behind",
          optional: true
        }
      },
      async run( params ) {
        const target = String( params.sketch ).replace(
          /^\/+|\/+$/g,
          ""
        );
        const entry = h.navigation.catalogue().find( ( candidate ) => sketchPathOf( candidate ) === target );

        if ( !entry ) {
          const near = h.navigation.catalogue().map( sketchPathOf )
            .filter( ( path ) => path.includes( target.split( "/" ).pop() ?? target ) )
            .slice(
              0,
              5
            );

          throw new CommandError(
            "invalid",
            `no sketch "${ target }"${ near.length ? ` — did you mean ${ near.join( ", " ) }?` : " — sketches.list shows them" }`
          );
        }
        if ( target === h.sketchId ) {
          return {
            sketch: target,
            opened: false,
            note: "already open"
          };
        }
        if ( h.history.canUndo() && !params.discard ) {
          throw new CommandError(
            "invalid",
            "this tab has changes that are not saved — opening another sketch leaves them behind; pass discard: true to go anyway"
          );
        }

        h.navigation.open( `/sketches/${ target }` );

        if ( !await until(
          () => h.navigation.currentSketch() === target,
          OPEN_TIMEOUT_MS
        ) ) {
          throw new CommandError(
            "failed",
            `${ target } did not finish loading within ${ OPEN_TIMEOUT_MS / 1000 } s — studio.status tells when it is ready`
          );
        }

        return {
          sketch: target,
          opened: true
        };
      }
    }
  ];
}
