import {
  NextResponse
} from "next/server";

import {
  findSketchMeta
} from "@/engines/metadata";
import {
  getSketchMeta
} from "@/utils/getSketchOptions";

/**
 * A sketch's parameter form — its `formValues` (defaults) and
 * `formConfiguration` (the control descriptions), for a sketch OTHER than the
 * one the page is rendering.
 *
 * Why a route and not an import: `options.ts` files are loaded through
 * `@/engines/sketchOptionLoaders`, which is `server-only` because some of them
 * touch the filesystem at import time (the `photo/*` sketches read the test
 * image directory). The sketch page gets its own form the same way, server-side
 * — but an embedded-sketch layer picks its sketch in the browser, at which
 * point the only way to that data is over the wire.
 *
 * The payload is plain data: `formConfiguration` is a description of controls
 * (component names, labels, ranges, option lists), never functions, so it
 * survives JSON round-tripping unchanged.
 */
export async function GET( request: Request ) {
  const {
    searchParams
  } = new URL( request.url );
  const sketchName = searchParams.get( "sketch" );
  const engineId = searchParams.get( "engine" ) ?? "p5";

  if ( !sketchName ) {
    return NextResponse.json(
      {
        error: "Missing `sketch` parameter"
      },
      {
        status: 400
      }
    );
  }

  // Resolving through the catalogue is also the authorisation check: only a
  // real, registered sketch can be asked for, so the parameter can never point
  // the loaders at an arbitrary module.
  const meta = findSketchMeta(
    sketchName,
    engineId
  );

  if ( !meta ) {
    return NextResponse.json(
      {
        error: `Unknown sketch "${ engineId }:${ sketchName }"`
      },
      {
        status: 404
      }
    );
  }

  const form = await getSketchMeta(
    sketchName,
    engineId
  );

  return NextResponse.json(
    {
      sketch: meta.sketchPath,
      formValues: form.formValues ?? {},
      formConfiguration: form.formConfiguration ?? {}
    },
    {
      headers: {
        // The form of a given sketch only changes when the sketch does, which
        // in a running deployment means never.
        "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400"
      }
    }
  );
}
