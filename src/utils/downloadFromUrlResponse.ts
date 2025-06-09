import mime from "mime-types";

export async function downloadFromUrlResponse( fileUrl: string ): Promise<Response> {
  const response = await fetch( fileUrl );

  if ( !response.ok || !response.body ) {
    return new Response(
      "Failed to fetch file",
      {
        status: 502
      }
    );
  }

  const url = new URL( fileUrl );
  const fileName = url.pathname.split( "/" ).pop() || "download";
  const mimeType = mime.lookup( fileName ) || "application/octet-stream";

  return new Response(
    response.body,
    {
      status: 200,
      headers: {
        ...( mimeType ? {
          "Content-Type": mimeType
        } : {
        } ),
        "Content-Disposition": `attachment; filename="${ fileName }"`,
      },
    }
  );
}

export default downloadFromUrlResponse;