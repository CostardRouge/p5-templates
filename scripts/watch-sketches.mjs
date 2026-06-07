#!/usr/bin/env node
import fs from "fs";
import path from "path";
import {
  fileURLToPath
} from "url";

const __dirname = path.dirname( fileURLToPath( import.meta.url ) );
const ROOT_DIR = path.join(
  __dirname,
  ".."
);
const TEMPLATES_DIR = path.join(
  ROOT_DIR,
  "src/templates"
);
const META_OUTPUT = path.join(
  TEMPLATES_DIR,
  "metadata.json"
);
const GENERATED_DIR = path.join(
  ROOT_DIR,
  "src/generated"
);
const MODULE_REGISTRY_OUTPUT = path.join(
  GENERATED_DIR,
  "sketchModuleRegistry.ts"
);
const OPTIONS_REGISTRY_OUTPUT = path.join(
  GENERATED_DIR,
  "sketchOptionsRegistry.ts"
);

/** Candidate entry filenames for a sketch, in priority order. */
const ENTRY_FILES = [
  "index.js",
  "index.ts",
  "index.jsx",
  "index.tsx"
];

/* ---- Scanning ---------------------------------------------------- */

/**
 * Return the entry filename of a sketch directory, or `null` when none
 * of the supported `index.*` files exist.
 * `.jsx`/`.tsx` support lets DOM engines (e.g. GSAP) author React templates.
 */
function findEntryFile( dir ) {
  return ENTRY_FILES.find( ( entry ) => fs.existsSync( path.join(
    dir,
    entry
  ) ) ) ?? null;
}

/**
 * Build the metadata + registry record for a single sketch directory.
 *
 * Visibility markers (touch one of these files inside the sketch dir):
 *   .hidden-home      → hide from the home page showcase
 *   .hidden-template  → hide from the /templates gallery (forward-looking)
 *
 * Markers are committed to git like any other source file; they survive
 * metadata regenerations because watch-sketches.mjs reads them on every scan.
 */
