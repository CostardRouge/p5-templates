/**
 * The star from the tab (`docs/memory/sketches.md`): `sketches.list` already
 * tells the favourites; this sets them. The star lives in each sketch's
 * `sketch.json`, so it can only be WRITTEN where the app runs from a clone —
 * a development server (`/api/dev/favorites`); on the public, static site the
 * command says so instead of pretending.
 */
import {
  CommandError, type CommandSpec
} from "../../../../scripts/mcp/registry.ts";
import {
  MAX_CHANGES
} from "../../favorites/changes";
import type {
  StudioHandles
} from "../handles";
import {
  sketchPathOf
} from "./navigationCommands";

const ROUTE = "/api/dev/favorites";

export function favoriteCommands( h: StudioHandles ): CommandSpec[] {
  return [
    {
      id: "favorites.set",
      title: "Star or unstar sketches",
      description: "Set the person's star on sketches (or take it off): written to each sketch's `sketch.json` in their clone, to be committed by them. Only when the person asks for these sketches — a favourite is their taste, not a default. Works on their development server only; the public site cannot write. Answers { written, on, sketches } — sketches.list with favorite: true shows the result after the page reloads.",
      params: {
        sketches: {
          type: "strings",
          description: "\"engine/category/name\" each, from sketches.list"
        },
        on: {
          type: "boolean",
          description: "true to star (the default), false to unstar",
          optional: true
        }
      },
      available: () => process.env.NODE_ENV === "production" ? "favourites are written to the repository: open the sketchbook from your development server (npm run dev) to change them — here they can only be read (sketches.list, favorite: true)" : true,
      async run( params ) {
        const list = Array.isArray( params.sketches ) ? params.sketches.map( ( path ) => String( path ).replace(
          /^\/+|\/+$/g,
          ""
        ) ) : [];

        if ( !list.length || list.length > MAX_CHANGES ) {
          throw new CommandError(
            "invalid",
            `give 1 to ${ MAX_CHANGES } sketches`
          );
        }

        const on = params.on !== false;
        const changes: Record<string, boolean> = {};

        for ( const path of list ) {
          const entry = h.navigation.catalogue().find( ( candidate ) => sketchPathOf( candidate ) === path );

          if ( !entry ) {
            throw new CommandError(
              "invalid",
              `no sketch "${ path }" — sketches.list shows them`
            );
          }
          changes[ `${ entry.engine }/${ entry.name }` ] = on;
        }

        let response: Response;

        try {
          response = await fetch(
            ROUTE,
            {
              method: "POST",
              headers: {
                "content-type": "application/json"
              },
              body: JSON.stringify( {
                changes
              } )
            }
          );
        } catch( caught ) {
          throw new CommandError(
            "failed",
            `the development server did not answer: ${ caught instanceof Error ? caught.message : String( caught ) }`
          );
        }

        const body = await response.json().catch( () => ( {} ) ) as { written?: number;
          error?: string; };

        if ( !response.ok ) {
          throw new CommandError(
            "failed",
            `not written: ${ body.error ?? `HTTP ${ response.status }` }`
          );
        }

        return {
          written: body.written ?? 0,
          on,
          sketches: list,
          note: "Written to sketch.json in the clone — the person commits them to ship the stars."
        };
      }
    }
  ];
}
