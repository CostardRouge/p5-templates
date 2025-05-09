import createBrowserPage from "@/utils/createBrowserPage";
import downloadFileResponse from "@/utils/downloadFileResponse";

import { spawn } from 'child_process';
import fs from "node:fs/promises";
import path from 'path';
import os from "node:os";

import minifyAndEncodeCaptureOptions from "@/utils/minifyAndEncodeCaptureOptions";

import * as tar from 'tar';

const { createPage } = await createBrowserPage({
    headless: true,
    deviceScaleFactor: 1
});

export async function POST(
    request: Request,
    { params }: { params: Promise<{ template: string }> }
) {
    const template = (await params).template;

    if (!template) {
        return new Response('Missing template', { status: 403 });
    }

    let page = undefined;
    const id = `${Date.now()}`;
    const tempDir = path.join(os.tmpdir(), id);

    // Create temporary directory
    await fs.mkdir(tempDir, { recursive: true });

    try {
        const formData = await request.formData();
        const captureOptions = JSON.parse(<string>formData.get('options'));

        captureOptions.assets = [];
        captureOptions.id = id;

        const files = formData.getAll('files[]').filter(
            file => (
                (file as File)?.size && (file as File)?.name
            )
        );

        for (const file of files) {
            const buffer = new Uint8Array(await (file as File).arrayBuffer());
            const filePath = path.join(tempDir, (file as File).name);

            await fs.writeFile(filePath, buffer);

            captureOptions.assets.push((file as File).name);
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

        // Extract tar file
        await tar.x({
            file: downloadPath,
            cwd: tempDir
        });

        // Generate video from frames
        const outputPath = path.join(tempDir, `output_${id}_${template}.mp4`);

        const ffmpegOptions = [
            '-r', String(captureOptions.animation.framerate),
            // '-i', downloadPath,

            '-pattern_type', 'glob',
            '-i', '*.png',
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-preset', 'fast',
            '-crf', '23',
            '-y',
            outputPath
        ];

        //console.log({tempDir, captureOptions, downloadPath, outputPath, ffmpegOptions});

        await new Promise((resolve, reject) => {
            const ffmpeg = spawn('ffmpeg', ffmpegOptions, {
                cwd: tempDir
            });

            ffmpeg.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`FFmpeg exited with code ${code}`))
                }
                else {
                    resolve(true)
                }
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