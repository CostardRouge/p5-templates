import {
  execFile
} from "node:child_process";
import path from "node:path";

import {
  findSketchMeta
} from "@/engines/metadata";
import {
  localSameOrigin, parseFavoriteChanges
} from "@/lib/favorites/changes";

/** `scripts/set-favorites.mjs`, fed the batch on stdin: its own process, so this route bundles no file walker. */
function setFavorites( targets: { dir: string;
  favorite: boolean }[] ): Promise<number> {
  return new Promise( (
    resolve, reject
  ) => {
    const child = execFile(
      process.execPath,
      [
        path.join(
          /* turbopackIgnore: true */ process.cwd(),
          "scripts",
          "set-favorites.mjs"
        )
      ],
      {
        cwd: process.cwd()
      },
      (
        error, stdout, stderr
      ) => {
        if ( error ) {
          reject( new Error( stderr.trim() || error.message ) );

          return;
        }
        try {
          resolve( Number( ( JSON.parse( stdout ) as { written?: number } ).written ?? 0 ) );
        } catch {
          reject( new Error( "the favourites script answered nothing readable" ) );
        }
      }
    );

    child.stdin?.end( JSON.stringify( targets ) );
  } );
}

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
 * development server only, as steevepommier.com's is: `scripts/set-favorites.mjs`
 * sets `favorite` in each sketch's own `sketch.json` through
 * `scripts/sketch-file.mjs` (the one definition of that file), then runs the
 * catalogue's generator so `metadata.json` follows. The star ships when that
 * change is committed.
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
      dir: [
        "src",
        "sketches",
        meta.engine,
        "sketches",
        ...( meta.category ? [
          meta.category
        ] : [] ),
        meta.name
      ].join( "/" ),
      favorite
    } );
  }

  try {
    return Response.json( {
      written: await setFavorites( targets )
    } );
  } catch( caught ) {
    return refuse(
      500,
      caught instanceof Error ? caught.message : "the favourites could not be written"
    );
  }
}
