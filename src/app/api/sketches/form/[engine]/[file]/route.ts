import {
  getMetadata,
  findSketchMeta
} from "@/engines/metadata";
import {
  getSketchMeta
} from "@/utils/getSketchOptions";

/**
 * A sketch's parameter form as a static file: `/api/sketches/form/<engine>/<name>.json`.
 *
 * The same payload as `GET /api/sketches/form?engine=&sketch=` (route.server.ts),
 * written once per sketch at build. The query-string route cannot exist on the
 * static front (Cloudflare serves files; a file cannot read a query string), so
 * this path form is the one both builds serve and every caller uses — the
 * studio's embedded-sketch layers (src/lib/sketchLayerCatalogue.ts) and
 * steevepommier.com's control panels. On the static front its CORS header comes
 * from public/_headers; the full server sends it here.
 */

export const dynamic = "force-static";
export const dynamicParams = false;

type Params = {
  engine: string;
  file: string;
};

export function generateStaticParams(): Params[] {
  return getMetadata().map( ( sketch ) => ( {
    engine: sketch.engine,
    file: `${ sketch.name }.json`
  } ) );
}

export async function GET(
  _request: Request,
  {
    params
  }: {
    params: Promise<Params>;
  }
) {
  const {
    engine, file
  } = await params;
  const sketchName = file.replace(
    /\.json$/,
    ""
  );
  const meta = file.endsWith( ".json" )
    ? findSketchMeta(
      sketchName,
      engine
    )
    : undefined;

  if ( !meta ) {
    return Response.json(
      {
        error: `Unknown sketch "${ engine }:${ sketchName }"`
      },
      {
        status: 404
      }
    );
  }

  const form = await getSketchMeta(
    sketchName,
    engine
  );

  return Response.json(
    {
      sketch: meta.sketchPath,
      formValues: form.formValues ?? {},
      formConfiguration: form.formConfiguration ?? {}
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*"
      }
    }
  );
}
