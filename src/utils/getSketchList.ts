import fs from "fs";
import path from "path";

import {
  SKETCHES_DIRECTORY
} from "@/constants";

const META_PATH = path.join(
  SKETCHES_DIRECTORY,
  "metadata.json"
);

type SketchMeta = {
  name: string;
  mtime: string;
  ctime: string;
  hasSketchForm: boolean;
};

async function getSketchList() {
  if ( fs.existsSync( META_PATH ) ) {
    try {
      const meta: SketchMeta[] = JSON.parse( fs.readFileSync(
        META_PATH,
        "utf-8"
      ) );

      return meta.map( ( {
        name, hasSketchForm
      } ) => ( {
        name,
        hasSketchForm
      } ) );
    } catch ( err ) {
      console.error(
        "Failed to read sketch-meta.json:",
        err
      );
    }
  }
}

export default getSketchList;