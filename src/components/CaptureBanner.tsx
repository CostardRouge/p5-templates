'use client';

import { JsonEditor, JsonData } from 'json-edit-react'
import React, { useState } from "react";
import { Download, Loader } from "lucide-react";

import fetchDownload from "@/components/utils/fetchDownload";

function CaptureBanner({ name, options, setOptions }: { name: string, options: Record<string, any>, setOptions: (options: JsonData) => void }) {
    const [ loading, setLoading ] = useState(false);

    async function handleBackRecording() {
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

        setLoading(true)

        fetchDownload(`/api/capture/p5/${encodeURIComponent(name)}`, {
            method: 'POST',
            body: formData
        }).finally(() => setLoading(false));
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
                {/*<button*/}
                {/*    className="rounded-sm px-4 border border-black"*/}
                {/*    onClick={() => {*/}
                {/*        // @ts-ignore*/}
                {/*        window.startLoopRecording()*/}
                {/*    }}*/}
                {/*    disabled={loading}*/}
                {/*>*/}
                {/*    Front-end recording*/}
                {/*</button>*/}

                <button
                    className="rounded-sm px-4 border border-black"
                    onClick={handleBackRecording}
                    disabled={loading}
                >
                    { loading ? <Loader className="inline mr-1" /> : <Download className="inline mr-1" /> }

                     Back-end recording (SSR)
                </button>

                {/*<button*/}
                {/*    className="rounded-sm px-4 border border-black"*/}
                {/*    disabled={loading}*/}
                {/*    // onClick={() => startHybridCapture()}*/}
                {/*>*/}
                {/*    Start hybrid recording*/}
                {/*</button>*/}
            </div>
        </div>
    )
}

export default CaptureBanner;