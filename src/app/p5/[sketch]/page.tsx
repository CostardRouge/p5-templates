import React from "react";

import listDirectory from "@/utils/listDirectory";
import getSketchOptions from "@/utils/getSketchOptions";

import ClientProcessingSketch from "@/components/ClientProcessingSketch";

const testImageFileNames = await listDirectory("public/assets/images/test");
const acceptedImageTypes = ["png", "jpg", "arw", "jpeg", "webp"];

const defaultSketchOptions = {
    size: {
        width: 1080,
        height: 1350
    },
    animation: {
        duration: 6,
        framerate: 60
    }
}

async function ProcessingSketch({ params }: { params: Promise<{ sketch: string }> }) {
    const sketchName = (await params).sketch;
    const sketchOptions = Object.assign( defaultSketchOptions, getSketchOptions( sketchName ) );

    if (!sketchOptions?.assets) {
        sketchOptions.assets = testImageFileNames
            .filter( testImageFileName => acceptedImageTypes.includes(testImageFileName.split(".")[1]) )
            .map( testImageFileName => `/assets/images/test/${testImageFileName}` )
    }

    return (
        <ClientProcessingSketch
            name={sketchName}
            options={sketchOptions}
        />
    )
}

export default ProcessingSketch;