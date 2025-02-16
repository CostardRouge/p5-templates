import downloadFileResponse from "@/utils/downloadFileResponse";
import createBrowserPage from "@/utils/createBrowserPage";
import takeScreenshot from "@/utils/takeScreenshot";

import fs from "node:fs/promises";
import path from "path";

const { createPage } = await createBrowserPage({
    headless: true
});

export async function POST(
    request: Request,
    { params }: { params: Promise<{ template: string }> }
) {
    const { headers } = request;
    const template = (await params).template;
    const page = await createPage()

    if (!headers.get('content-type')?.includes('multipart/form-data')) {
        return new Response(`missing form-data!`, { status: 400 });
    }

    const data = await request.formData();
    const imageFile = data.get("image") as unknown as File;

    if (!imageFile) {
        return new Response(`missing image!`, { status: 400 });
    }

    const timestamp = (new Date()).getTime();
    const uploadPath = `./public/uploads/${timestamp}_${imageFile.name}`;
    const outputPath = `./public/outputs/${timestamp}_${path.basename(uploadPath, path.extname(uploadPath))}_result.png`;

    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    await fs.writeFile(uploadPath, buffer);
    await takeScreenshot({
        url: `http://localhost:3000/html/${template}?image=${encodeURIComponent(uploadPath.replace("./public", ""))}`,
        outputPath,
        page
    });

    page.close();

    return downloadFileResponse(outputPath, async () => {
        await fs.unlink(uploadPath);
        await fs.unlink(outputPath);
    })
}