/* The only code of the static front (wrangler.jsonc): byte ranges for the
 * sketches' thumbnails and preview loops.
 *
 * Cloudflare's static assets ignore `Range` and always answer 200 with the
 * whole file (measured on steevepommier.com, 2026-08-18). Safari will not play
 * a <video> it cannot range-request, and no browser can seek one; the full
 * Next server this front replaces did answer 206. So requests under
 * /assets/images/templates/ reach this Worker first (`run_worker_first`): it
 * fetches the file from the assets and slices it. Every other path is served
 * by the assets directly, without the Worker.
 *
 * The body is buffered to know its length (an ASSETS response carries no
 * Content-Length); the loops are a few MB at most. */

const CORS = {
  // Shown by steevepommier.com's /motion gallery (public/_headers says the same).
  "Access-Control-Allow-Origin": "*"
};

export function parseRange(
  header, size
) {
  const match = /^bytes=(\d*)-(\d*)$/.exec( header.trim() );

  if ( !match || ( match[ 1 ] === "" && match[ 2 ] === "" ) ) {
    return null;
  }

  if ( match[ 1 ] === "" ) {
    const suffix = Number( match[ 2 ] );

    return suffix > 0
      ? {
        start: Math.max(
          size - suffix,
          0
        ),
        end: size - 1
      }
      : "unsatisfiable";
  }

  const start = Number( match[ 1 ] );
  const end = match[ 2 ] === ""
    ? size - 1
    : Math.min(
      Number( match[ 2 ] ),
      size - 1
    );

  return start >= size || start > end
    ? "unsatisfiable"
    : {
      start,
      end
    };
}

export default {
  async fetch(
    request, env
  ) {
    const range = request.headers.get( "Range" );
    // The asset server answers a ranged request with a 400: ask it for the
    // whole file and slice it here.
    const whole = new Headers( request.headers );

    whole.delete( "Range" );

    const response = await env.ASSETS.fetch( new Request(
      request.url,
      {
        method: request.method,
        headers: whole
      }
    ) );
    const headers = new Headers( response.headers );

    for ( const [
      key,
      value
    ] of Object.entries( CORS ) ) {
      headers.set(
        key,
        value
      );
    }

    headers.set(
      "Accept-Ranges",
      "bytes"
    );

    if ( !range || request.method !== "GET" || response.status !== 200 ) {
      return new Response(
        response.body,
        {
          status: response.status,
          headers
        }
      );
    }

    const body = new Uint8Array( await response.arrayBuffer() );
    const slice = parseRange(
      range,
      body.length
    );

    if ( slice === null ) {
      headers.set(
        "Content-Length",
        String( body.length )
      );

      return new Response(
        body,
        {
          status: 200,
          headers
        }
      );
    }

    if ( slice === "unsatisfiable" ) {
      headers.set(
        "Content-Range",
        `bytes */${ body.length }`
      );

      return new Response(
        null,
        {
          status: 416,
          headers
        }
      );
    }

    headers.set(
      "Content-Range",
      `bytes ${ slice.start }-${ slice.end }/${ body.length }`
    );
    headers.set(
      "Content-Length",
      String( slice.end - slice.start + 1 )
    );

    return new Response(
      body.slice(
        slice.start,
        slice.end + 1
      ),
      {
        status: 206,
        headers
      }
    );
  }
};
