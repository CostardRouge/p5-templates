/**
 * Sketchbook's agent commands. Each one goes through the door a person's
 * gesture goes through, so an agent is validated like a person:
 *
 * - the catalogue is `src/sketches/metadata.json`, the gallery's own list;
 * - a sketch's parameters come from `GET /api/sketches/form`, the route the
 *   embed panel and the sketch-layer picker read, and a delta is checked
 *   against those controls (`sketchForm.ts`) before anything renders;
 * - a whole document is checked by the app's own schema
 *   (`/api/options/validate`) and saved as a draft by the studio's Save draft
 *   (`draftCommands.ts`);
 * - frames are the recorder's own capture protocol (`renderCommands.ts`);
 * - a video is the server's recording pipeline, followed and fetched through
 *   the dashboard's routes (`jobCommands.ts`).
 *
 * This file holds the catalogue commands and puts the set together.
 */
import {
  filterCatalog, sketchId
} from "./catalog.ts";
import {
  createContext, ENGINES, type CommandDeps, type Context
} from "./context.ts";
import {
  draftCommands
} from "./draftCommands.ts";
import {
  jobCommands
} from "./jobCommands.ts";
import type {
  CommandSpec
} from "./registry.ts";
import {
  renderCommands
} from "./renderCommands.ts";
import {
  schemaPart
} from "./schemaParts.ts";
import {
  formSchema
} from "./sketchForm.ts";

export type {
  CommandDeps
} from "./context.ts";

function catalogCommands( ctx: Context ): CommandSpec[] {
  const {
    deps
  } = ctx;
  let documentSchema: Record<string, unknown> | null = null;

  return [
    {
      id: "app.status",
      title: "Status",
      description: "Where this server points, whether Sketchbook answers there, whether its recording queue is up (Redis + worker), how many sketches the catalogue holds and where files are written. Call first.",
      async run() {
        const reachable = await ctx.serverUp();
        let queue: unknown = null;

        if ( reachable === true ) {
          // Also what starts the recording worker in a fresh server process.
          queue = await ctx.getJson( "/api/recordings/health" ).catch( ( error: Error ) => ( {
            error: error.message
          } ) );
        }

        return {
          server: deps.baseUrl,
          reachable: reachable === true,
          ...( reachable === true ? {} : {
            reason: reachable
          } ),
          queue,
          sketches: ( await deps.catalog() ).length,
          outputDir: deps.outputDir
        };
      }
    },
    {
      id: "sketches.list",
      title: "List sketches",
      description: "Search the catalogue. Answers each sketch's id (`<engine>/<category>/<name>`, what every other command takes) and the categories the result spans. Hidden studies are left out unless includeHidden.",
      params: {
        engine: {
          type: "string",
          description: "Only this engine",
          enum: ENGINES,
          optional: true
        },
        category: {
          type: "string",
          description: "Only this category (e.g. voronoi, flip, sculpt, text, photo)",
          optional: true
        },
        query: {
          type: "string",
          description: "Case-insensitive substring of the id",
          optional: true
        },
        includeHidden: {
          type: "boolean",
          description: "Include sketches the gallery hides",
          optional: true
        },
        limit: {
          type: "number",
          description: "At most this many sketches (default 100)",
          min: 1,
          max: 1000,
          integer: true,
          optional: true
        }
      },
      async run( params ) {
        const found = filterCatalog(
          await deps.catalog(),
          params
        );
        const categories: Record<string, number> = {};

        for ( const entry of found ) {
          const key = `${ entry.engine }/${ entry.category ?? "" }`;

          categories[ key ] = ( categories[ key ] ?? 0 ) + 1;
        }

        return {
          total: found.length,
          categories,
          sketches: found.slice(
            0,
            ( params.limit as number | undefined ) ?? 100
          ).map( ( entry ) => ( {
            id: sketchId( entry ),
            hasForm: entry.hasSketchForm ?? false,
            ...( entry.hiddenFromGallery ? {
              hidden: true
            } : {} )
          } ) )
        };
      }
    },
    {
      id: "sketches.describe",
      title: "Describe a sketch",
      description: "A sketch's parameters as JSON Schema (ranges, choices, defaults, labels) and their default values, its own size, clock and slide count, plus the studio and embed URLs. What render.* and drafts.* accept as `options` is any nested subset of these parameters.",
      params: {
        sketch: {
          type: "string",
          description: "Sketch id from sketches.list (a bare name works when unique)"
        }
      },
      available: ctx.serverUp,
      async run( params ) {
        const entry = await ctx.sketch( params.sketch );
        const loaded = await ctx.form( entry );
        const own = await deps.localOptions( entry );

        return {
          id: sketchId( entry ),
          studio: `${ deps.baseUrl }/sketches/${ sketchId( entry ) }`,
          embed: `${ deps.baseUrl }/embed/${ sketchId( entry ) }`,
          size: own?.size ?? {
            width: 1080,
            height: 1350
          },
          animation: own?.animation ?? {
            framerate: 60,
            duration: 12
          },
          slides: Array.isArray( own?.slides ) ? own.slides.length : 0,
          defaults: loaded.formValues,
          schema: formSchema(
            loaded.formConfiguration,
            loaded.formValues
          )
        };
      }
    },
    {
      id: "options.schema",
      title: "Document schema",
      description: "The options DOCUMENT a draft holds besides the sketch's parameters — size, animation, content items (text, title, image, qrcode, HUD widgets, sketch layers…), slides — as JSON Schema from the app's own types. No part: an overview and the content item types; part \"content\": each item type's fields; \"content.<type>\": one item; a field name (\"size\", \"slides\"…); \"all\": everything (~80 KB).",
      params: {
        part: {
          type: "string",
          description: "What to describe (see above); omit for the overview",
          optional: true
        }
      },
      available: ctx.serverUp,
      async run( params ) {
        documentSchema ??= await ctx.getJson( "/api/options/schema" ) as Record<string, unknown>;

        return schemaPart(
          documentSchema,
          params.part as string | undefined
        );
      }
    }
  ];
}

export function createCommands( deps: CommandDeps ): CommandSpec[] {
  const ctx = createContext( deps );

  return [
    ...catalogCommands( ctx ),
    ...renderCommands( ctx ),
    ...jobCommands( ctx ),
    ...draftCommands( ctx )
  ];
}
