'use client';

import { JsonEditor, JsonData } from 'json-edit-react'
import React, { useState } from "react";

function CaptureBanner({ name, options, setOptions }: { name: string, options: Record<string, any>, setOptions: (options: JsonData) => void }) {
    // const [ jsonEditorState, setJsonEditorState ] = useState<Record<string, any>>(options);

    async function handleBackRecording() {
        // 1. build payload
        const formData = new FormData();

        formData.append('options', JSON.stringify(options));

        if (Array.isArray(options.assets)) {
            await Promise.all(
                options.assets.map(async (url: string, i) => {
                    const resp = await fetch(url);
                    const blob = await resp.blob();
                    const name = url.split('/').pop() ?? `asset-${i}.png`;

                    formData.append('files[]', new File([blob], name, { type: blob.type }));
                }),
            );
        }

        const response = await fetch(`/api/capture/p5/${encodeURIComponent(name)}`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) throw new Error('recording failed');

        // // 3. let user download video
        // const video = await res.blob();
        // const link = document.createElement('a');
        // link.href = URL.createObjectURL(video);
        // link.download = `${sketchName}-${Date.now()}.mp4`;
        // link.click();
        // URL.revokeObjectURL(link.href);



        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        const contentDisposition = response.headers.get("Content-Disposition");
        let filename = "download.png";

        if (contentDisposition) {
            const match = contentDisposition.match(/filename="?(.+?)"?$/);
            if (match) filename = match[1];
        }

        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    return (
        <div
            className="flex justify-center gap-1 fixed left-0 bottom-0 w-full bg-white p-1 text-center border border-t-1 border-black z-50"
        >
            <div className="rounded-sm border border-black">
                <JsonEditor
                    collapse={true}
                    data={options}
                    setData={setOptions}
                    theme={
                        {
                            styles: {
                                container: {
                                    backgroundColor: '#f6f6f6',
                                    fontFamily: 'monospace'
                                }
                            }
                        }
                    }
                />
            </div>

            <div className="flex gap-2">
                <button
                    className="rounded-sm px-4 border border-black"
                    onClick={() => {
                        // @ts-ignore
                        // window.startLoopRecording()
                    }}
                >
                    Front-end recording
                </button>

                <button
                    className="rounded-sm px-4 border border-black"
                    onClick={handleBackRecording}
                >
                    Back-end recording (playwright)
                </button>

                {/*<button*/}
                {/*    className="rounded-sm px-4 border border-black"*/}
                {/*    // onClick={() => startHybridCapture()}*/}
                {/*>*/}
                {/*    Start hybrid recording*/}
                {/*</button>*/}
            </div>
        </div>
    )
}

export default CaptureBanner;