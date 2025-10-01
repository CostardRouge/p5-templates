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
};

async function getSketchList(): Promise<string[]> {
  if ( fs.existsSync( META_PATH ) ) {
    try {
      const meta: SketchMeta[] = JSON.parse( fs.readFileSync(
        META_PATH,
        "utf-8"
      ) );

      return meta.map( ( m ) => m.name );
    } catch ( err ) {
      console.error(
        "Failed to read sketch-meta.json:",
        err
      );
    }
  }

  // Emergency fallback (should rarely happen)
  console.warn( "⚠️  sketch-meta.json not found, falling back to filesystem scan" );
  const entries = await fs.promises.readdir( SKETCHES_DIRECTORY );

  return entries
    .filter( ( name ) => {
      if ( name.startsWith( "_" ) ) return false;
      const fullPath = path.join(
        SKETCHES_DIRECTORY,
        name
      );

      return fs.statSync( fullPath ).isDirectory();
    } )
    .sort( (
      a, b
    ) => {
      const aStat = fs.statSync( path.join(
        SKETCHES_DIRECTORY,
        a
      ) );
      const bStat = fs.statSync( path.join(
        SKETCHES_DIRECTORY,
        b
      ) );

      return aStat.mtime.getTime() - bStat.mtime.getTime();
    } );
}

export default getSketchList;