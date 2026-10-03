import os from "node:os";

import downloadFileResponse from "@/utils/downloadFileResponse";
import resolveInsideDirectory from "@/utils/resolveInsideDirectory";

export async function GET( request: Request ) {
  const {
    searchParams
  } = new URL( request.url );
  const name = searchParams.get( "name" );

  if ( !name ) {
    return new Response(
      "Missing asset name",
      {
        status: 400
      }
    );
  }

  const folder = searchParams.get( "folder" );

  // Both parameters are untrusted: without the containment check a `..` in
  // either one reads any file the server process can (env, keys, source).
  const filePath = folder
    ? resolveInsideDirectory(
      os.tmpdir(),
      folder,
      "assets",
      name
    )
    : resolveInsideDirectory(
      os.tmpdir(),
      name
    );

  if ( !filePath ) {
    return new Response(
      "Invalid asset path",
      {
        status: 400
      }
    );
  }

  return downloadFileResponse( {
    filePath
  } );
}
