'use client';

import React, { useState, useEffect, Fragment } from "react";
import Script from "next/script";
import CaptureBanner from "@/components/CaptureBanner";

function ClientProcessingSketch({ name, options }: { name: string, options: Record<string, unknown> }) {
    const [ sketchOptions, setSketchOptions ] = useState<Record<string, unknown>>(options);

    useEffect(() => {
        (window as any).sketchOptions = sketchOptions;
        window.dispatchEvent(new CustomEvent('sketch-options', { detail: sketchOptions }));
    }, [sketchOptions]);

    return (
        <Fragment>
            <script
                dangerouslySetInnerHTML={{
                    __html: `window.sketchOptions = ${JSON.stringify(sketchOptions)};`,
                }}
            />

            <Script
                type="module"
                crossOrigin="anonymous"
                src={`/assets/scripts/p5-sketches/sketches/${name}/index.js`}
            />

            { options.capturing !== true && (
                <CaptureBanner
                    name={name}
                    options={sketchOptions}
                    setOptions={options => setSketchOptions(options as Record<string, unknown>)}
                />
            ) }
        </Fragment>
    )
}

export default ClientProcessingSketch;