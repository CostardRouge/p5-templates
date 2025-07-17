import fs from "fs";
import path from "path";

import {
  SKETCHES_DIRECTORY
} from "@/constants";
import {
  SketchOption
} from "@/types/sketch.types";

function getSketchOptions( sketchName: string ): SketchOption | null {
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
