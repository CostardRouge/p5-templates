import createBrowserPage from "@/utils/createBrowserPage";

import fs from "node:fs/promises";
import path from "path";

const { page } = await createBrowserPage({
    headless: true
});

export async function GET() {
    const url = `http://localhost:3000/p5/test`;

    await page.goto(url, { waitUntil: "networkidle" });

    // Wait for download
    const downloadPromise = page.waitForEvent('download');
    const download = await downloadPromise;

    const outputPath = `./public/uploads/${(new Date()).getTime()}_${download.suggestedFilename()}`;

    await download.saveAs(outputPath);

    // Read output file into buffer and delete it immediately
    const fileBuffer = await fs.readFile(outputPath);
    const fileName = path.basename(outputPath);

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