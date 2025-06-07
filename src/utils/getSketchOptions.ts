import fs from "fs";
import path from "path";

const SKETCHES_DIRECTORY: string = process.env.SKETCHES_DIRECTORY!;

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
