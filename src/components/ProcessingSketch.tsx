'use client';

import React, { useState, Fragment } from "react";
import Script from "next/script";
import CaptureBanner from "@/components/CaptureBanner";

function ProcessingSketch({ name, options }: { name: string, options: Record<string, unknown> }) {
    const [ sketchOptions, setSketchOptions ] = useState<Record<string, unknown>>(options);

    return (
        <Fragment>
            <script
                dangerouslySetInnerHTML={{
                    __html: `window.sketchOptions = ${JSON.stringify(sketchOptions)};`,
                }}
            />

            <Script
                type="module"
                src={`/assets/scripts/p5-sketches/sketches/${name}/index.js`}
            />

            <CaptureBanner
                options={sketchOptions}
                setOptions={options => setSketchOptions(options as Record<string, unknown>)}
            />
        </Fragment>
    )
}

export default ProcessingSketch;