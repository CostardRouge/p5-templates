import fs from "fs";
import path from "path";

import {
  SKETCHES_DIRECTORY
} from "@/constants";
import {
  RecordingSketchOptions
} from "@/types/recording.types";

function getSketchOptions( sketchName: string ): RecordingSketchOptions | null {
  try {
    return JSON.parse( fs.readFileSync(
      path.join(
        SKETCHES_DIRECTORY,
        sketchName,
        "options.json"
      ),
      "utf8"
    ) );
  }
  catch ( error ) {
    return null;
  }
}

export default getSketchOptions;
