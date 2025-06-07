import fs from "fs";
import path from "path";

import listDirectory from "@/utils/listDirectory";

const SKETCHES_DIRECTORY: string = process.env.SKETCHES_DIRECTORY!;

async function getSketchList( folderPath = SKETCHES_DIRECTORY ) {
  const p5sketchesFolderContent = await listDirectory( folderPath );

  return p5sketchesFolderContent
    .filter( name => {
      const sketchPath = path.join(
        folderPath,
        name
      );

      return fs.statSync( sketchPath ).isDirectory();
    } );
}

export default getSketchList;