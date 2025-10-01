#!/usr/bin/env node
import fs from "fs";
import path from "path";
import {
  fileURLToPath
} from "url";
import chokidar from "chokidar";

const __dirname = path.dirname( fileURLToPath( import.meta.url ) );
const SKETCHES_DIR = path.join(
  __dirname,
  "../public/assets/scripts/p5-sketches/sketches"
);
const META_OUTPUT = path.join(
  SKETCHES_DIR,
  "metadata.json"
);

function generateMetadata() {
  if ( !fs.existsSync( SKETCHES_DIR ) ) {
    console.warn( `⚠️ Sketches directory not found: ${ SKETCHES_DIR }` );
    return;
  }

  const entries = fs.readdirSync( SKETCHES_DIR );

  const sketchMeta = entries
    .filter( ( name ) => {
      if ( name.startsWith( "_" ) ) return false;
      const fullPath = path.join(
        SKETCHES_DIR,
        name
      );

      try {
        return fs.statSync( fullPath ).isDirectory();
      } catch {
        return false;
      }
    } )
    .map( ( name ) => {
      const fullPath = path.join(
        SKETCHES_DIR,
        name
      );
      const stats = fs.statSync( fullPath );

      return {
        name,
        mtime: stats.mtime.toISOString(),
        ctime: stats.birthtime?.toISOString() || stats.ctime.toISOString(),
      };
    } )
    .sort( (
      a, b
    ) => new Date( a.mtime ).getTime() - new Date( b.mtime ).getTime() );

  const oldContent = fs.existsSync( META_OUTPUT )
    ? fs.readFileSync(
      META_OUTPUT,
      "utf-8"
    )
    : "";
  const newContent = JSON.stringify(
    sketchMeta,
    null,
    2
  );

  if ( oldContent !== newContent ) {
    fs.writeFileSync(
      META_OUTPUT,
      newContent,
      "utf-8"
    );
    console.log( `✅  Updated metadata.json (${ sketchMeta.length } sketches)` );
  }
}

generateMetadata();

if ( process.env.NODE_ENV !== "production" ) {
  console.log( `👀 Watching sketches directory: ${ SKETCHES_DIR }` );

  const watcher = chokidar.watch(
    SKETCHES_DIR,
    {
      persistent: true,
      ignoreInitial: true,
      depth: 1,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      },
    }
  );

  watcher
    .on(
      "addDir",
      ( dirPath ) => {
        const name = path.basename( dirPath );

        if ( !name.startsWith( "_" ) ) {
          console.log( `📁 New sketch detected: ${ name }` );
          generateMetadata();
        }
      }
    )
    .on(
      "unlinkDir",
      ( dirPath ) => {
        console.log( `🗑️  Sketch removed: ${ path.basename( dirPath ) }` );
        generateMetadata();
      }
    );

  process.on(
    "SIGINT",
    () => {
      console.log( "\n👋 Stopping sketch watcher" );
      watcher.close();
      process.exit( 0 );
    }
  );
} else {
  process.exit( 0 );
}
