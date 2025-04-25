'use client';

import { JsonEditor, JsonData } from 'json-edit-react'
import React, { useState } from "react";

function CaptureBanner({ options, setOptions }: { options: Record<string, any>, setOptions: (options: JsonData) => void }) {
    // const [ jsonEditorState, setJsonEditorState ] = useState<Record<string, any>>(options);

    return (
        <div
            className="fixed items-end bottom-0 left-0 w-full bg-white/80 text-white px-4 gap-2 py-2 flex justify-between text-sm z-50">
            <span className="font-mono">🎥 Recording options</span>

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

            <div className="flex gap-2">
                <button
                    className="px-3 py-1 bg-white text-black rounded hover:bg-gray-200 transition"
                    onClick={() => {
                        // @ts-ignore
                        window.startLoopRecording()
                    }}
                >
                    Start front-end recording
                </button>

                <button
                    className="px-3 py-1 bg-white text-black rounded hover:bg-gray-200 transition"
                    onClick={() => fetch('/api/server-record', {method: 'POST'})}
                >
                    Start back-end recording
                </button>

                <button
                    className="px-3 py-1 bg-white text-black rounded hover:bg-gray-200 transition"
                    // onClick={() => startHybridCapture()}
                >
                    Start hybrid recording
                </button>
            </div>
        </div>
    )
}

export default CaptureBanner;