import fs from "fs";
import path from "path";

import listDirectory from "@/utils/listDirectory";
import {
  SKETCHES_DIRECTORY
} from "@/constants";

async function getSketchList( folderPath = SKETCHES_DIRECTORY ) {
  const p5sketchesFolderContent = await listDirectory( folderPath );

  return p5sketchesFolderContent
    .filter( name => {
      if ( name.startsWith( "_" ) ) {
        return false;
      }

      const sketchPath = path.join(
        folderPath,
        name
      );

      return fs.statSync( sketchPath ).isDirectory();
    } );
}

export default getSketchList;