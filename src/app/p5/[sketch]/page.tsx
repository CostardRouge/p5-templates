import React from "react";

async function ProcessingSketch({ params  }: { params: Promise<{ sketch: string }> }) {
    const sketch = (await params).sketch;
    const p5SketchScriptFileName = `${sketch}/${sketch}.js`;
    const p5SketchScriptFilePath = `/assets/scripts/p5-sketches/sketches/${p5SketchScriptFileName}`;

    return <script defer type="module" src={p5SketchScriptFilePath}></script>;
};

export default ProcessingSketch;