function buildRecord(
  sketchDir, name, engineId, category
) {
  const stats = fs.statSync( sketchDir );
  const assetsBase = path.join(
    __dirname,
    `../public/assets/images/templates/${ engineId }/${ name }`
  );
  const hasOptionsTs = fs.existsSync( path.join(
    sketchDir,
    "options.ts"
  ) );

  const meta = {
    name,
    engine: engineId,
    category,
    hasSketchForm: hasOptionsTs,
    hasThumbnail: fs.existsSync( path.join(
      assetsBase,
      "thumbnail.webp"
    ) ),
    hasPreview: fs.existsSync( path.join(
      assetsBase,
      "preview.webm"
    ) ),
    hiddenFromHome: fs.existsSync( path.join(
      sketchDir,
      ".hidden-home"
    ) ),
    hiddenFromTemplates: fs.existsSync( path.join(
      sketchDir,
      ".hidden-template"
    ) ),
    mtime: stats.mtime.toISOString(),
    ctime: stats.birthtime?.toISOString() || stats.ctime.toISOString()
  };

  return {
    meta,
    // Registry-only fields (never written to metadata.json).
    engine: engineId,
    sketchPath: category ? `${ category }/${ name }` : name,
    entryFile: findEntryFile( sketchDir ),
    hasOptionsTs,
    hasOptionsJson: fs.existsSync( path.join(
      sketchDir,
      "options.json"
    ) )
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
 * Detect whether `dir` is a sketch (has an `index.{js,ts,jsx,tsx}` entry).
 */
function isSketchDir( dir ) {
  return findEntryFile( dir ) !== null;
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
      results.push( buildRecord(
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
          results.push( buildRecord(
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
function scanAll() {
  const engineIds = listSubDirs( TEMPLATES_DIR );
  const records = [];

  for ( const engineId of engineIds ) {
    const sketchesDir = path.join(
      TEMPLATES_DIR,
      engineId,
      "sketches"
    );

    if ( !fs.existsSync( sketchesDir ) ) {
      continue;
    }

    records.push( ...scanEngine( engineId ) );
  }

  return records;
}

/* ---- Code generation --------------------------------------------- */

const GENERATED_HEADER
  = "/* eslint-disable */\n"
  + "// AUTO-GENERATED by scripts/watch-sketches.mjs — DO NOT EDIT BY HAND.\n"
  + "//\n"
  + "// Each entry is a thunk around a *literal* dynamic import. Literal import()\n"
  + "// calls are individual code-split points, so the dev server (Turbopack /\n"
  + "// webpack) compiles only the sketch you actually open — instead of building\n"
  + "// a context module over every sketch in the catalogue. Regenerated alongside\n"
  + "// metadata.json by `npm run sketch:meta`.\n";

/**
 * Emit the entries of a `Record<string, loader>` literal, sorted by key
 * for deterministic, diff-friendly output.
 */
function renderLoaderEntries( entries ) {
  return entries
    .slice()
    .sort( (
      a, b
    ) => a.key.localeCompare( b.key ) )
    .map( ( {
      key, importPath
    } ) => `  ${ JSON.stringify( key ) }: () => import( ${ JSON.stringify( importPath ) } ),` )
    .join( "\n" );
}

/**
 * Client- AND server-safe registry of sketch entry modules
 * (`index.{js,jsx,ts,tsx}`). Consumed by the engines (P5Engine / GsapEngine).
 */
function buildModuleRegistry( records ) {
  const entries = records
    .filter( ( record ) => record.entryFile )
    .map( ( record ) => ( {
      key: `${ record.engine }:${ record.sketchPath }`,
      importPath: `@/${ record.engine }/sketches/${ record.sketchPath }/${ record.entryFile }`
    } ) );

  return `${ GENERATED_HEADER }
export type SketchModuleLoader = () => Promise<any>;

export const sketchModuleLoaders: Record<string, SketchModuleLoader> = {
${ renderLoaderEntries( entries ) }
};

/**
 * Dynamically import a sketch's entry module by engine + path.
 * Rejects when no module is registered for the given key.
 */
export function loadSketchModule(
  engineId: string,
  sketchPath: string | undefined
): Promise<any> {
  const loader = sketchModuleLoaders[ \`\${ engineId }:\${ sketchPath }\` ];

  if ( !loader ) {
    return Promise.reject(
      new Error( \`No sketch module registered for "\${ engineId }:\${ sketchPath }"\` )
    );
  }

  return loader();
}
`;
}

/**
 * Server-only registry of a sketch's option files (`options.ts` / `options.json`).
 * Some `options.ts` files touch the filesystem at import time, so this registry
 * is marked `server-only` and must never be reached from the client bundle.
 */
function buildOptionsRegistry( records ) {
  const jsonEntries = records
    .filter( ( record ) => record.hasOptionsJson )
    .map( ( record ) => ( {
      key: `${ record.engine }:${ record.sketchPath }`,
      importPath: `@/${ record.engine }/sketches/${ record.sketchPath }/options.json`
    } ) );

  const formEntries = records
    .filter( ( record ) => record.hasOptionsTs )
    .map( ( record ) => ( {
      key: `${ record.engine }:${ record.sketchPath }`,
      // Extension-less: TypeScript rejects literal import specifiers ending in
      // `.ts` (TS5097). Resolves to `options.ts` — never `options.json`, which
      // requires its extension to be written explicitly.
      importPath: `@/${ record.engine }/sketches/${ record.sketchPath }/options`
    } ) );

  return `${ GENERATED_HEADER }import "server-only";

export type SketchModuleLoader = () => Promise<any>;

/** \`<engine>:<sketchPath>\` → loads the sketch's \`options.json\`. */
export const sketchOptionsJsonLoaders: Record<string, SketchModuleLoader> = {
${ renderLoaderEntries( jsonEntries ) }
};

/** \`<engine>:<sketchPath>\` → loads the sketch's \`options.ts\` (form module). */
export const sketchFormLoaders: Record<string, SketchModuleLoader> = {
${ renderLoaderEntries( formEntries ) }
};
`;
}

/* ---- Output ------------------------------------------------------ */

function generate() {
  const records = scanAll();

  const meta = records
    .map( ( record ) => record.meta )
    .sort( (
      a, b
    ) =>
      new Date( a.mtime ).getTime() - new Date( b.mtime ).getTime() );

  writeIfChanged(
    META_OUTPUT,
    JSON.stringify(
      meta,
      null,
      2
    ),
    `metadata.json (${ meta.length } templates)`
  );

  fs.mkdirSync(
    GENERATED_DIR,
    {
      recursive: true
    }
  );

  writeIfChanged(
    MODULE_REGISTRY_OUTPUT,
    buildModuleRegistry( records ),
    `sketchModuleRegistry.ts (${ records.filter( ( r ) => r.entryFile ).length } sketches)`
  );

  writeIfChanged(
    OPTIONS_REGISTRY_OUTPUT,
    buildOptionsRegistry( records ),
    "sketchOptionsRegistry.ts"
  );
}

function writeIfChanged(
  filePath, content, label
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
    console.log( `✅  Updated ${ label }` );
  }
}

/* ---- Run --------------------------------------------------------- */

generate();

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

  // Lazily imported so one-shot generation (build / CI) doesn't require the
  // dev-only `chokidar` dependency to be installed.
  const {
    default: chokidar
  } = await import( "chokidar" );

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

  const VISIBILITY_MARKERS = new Set( [
    ".hidden-home",
    ".hidden-template"
  ] );

  // Adding/removing these to an existing sketch dir changes the generated
  // registries (entry module or option files), so they must trigger a regen
  // even though no directory was added/removed.
  const REGISTRY_FILES = new Set( [
    ...ENTRY_FILES,
    "options.ts",
    "options.json"
  ] );

  function shouldRegenerate( filePath ) {
    const base = path.basename( filePath );

    return VISIBILITY_MARKERS.has( base ) || REGISTRY_FILES.has( base );
  }

  watcher
    .on(
      "addDir",
      ( dirPath ) => {
        const name = path.basename( dirPath );

        if ( !name.startsWith( "_" ) ) {
          console.log( `📁 New template detected: ${ name }` );
          generate();
        }
      }
    )
    .on(
      "unlinkDir",
      ( dirPath ) => {
        console.log( `🗑️  Template removed: ${ path.basename( dirPath ) }` );
        generate();
      }
    )
    .on(
      "add",
      ( filePath ) => {
        if ( shouldRegenerate( filePath ) ) {
          console.log( `➕ Sketch file added: ${ filePath }` );
          generate();
        }
      }
    )
    .on(
      "unlink",
      ( filePath ) => {
        if ( shouldRegenerate( filePath ) ) {
          console.log( `➖ Sketch file removed: ${ filePath }` );
          generate();
        }
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
