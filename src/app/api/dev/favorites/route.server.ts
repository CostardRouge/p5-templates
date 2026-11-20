import {
  execFile
} from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import {
  promisify
} from "node:util";

import {
  findSketchMeta
} from "@/engines/metadata";
import {
  localSameOrigin, parseFavoriteChanges
} from "@/lib/favorites/changes";

import {
  readSketchFile, serializeSketchFile, SKETCH_FILE
} from "../../../../../scripts/sketch-file.mjs";

const run = promisify( execFile );

const refuse = (
  status: number, error: string
) => Response.json(
  {
    error
  },
  {
    status
  }
);

/**
 * The write half of the favourites editor (`docs/memory/sketches.md`) — a
 * development server only, as steevepommier.com's is: it sets `favorite` in
 * each sketch's own `sketch.json` through `scripts/sketch-file.mjs` (the one
 * definition of that file), then runs the catalogue's generator so
 * `metadata.json` follows. The star ships when that change is committed.
 *
 * Guards, since it writes to disk and nothing here is authenticated
 * (`security.md`): never in production, this machine and this site's own page
 * only, keys matched against a strict pattern AND against the catalogue, the
 * folder rebuilt from the catalogue's entry — no path is built from the
 * request's text.
 */
export async function POST( request: Request ) {
  if ( process.env.NODE_ENV === "production" ) {
    return new Response(
      "Not found",
      {
        status: 404
      }
    );
  }
  if ( !localSameOrigin(
    request.headers.get( "host" ),
    request.headers.get( "origin" )
  ) ) {
    return refuse(
      403,
      "the favourites editor only writes from this machine"
    );
  }

  let changes: Map<string, boolean>;

  try {
    changes = parseFavoriteChanges( await request.json() );
  } catch( caught ) {
    return refuse(
      400,
      caught instanceof Error ? caught.message : "invalid body"
    );
  }

  const targets: { dir: string;
    favorite: boolean }[] = [];

  for ( const [
    key,
    favorite
  ] of changes ) {
    const [
      engine,
      name
    ] = key.split( "/" );
    const meta = findSketchMeta(
      name,
      engine
    );

    if ( !meta ) {
      return refuse(
        400,
        `no sketch ${ key }`
      );
    }

    targets.push( {
      dir: path.join(
        process.cwd(),
        "src",
        "sketches",
        meta.engine,
        "sketches",
        ...( meta.category ? [
          meta.category
        ] : [] ),
        meta.name
      ),
      favorite
    } );
  }

  let written = 0;

  try {
    for ( const {
      dir, favorite
    } of targets ) {
      const values = readSketchFile( dir ) as Record<string, unknown>;

      if ( Boolean( values.favorite ) === favorite ) {
        continue;
      }

      const text = serializeSketchFile( {
        ...values,
        favorite
      } );
      const file = path.join(
        dir,
        SKETCH_FILE
      );

      if ( text === null ) {
        await fs.rm(
          file,
          {
            force: true
          }
        );
      } else {
        await fs.writeFile(
          file,
          text
        );
      }
      written++;
    }

    if ( written ) {
      await run(
        process.execPath,
        [
          path.join(
            process.cwd(),
            "scripts",
            "watch-sketches.mjs"
          ),
          "--once"
        ],
        {
          cwd: process.cwd()
        }
      );
    }
  } catch( caught ) {
    return refuse(
      500,
      caught instanceof Error ? caught.message : "the favourites could not be written"
    );
  }

  return Response.json( {
    written
  } );
}
