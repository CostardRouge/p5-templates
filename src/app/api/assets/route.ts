import path from "path";
import os from "node:os";

import downloadFileResponse from "@/utils/downloadFileResponse";

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

  if ( folder ) {
    return downloadFileResponse( {
      filePath: path.join(
        os.tmpdir(),
        folder,
        "assets",
        name
      )
    } );
  }

  return downloadFileResponse( {
    filePath: path.join(
      os.tmpdir(),
      name
    )
  } );
}