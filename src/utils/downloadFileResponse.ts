import fs from "node:fs/promises";
import path from "path";

import mime from "mime-types";

async function downloadFileResponse( {
  filePath,
  contentDisposition = "attachment",
  onFileRead
} : {
  filePath: string,
  contentDisposition?: string,
  onFileRead?: ( fileBuffer: Buffer<ArrayBufferLike> ) => void
                                     } ) {
  const fileBuffer = await fs.readFile( filePath );
  const fileName = path.basename( filePath );

  // Create stream from buffer
  const stream = new ReadableStream( {
    start( controller ) {
      controller.enqueue( fileBuffer );
      controller.close();
    },
    async cancel() {
      await onFileRead?.( fileBuffer );
    }
  } );

  const mimeType = mime.lookup( fileName );

  return new Response(
    stream,
    {
      status: 200,
      headers: {
        ...( mimeType ? {
          "Content-Type": mimeType
        } : {
        } ),
        "Content-Disposition": `${ contentDisposition }; filename="${ fileName }"`,
      },
    }
  );
}

export default downloadFileResponse;