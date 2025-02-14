import createBrowserPage from "@/utils/createBrowserPage";
import takeScreenshot from "@/utils/takeScreenshot";

import fs from "node:fs/promises";
import path from "path";

const { page } = await createBrowserPage({
    headless: true
});

export async function POST(request: Request) {
    const { headers } = request;

    if (!headers.get('content-type')?.includes('multipart/form-data')) {
        return new Response(`missing form-data!`, { status: 400 });
    }

    const data = await request.formData();
    const imageFile = data.get("image") as unknown as File;

    if (!imageFile) {
        return new Response(`missing image!`, { status: 400 });
    }

    const uploadPath = `./public/uploads/${imageFile.name}`;
    const outputPath = `./public/outputs/${path.basename(uploadPath, path.extname(uploadPath))}_result.png`;

    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    await fs.writeFile(uploadPath, buffer);
    await takeScreenshot({
        url: `http://localhost:3000/exif-detail?image=${encodeURIComponent(uploadPath.replace("/public", ""))}`,
        outputPath,
        page
    })

    await fs.unlink(uploadPath); // Cleanup uploaded file

    // Read output file into buffer and delete it immediately
    const fileBuffer = await fs.readFile(outputPath);
    const fileName = path.basename(outputPath);
    await fs.unlink(outputPath); // Delete output file here

    // Create stream from buffer
    const stream = new ReadableStream({
        start(controller) {
            controller.enqueue(fileBuffer);
            controller.close();
        }
    });

    return new Response(stream, {
        status: 200,
        headers: {
            "Content-Type": "image/png",
            "Content-Disposition": `attachment; filename="${fileName}"`,
        },
    });
}