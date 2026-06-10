import {
  getObjectStream,
  getObjectSize
} from "@/lib/connections/s3";

/**
 * Same-origin streaming proxy for S3-backed assets.
 *
 * This used to be a 307 redirect to a presigned S3 URL, which broke `<video>`
 * on WebKit (iOS/iPadOS Safari): media elements created with
 * `crossOrigin="anonymous"` fail when the media URL redirects cross-origin
 * (WebKit drops the CORS context on redirect), and WebKit additionally
 * requires the final server to answer `Range` requests with
 * `206 Partial Content` before it will decode anything at all.
 *
 * Streaming the bytes from this route keeps every asset same-origin (no CORS,
 * no canvas tainting) and forwards `Range` end-to-end, which satisfies both
 * WebKit constraints while staying transparent for every other browser.
 */
export async function GET(
  request: Request,
  {
    params
  }: {
    params: Promise<{
      key: string[];
    }>;
  }
) {
  const objectKey = ( await params ).key.join( "/" );
  const range = request.headers.get( "range" );

  try {
    const object = await getObjectStream(
      objectKey,
      range
    );

    return new Response(
      object.body,
      {
        status: object.status,
        headers: {
          ...object.headers,
          "cache-control": "private, max-age=3600"
        }
      }
    );
  } catch( error ) {
    const status = ( error as {
      $metadata?: {
        httpStatusCode?: number;
      };
      name?: string;
    } );

    if ( status.$metadata?.httpStatusCode === 416 ) {
      const size = await getObjectSize( objectKey );

      return new Response(
        null,
        {
          status: 416,
          headers: size === null ? {} : {
            "content-range": `bytes */${ size }`
          }
        }
      );
    }

    if (
      status.name === "NoSuchKey" ||
      status.$metadata?.httpStatusCode === 404
    ) {
      return new Response(
        null,
        {
          status: 404
        }
      );
    }

    throw error;
  }
}
