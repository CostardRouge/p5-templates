import downloadFileResponse from "@/utils/downloadFileResponse";
import createBrowserPage from "@/utils/createBrowserPage";
import takeScreenshot from "@/utils/takeScreenshot";

import fs from "node:fs/promises";
import path from "path";
import os from "node:os";

const { createPage } = await createBrowserPage({
    headless: true,
    deviceScaleFactor: 2
});

export async function POST(
    request: Request,
    { params }: { params: Promise<{ template: string }> }
) {
    const { headers } = request;

    if (!headers.get('content-type')?.includes('multipart/form-data')) {
        return new Response(`missing form-data!`, { status: 400 });
    }

    const template = (await params).template;

    if (!template) {
        return;
    }

    const data = await request.formData();
    const imageFile = data.get("image") as unknown as File;

    if (!imageFile) {
        return new Response(`missing image!`, { status: 400 });
    }

    const timestamp = (new Date()).getTime();

    const tmpDir = os.tmpdir();
    const uploadFilename = `${timestamp}_${imageFile.name}`;
    const uploadPath = path.join(tmpDir, uploadFilename);

    const outputFilename = `${timestamp}_${path.basename(uploadFilename, path.extname(uploadFilename))}_result.png`;
    const outputPath = path.join(tmpDir, outputFilename);

    const buffer = new Uint8Array(await imageFile.arrayBuffer());

    await fs.writeFile(uploadPath, buffer);

    const page = await createPage();

    await takeScreenshot({
        url: `http://localhost:3000/html/${template}?image=${encodeURIComponent(uploadFilename)}`,
        selectorToWaitFor: "div#loaded",
        outputPath,
        page
    });

    await page.close();

    return downloadFileResponse(outputPath, async () => {
        await fs.unlink(uploadPath).catch(() => {});
        await fs.unlink(outputPath).catch(() => {});
    });
}