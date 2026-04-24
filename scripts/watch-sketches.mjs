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

/* ---- Unified output (engine-agnostic) ----------------------------- */
const UNIFIED_SKETCHES_DIR = path.join(
  __dirname,
  "../src/sketches"
);
const UNIFIED_META_OUTPUT = path.join(
  UNIFIED_SKETCHES_DIR,
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
        engine: "p5",
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
            engine: "p5",
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

  /* ---- Also scan src/sketches/<engine>/ directories --------------- */
  if ( fs.existsSync( UNIFIED_SKETCHES_DIR ) ) {
    const engineDirs = fs.readdirSync( UNIFIED_SKETCHES_DIR ).filter( ( d ) => {
      if ( d.startsWith( "." ) || d === "metadata.json" ) return false;
      try { return fs.statSync( path.join( UNIFIED_SKETCHES_DIR, d ) ).isDirectory(); }
      catch { return false; }
    } );

    for ( const engineId of engineDirs ) {
      const engineDir = path.join( UNIFIED_SKETCHES_DIR, engineId );
      scanEngineDir( engineDir, engineId, sketchMeta );
    }
  }

  const newContent = JSON.stringify(
    sketchMeta,
    null,
    2
  );

  // Write legacy p5-only file (backward compat)
  writeIfChanged( META_OUTPUT, newContent, "p5 metadata.json" );

  // Write unified file
  writeIfChanged( UNIFIED_META_OUTPUT, newContent, "unified metadata.json" );
}

/**
 * Scan a `src/sketches/<engine>/` directory for sketches.
 * Same structure as p5: root-level sketch dirs or category/sketch nesting.
 */
function scanEngineDir( engineDir, engineId, target ) {
  const entries = fs.readdirSync( engineDir );

  for ( const name of entries ) {
    if ( name.startsWith( "_" ) || name.startsWith( "." ) ) continue;

    const fullPath = path.join( engineDir, name );
    let isDir = false;

    try { isDir = fs.statSync( fullPath ).isDirectory(); }
    catch { continue; }

    if ( !isDir ) continue;

    const indexPath = path.join( fullPath, "index.js" );
    const indexTsPath = path.join( fullPath, "index.ts" );

    if ( fs.existsSync( indexPath ) || fs.existsSync( indexTsPath ) ) {
      const optionsTs = path.join( fullPath, "options.ts" );
      const stats = fs.statSync( fullPath );
      const thumbnailPath = path.join(
        __dirname,
        `../public/assets/images/templates/${ engineId }/${ name }/thumbnail.jpeg`
      );

      target.push( {
        name,
        engine: engineId,
        category: null,
        hasSketchForm: fs.existsSync( optionsTs ),
        hasThumbnail: fs.existsSync( thumbnailPath ),
        mtime: stats.mtime.toISOString(),
        ctime: stats.birthtime?.toISOString() || stats.ctime.toISOString(),
      } );
    } else {
      // category folder
      const nestedEntries = fs.readdirSync( fullPath );

      for ( const nestedName of nestedEntries ) {
        if ( nestedName.startsWith( "_" ) || nestedName.startsWith( "." ) ) continue;
        const nestedPath = path.join( fullPath, nestedName );
        let isNestedDir = false;

        try { isNestedDir = fs.statSync( nestedPath ).isDirectory(); }
        catch { continue; }

        if ( !isNestedDir ) continue;

        const nestedIndex = path.join( nestedPath, "index.js" );
        const nestedIndexTs = path.join( nestedPath, "index.ts" );

        if ( fs.existsSync( nestedIndex ) || fs.existsSync( nestedIndexTs ) ) {
          const optionsTs = path.join( nestedPath, "options.ts" );
          const stats = fs.statSync( nestedPath );
          const thumbnailPath = path.join(
            __dirname,
            `../public/assets/images/templates/${ engineId }/${ nestedName }/thumbnail.jpeg`
          );

          target.push( {
            name: nestedName,
            engine: engineId,
            category: name,
            hasSketchForm: fs.existsSync( optionsTs ),
            hasThumbnail: fs.existsSync( thumbnailPath ),
            mtime: stats.mtime.toISOString(),
            ctime: stats.birthtime?.toISOString() || stats.ctime.toISOString(),
          } );
        }
      }
    }
  }
}

function writeIfChanged( filePath, content, label ) {
  const oldContent = fs.existsSync( filePath )
    ? fs.readFileSync( filePath, "utf-8" )
    : "";

  if ( oldContent !== content ) {
    fs.writeFileSync( filePath, content, "utf-8" );
    console.log( `✅  Updated ${ label } (${ JSON.parse( content ).length } sketches)` );
  } else {
    console.log( `✅  ${ label } is up to date (${ JSON.parse( content ).length } sketches)` );
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
