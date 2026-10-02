import path from "node:path";

import mime from "mime-types";

import {
  getObjectStream
} from "@/lib/connections/s3";

/**
 * Answer a request with an S3 object as a file download, streamed through
 * the server's own S3 client.
 *
 * The download routes used to presign a URL for `S3_PUBLIC_ENDPOINT` and
 * `fetch()` it from the server. That endpoint is the one a *browser* can
 * reach — with the compose default (`http://localhost:9000`) it is not MinIO
 * from inside the app container, so every download failed, and where it did
 * resolve every byte left the network and came back in. `/api/s3` already
 * streams with the internal client; this does the same, as an attachment.
 */
async function downloadObjectResponse(
  objectKey: string,
  fileName = path.posix.basename( objectKey ) || "download"
): Promise<Response> {
  let object;

  try {
    object = await getObjectStream( objectKey );
  } catch( error ) {
    console.error(
      `[downloadObjectResponse] Could not read ${ objectKey }:`,
      error
    );

    return new Response(
      "Failed to fetch file",
      {
        status: 502
      }
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": mime.lookup( fileName ) || "application/octet-stream",
    "Content-Disposition": `attachment; filename="${ fileName.replace(
      /["\\\r\n]/g,
      "_"
    ) }"`
  };

  if ( object.headers[ "content-length" ] ) {
    headers[ "Content-Length" ] = object.headers[ "content-length" ];
  }

  return new Response(
    object.body,
    {
      status: 200,
      headers
    }
  );
}

export default downloadObjectResponse;
