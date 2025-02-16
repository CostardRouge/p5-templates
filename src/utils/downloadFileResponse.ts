import fs from "node:fs/promises";
import path from "path";

import mime from "mime-types";

async function downloadFileResponse(filePath: string, onFileRead?: (fileBuffer: Buffer<ArrayBufferLike>) => void)
{
    const fileBuffer = await fs.readFile(filePath);
    const fileName = path.basename(filePath);

    await onFileRead?.(fileBuffer);

    // Create stream from buffer
    const stream = new ReadableStream({
        start(controller) {
            controller.enqueue(fileBuffer);
            controller.close();
        }
    });

    const mimeType = mime.lookup(fileName);

    return new Response(stream, {
        status: 200,
        headers: {
            ...(mimeType ? {
                "Content-Type": mimeType
            } : {}),
            "Content-Disposition": `attachment; filename="${fileName}"`,
        },
    });
}

export default downloadFileResponse;