// lib/runRecording.ts
import createBrowserPage from '@/utils/createBrowserPage';
import { Page } from "playwright";
import { setProgress } from '@/lib/progressStore';
import minifyAndEncode from '@/utils/minifyAndEncodeCaptureOptions';

import { spawn } from 'child_process';
import fs from 'node:fs/promises';
import path from 'path';
import os from 'node:os';
import * as tar from 'tar';

export async function runRecording(
    jobId: string,
    template: string,
    formData: FormData,
) {
    let page: Page | undefined = undefined;

    /* ---------- workspace ---------- */
    const id = `${Date.now()}-${jobId}`;
    const tempDir = path.join(os.tmpdir(), id);
    await fs.mkdir(tempDir, { recursive: true });

    try {
        /* ---------- 1. parse options ---------- */
        setProgress(jobId, 'parse-options', 5);
        const captureOptions = JSON.parse(formData.get('options') as string);
        captureOptions.assets = [];
        captureOptions.id = id;

        /* ---------- 2. write asset files ---------- */
        const files = formData.getAll('files[]').filter(f => (f as File).size);
        let done = 0;
        for (const f of files) {
            const buf = new Uint8Array(await (f as File).arrayBuffer());
            await fs.writeFile(path.join(tempDir, (f as File).name), buf);
            captureOptions.assets.push((f as File).name);

            done++;
            setProgress(jobId, 'save-assets', 5 + Math.round((done / files.length) * 10));
        }

        /* ---------- 3. launch browser & load sketch ---------- */
        setProgress(jobId, 'launch-browser', 20);
        const { createPage } = await createBrowserPage({ headless: true, deviceScaleFactor: 1 });
        page = await createPage();
        await page.goto(
            `http://localhost:3000/p5/${template}?captureOptions=${minifyAndEncode(captureOptions)}`,
            { waitUntil: 'networkidle' },
        );
        await page.waitForSelector('canvas#defaultCanvas0.loaded');

        /* ---------- 4. capture frames ---------- */
        setProgress(jobId, 'capture-frames', 35);
        // @ts-ignore
        await page.evaluate(() => window.startLoopRecording());

        const dl = await page.waitForEvent('download', { timeout: 30_000_000 });
        const tarPath = path.join(tempDir, dl.suggestedFilename());
        await dl.saveAs(tarPath);
        await page.close();

        setProgress(jobId, 'download-frames', 60);

        /* ---------- 5. untar ---------- */
        await tar.x({ file: tarPath, cwd: tempDir });
        setProgress(jobId, 'extract-frames', 65);

        /* ---------- 6. encode video ---------- */
        const out = path.join(tempDir, `output_${id}_${template}.mp4`);
        const fps = captureOptions.animation?.framerate ?? 60;
        const ff = spawn(
            'ffmpeg',
            [
                '-r', String(fps),
                '-pattern_type', 'glob', '-i', '*.png',
                '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                '-preset', 'fast', '-crf', '23',
                '-y', out,
                '-progress', 'pipe:1', '-loglevel', 'error',
            ],
            { cwd: tempDir },
        );

        ff.stdout.on('data', b => {
            const m = /frame=\s*(\d+)/.exec(b.toString());
            if (m) {
                const pct = 65 + Math.min(34, (+m[1] / (fps * captureOptions.animation.duration)) * 34);
                setProgress(jobId, 'encoding', Math.round(pct));
            }
        });

        await new Promise<void>((res, rej) => {
            ff.on('close', c => (c === 0 ? res() : rej(new Error(`ffmpeg ${c}`))));
            ff.on('error', rej);
        });

        setProgress(jobId, 'done', 100);
    } catch (err) {
        setProgress(jobId, 'error', 100);
        await page?.close();
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        throw err;
    }
}