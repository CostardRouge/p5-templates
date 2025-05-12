import fs from "fs";
import path from "path";

import {
  SKETCHES_DIRECTORY
} from "@/constants";

function getSketchOptions( sketchName: string ): Record<string, any> | undefined {
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
    return undefined;
  }
}

export default getSketchOptions;
