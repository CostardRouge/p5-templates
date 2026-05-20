#!/usr/bin/env node
import fs from "fs";
import path from "path";
import {
  fileURLToPath
} from "url";
import chokidar from "chokidar";

const __dirname = path.dirname( fileURLToPath( import.meta.url ) );
const TEMPLATES_DIR = path.join(
  __dirname,
  "../src/templates"
);
const META_OUTPUT = path.join(
  TEMPLATES_DIR,
  "metadata.json"
);

/* ---- Scanning ---------------------------------------------------- */

/**
 * Detect whether `dir` is a sketch (has an `index.{js,ts,jsx,tsx}` entry).
 * `.jsx`/`.tsx` support lets DOM engines (e.g. GSAP) author React templates.
 */
function isSketchDir( dir ) {
  return [
    "index.js",
    "index.ts",
    "index.jsx",
    "index.tsx"
  ].some( ( entry ) => fs.existsSync( path.join(
    dir,
    entry
  ) ) );
}

/**
 * Build a metadata entry for a single sketch directory.
 */
function buildEntry(
  sketchDir, name, engineId, category
) {
  const stats = fs.statSync( sketchDir );
  const thumbnailPath = path.join(
    __dirname,
    `../public/assets/images/templates/${ engineId }/${ name }/thumbnail.jpeg`
  );

  return {
    name,
    engine: engineId,
    category,
    hasSketchForm: fs.existsSync( path.join(
      sketchDir,
      "options.ts"
    ) ),
    hasThumbnail: fs.existsSync( thumbnailPath ),
    mtime: stats.mtime.toISOString(),
    ctime: stats.birthtime?.toISOString() || stats.ctime.toISOString()
  };
}

/**
 * List visible sub-directories of `dir` (skip _ and . prefixed).
 */
function listSubDirs( dir ) {
  if ( !fs.existsSync( dir ) ) {
    return [];
  }

  return fs.readdirSync( dir ).filter( ( name ) => {
    if ( name.startsWith( "_" ) || name.startsWith( "." ) ) {
      return false;
    }

    try {
      return fs.statSync( path.join(
        dir,
        name
      ) ).isDirectory();
    } catch {
      return false;
    }
  } );
}

/**
 * Scan a single engine's `sketches/` directory.
 * Supports two nesting levels:
 *   sketches/<sketch>/index.js          → root-level sketch (no category)
 *   sketches/<category>/<sketch>/index.js → categorised sketch
 */
function scanEngine( engineId ) {
  const sketchesDir = path.join(
    TEMPLATES_DIR,
    engineId,
    "sketches"
  );
  const results = [];

  for ( const name of listSubDirs( sketchesDir ) ) {
    const fullPath = path.join(
      sketchesDir,
      name
    );

    if ( isSketchDir( fullPath ) ) {
      results.push( buildEntry(
        fullPath,
        name,
        engineId,
        null
      ) );
    } else {
      // Treat as category folder
      for ( const nested of listSubDirs( fullPath ) ) {
        const nestedPath = path.join(
          fullPath,
          nested
        );

        if ( isSketchDir( nestedPath ) ) {
          results.push( buildEntry(
            nestedPath,
            nested,
            engineId,
            name
          ) );
        }
      }
    }
  }

  return results;
}

/**
 * Discover all engine directories under src/templates/ and scan each.
 */
function generateMetadata() {
  const engineIds = listSubDirs( TEMPLATES_DIR );
  const allMeta = [];

  for ( const engineId of engineIds ) {
    const sketchesDir = path.join(
      TEMPLATES_DIR,
      engineId,
      "sketches"
    );

    if ( !fs.existsSync( sketchesDir ) ) {
      continue;
    }

    allMeta.push( ...scanEngine( engineId ) );
  }

  allMeta.sort( (
    a, b
  ) =>
    new Date( a.mtime ).getTime() - new Date( b.mtime ).getTime() );

  const content = JSON.stringify(
    allMeta,
    null,
    2
  );

  writeIfChanged(
    META_OUTPUT,
    content
  );
}

function writeIfChanged(
  filePath, content
) {
  const existing = fs.existsSync( filePath )
    ? fs.readFileSync(
      filePath,
      "utf-8"
    )
    : "";

  if ( existing !== content ) {
    fs.writeFileSync(
      filePath,
      content,
      "utf-8"
    );
    console.log( `✅  Updated metadata.json (${ JSON.parse( content ).length } templates)` );
  }
}

/* ---- Run --------------------------------------------------------- */

generateMetadata();

if ( process.env.NODE_ENV !== "production" ) {
  // Watch every engine's sketches/ directory
  const watchPaths = listSubDirs( TEMPLATES_DIR )
    .map( ( id ) => path.join(
      TEMPLATES_DIR,
      id,
      "sketches"
    ) )
    .filter( ( dir ) => fs.existsSync( dir ) );

  if ( watchPaths.length === 0 ) {
    console.log( "⚠️  No engine sketches directories found to watch" );
    process.exit( 0 );
  }

  console.log( `👀 Watching ${ watchPaths.length } engine(s): ${ watchPaths.map( ( p ) => path.basename( path.dirname( p ) ) ).join( ", " ) }` );

  const watcher = chokidar.watch(
    watchPaths,
    {
      persistent: true,
      ignoreInitial: true,
      depth: 2,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100
      }
    }
  );

  watcher
    .on(
      "addDir",
      ( dirPath ) => {
        const name = path.basename( dirPath );

        if ( !name.startsWith( "_" ) ) {
          console.log( `📁 New template detected: ${ name }` );
          generateMetadata();
        }
      }
    )
    .on(
      "unlinkDir",
      ( dirPath ) => {
        console.log( `🗑️  Template removed: ${ path.basename( dirPath ) }` );
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
