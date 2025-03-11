import createBrowserPage from "@/utils/createBrowserPage";
import downloadFileResponse from "@/utils/downloadFileResponse";

import { spawn } from 'child_process';
import fs from "node:fs/promises";
import path from 'path';

const { createPage } = await createBrowserPage({
    headless: true,
    deviceScaleFactor: 1
});

function minifyAndEncodeCaptureOptions(captureOptions: Record<string, any>) {
    const jsonString = JSON.stringify(captureOptions);

    return Buffer.from(jsonString).toString('base64');
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ template: string }> }
) {
    const template = (await params).template;

    if (!template) {
        return new Response('Missing template', { status: 403 });
    }

    let page = undefined;
    const timestamp = Date.now();
    const tempDir = path.join(process.cwd(), 'public', 'uploads', `temp_${timestamp}`);

    // Create temporary directory
    await fs.mkdir(tempDir, { recursive: true });

    try {
        const formData = await request.formData();
        const captureOptions = JSON.parse(<string>formData.get('options'));

        captureOptions.assets = [];

        const files = formData.getAll('files[]').filter(
            file => (
                (file as File)?.size && (file as File)?.name
            )
        );

        for (const file of files) {
            const buffer = new Uint8Array(await (file as File).arrayBuffer());
            const filePath = path.join(tempDir, (file as File).name);

            await fs.writeFile(filePath, buffer);

            captureOptions.assets.push(path.join('/uploads', `temp_${timestamp}`, (file as File).name));
        }

        page = await createPage()
        await page.goto(`http://localhost:3000/p5/${template}?captureOptions=${minifyAndEncodeCaptureOptions(captureOptions)}`, { waitUntil: "networkidle" });
        await page.waitForSelector("canvas#defaultCanvas0.loaded");

        // @ts-ignore
        await page.evaluate(() => window.startLoopRecording());

        // Wait for download
        const download = await page.waitForEvent('download', { timeout: 30_000_000 });
        const downloadPath = path.join(tempDir, download.suggestedFilename());

        await download.saveAs(downloadPath);
        await page.close();

        // Generate video from frames
        const outputPath = path.join(tempDir, "output.mp4");

        const ffmpegOptions = [
            '-r', String(captureOptions.animation.framerate),
            '-i', downloadPath,
            // '-c:v', 'libx264',
            // '-pix_fmt', 'yuv420p',
            // '-preset', 'fast',
            // '-crf', '23',
            '-y',
            outputPath
        ];

        console.log({tempDir, captureOptions, downloadPath, outputPath, ffmpegOptions});

        await new Promise((resolve, reject) => {
            const ffmpeg = spawn('ffmpeg', ffmpegOptions, {
                cwd: tempDir
            });

            ffmpeg.on('close', (code) => {
                if (code !== 0) reject(new Error(`FFmpeg exited with code ${code}`));
                else resolve(true);
            });

            ffmpeg.on('error', reject);
        });

        return downloadFileResponse(outputPath, async () => {
            // Cleanup temporary files
            await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        });
    } catch (error) {
        await page?.close();

        // Cleanup temporary files on error
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});

        console.error('Processing error:', error);
        return new Response('Video processing failed: ' + JSON.stringify(error), { status: 500 });
    }
}