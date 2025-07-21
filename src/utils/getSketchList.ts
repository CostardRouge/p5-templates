import fs from "fs";
import path from "path";

import listDirectory from "@/utils/listDirectory";
import {
  SKETCHES_DIRECTORY
} from "@/constants";

async function getSketchList( folderPath = SKETCHES_DIRECTORY ) {
  const p5sketchesFolderContent = await listDirectory( folderPath );

  return p5sketchesFolderContent
    .sort( (
      aPath, bPath
    ) => {
      const {
        mtime: aMtime
      } = fs.statSync( `${ folderPath }/${ aPath }` );

      const {
        mtime: bMtime
      } = fs.statSync( `${ folderPath }/${ bPath }` );

      return aMtime.getTime() - bMtime.getTime();
    } )
    .filter( sketchFolderName => {
      if ( sketchFolderName.startsWith( "_" ) ) {
        return false;
      }

      const sketchPath = path.join(
        folderPath,
        sketchFolderName
      );

      return fs.statSync( sketchPath ).isDirectory();
    } );
}

export default getSketchList;