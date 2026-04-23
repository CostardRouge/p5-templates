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
  "../src/p5-sketches/sketches"
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
  const sketchMeta = [
  ];

  for ( const name of entries ) {
    if ( name.startsWith( "_" ) || name.startsWith( "." ) ) continue;

    const fullPath = path.join(
      SKETCHES_DIR,
      name
    );

    let isDir = false;

    try {
      isDir = fs.statSync( fullPath ).isDirectory();
    } catch {
      continue;
    }

    if ( !isDir ) continue;

    // Check if this is a sketch folder (has index.js)
    const indexPath = path.join(
      fullPath,
      "index.js"
    );
    const hasIndex = fs.existsSync( indexPath );

    if ( hasIndex ) {
      // This is a sketch folder at root level
      const optionsTypescriptFilePath = path.join(
        fullPath,
        "options.ts"
      );
      const stats = fs.statSync( fullPath );
      const thumbnailPath = path.join(
        __dirname,
        `../public/assets/images/templates/p5/${ name }/thumbnail.jpeg`
      );

      sketchMeta.push( {
        name,
        category: null,
        hasSketchForm: fs.existsSync( optionsTypescriptFilePath ),
        hasThumbnail: fs.existsSync( thumbnailPath ),
        mtime: stats.mtime.toISOString(),
        ctime: stats.birthtime?.toISOString() || stats.ctime.toISOString(),
      } );
    } else {
      // This might be a category folder, check for nested sketches
      const nestedEntries = fs.readdirSync( fullPath );

      for ( const nestedName of nestedEntries ) {
        if ( nestedName.startsWith( "_" ) || nestedName.startsWith( "." ) ) continue;

        const nestedPath = path.join(
          fullPath,
          nestedName
        );

        let isNestedDir = false;

        try {
          isNestedDir = fs.statSync( nestedPath ).isDirectory();
        } catch {
          continue;
        }

        if ( !isNestedDir ) continue;

        const nestedIndexPath = path.join(
          nestedPath,
          "index.js"
        );

        if ( fs.existsSync( nestedIndexPath ) ) {
          // This is a sketch inside a category folder
          const optionsTypescriptFilePath = path.join(
            nestedPath,
            "options.ts"
          );
          const stats = fs.statSync( nestedPath );
          const thumbnailPath = path.join(
            __dirname,
            `../public/assets/images/templates/p5/${ nestedName }/thumbnail.jpeg`
          );

          sketchMeta.push( {
            name: nestedName,
            category: name,
            hasSketchForm: fs.existsSync( optionsTypescriptFilePath ),
            hasThumbnail: fs.existsSync( thumbnailPath ),
            mtime: stats.mtime.toISOString(),
            ctime: stats.birthtime?.toISOString() || stats.ctime.toISOString(),
          } );
        }
      }
    }
  }

  sketchMeta.sort( (
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
  } else {
    console.log( `✅  metadata.json is up to date (${ sketchMeta.length } sketches)` );
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
