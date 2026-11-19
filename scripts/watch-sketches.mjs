#!/usr/bin/env node
import {
  execFileSync
} from "child_process";
import fs from "fs";
import path from "path";
import {
  fileURLToPath
} from "url";

import {
  BIRTH_LOG_ARGS,
  birthDates,
  SKETCH_FILE,
  readSketchFile
} from "./sketch-file.mjs";

const __dirname = path.dirname( fileURLToPath( import.meta.url ) );
const ROOT_DIR = path.join(
  __dirname,
  ".."
);
const TEMPLATES_DIR = path.join(
  ROOT_DIR,
  "src/sketches"
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
 * Whether the sketch registers an ASYNC draw — `sketch.draw( async () => … )`.
 *
 * Read straight off the entry file's source because the one consumer needs it
 * before anything is imported: a sketch that suspends mid-draw cannot run as an
 * embedded layer (see src/sketches/p5/utils/nestedSketch.js), and the layer
 * picker greys those tiles out rather than letting someone add a layer that
 * will never render. Every registration in the catalogue is one of two exact
 * shapes — `sketch.draw(` followed by an arrow, or by `async` — so matching the
 * text is reliable here; the runtime keeps its own check regardless.
 */
function hasAsyncDraw(
  sketchDir, entryFile
) {
  if ( !entryFile ) {
    return false;
  }

  try {
    const source = fs.readFileSync(
      path.join(
        sketchDir,
        entryFile
      ),
      "utf8"
    );

    return /sketch\s*\.\s*draw\s*\(\s*async\b/.test( source );
  } catch {
    return false;
  }
}

/**
 * Build the metadata + registry record for a single sketch directory.
 *
 * What the files show (an options form, a thumbnail, an async draw) is read
 * off the disk; what the sketch says about itself — description, tags,
 * `favorite`, `hiddenFromHome` (off the home page showcase),
 * `hiddenFromGallery` (off the /sketches gallery in production), a
 * `createdAt` override — comes from its optional `sketch.json`
 * (scripts/sketch-file.mjs). Both are read on every scan, so the catalogue
 * survives a regeneration.
 */
function buildRecord(
  sketchDir, name, engineId, category
) {
  const stats = fs.statSync( sketchDir );
  const entryFile = findEntryFile( sketchDir );
  const assetsBase = path.join(
    __dirname,
    `../public/assets/images/templates/${ engineId }/${ name }`
  );
  const hasOptionsTs = fs.existsSync( path.join(
    sketchDir,
    "options.ts"
  ) );
  const about = readSketchFile( sketchDir );

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
    // The larger encode of the same loop, rendered for some sketches only: a
    // reader outside this repo (steevepommier.com/motion) cannot stat the file.
    hasPreviewMd: fs.existsSync( path.join(
      assetsBase,
      "preview-md.webm"
    ) ),
    hiddenFromHome: about.hiddenFromHome,
    hiddenFromGallery: about.hiddenFromGallery,
    favorite: about.favorite,
    asyncDraw: hasAsyncDraw(
      sketchDir,
      entryFile
    ),
    ...( about.description === undefined ? {} : {
      description: about.description
    } ),
    ...( about.tags === undefined ? {} : {
      tags: about.tags
    } ),
    // Filled by generate(): the override below, else the recorded day, else
    // the first commit, else today.
    createdAt: about.createdAt,
    mtime: stats.mtime.toISOString(),
    ctime: stats.birthtime?.toISOString() || stats.ctime.toISOString()
  };

  return {
    meta,
    // Registry-only fields (never written to metadata.json).
    createdAtOverride: about.createdAt !== undefined,
    engine: engineId,
    sketchPath: category ? `${ category }/${ name }` : name,
    entryFile,
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
 * Discover all engine directories under src/sketches/ and scan each.
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

/**
 * Read the `mtime`/`ctime`/`createdAt` already recorded in metadata.json,
 * keyed by `<engine>:<name>`.
 *
 * These timestamps come from the filesystem, which resets them on every fresh
 * clone/checkout — so regenerating from raw `fs.stat` would rewrite every entry
 * and produce a huge, meaningless diff. Reusing the committed values keeps
 * regeneration idempotent: only entries whose *derived* data actually changed
 * show up in the diff. New sketches (absent here) fall back to `fs.stat`.
 */
function readExistingTimestamps() {
  const map = new Map();

  if ( !fs.existsSync( META_OUTPUT ) ) {
    return map;
  }

  try {
    const existing = JSON.parse( fs.readFileSync(
      META_OUTPUT,
      "utf-8"
    ) );

    for ( const entry of existing ) {
      if ( entry?.engine && entry?.name && entry?.mtime ) {
        map.set(
          `${ entry.engine }:${ entry.name }`,
          {
            mtime: entry.mtime,
            ctime: entry.ctime,
            createdAt: entry.createdAt
          }
        );
      }
    }
  } catch {
    // Malformed/old metadata.json — fall back to filesystem timestamps.
  }

  return map;
}

/**
 * First commit day of every sketch, from this clone's history — or an empty
 * map where there is none to read (the Docker build has no `.git`, CI clones
 * one commit deep, which would date every sketch to that commit).
 */
function readBirthDates( names ) {
  try {
    const git = ( args ) => execFileSync(
      "git",
      [
        "-C",
        ROOT_DIR,
        ...args
      ],
      {
        encoding: "utf8",
        maxBuffer: 1 << 28,
        stdio: [
          "ignore",
          "pipe",
          "ignore"
        ]
      }
    );

    if ( git( [
      "rev-parse",
      "--is-shallow-repository"
    ] ).trim() !== "false" ) {
      return new Map();
    }

    return birthDates(
      git( BIRTH_LOG_ARGS ),
      names
    );
  } catch {
    return new Map();
  }
}

/** Today as `YYYY-MM-DD`, in the machine's own time zone — a commit's author day. */
function today() {
  const now = new Date();
  const pad = ( n ) => String( n ).padStart(
    2,
    "0"
  );

  return `${ now.getFullYear() }-${ pad( now.getMonth() + 1 ) }-${ pad( now.getDate() ) }`;
}

function generate() {
  const records = scanAll();
  const preserved = readExistingTimestamps();
  // `createdAt` is the day the sketch was first committed. Like the two
  // timestamps it is RECORDED once and reused: git is only asked when an entry
  // has no day yet (a new sketch, or a catalogue rebuilt from nothing), so a
  // clone without history regenerates the same file. A sketch not committed
  // yet is born today. `sketch.json` overrides it for work older than the repo.
  let births = null;

  const meta = records
    .map( ( record ) => {
      const prev = preserved.get( `${ record.meta.engine }:${ record.meta.name }` );
      let createdAt = record.createdAtOverride ? record.meta.createdAt : prev?.createdAt;

      if ( !createdAt ) {
        births ??= readBirthDates( new Set( records.map( ( r ) => r.meta.name ) ) );
        createdAt = births.get( record.meta.name ) ?? today();
      }

      return prev
        ? {
          ...record.meta,
          createdAt,
          mtime: prev.mtime,
          ctime: prev.ctime
        }
        : {
          ...record.meta,
          createdAt
        };
    } )
    .sort( (
      a, b
    ) =>
      new Date( a.mtime ).getTime() - new Date( b.mtime ).getTime() );

  writeIfChanged(
    META_OUTPUT,
    // Trailing newline (POSIX convention) so the generator agrees with the merge
    // driver (scripts/git-merge-metadata.mjs) and editors' "insert final newline".
    // Without it the last line flip-flops between `]` and `]\n`, which git reports
    // as a conflict ("No newline at end of file") even when the content is equal.
    `${ JSON.stringify(
      meta,
      null,
      2
    ) }\n`,
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

// One-shot (no watcher) for builds, CI, the pre-commit hook, and
// `npm run sketch:meta:write`. The watcher is the default for local dev.
const ONCE = process.argv.includes( "--once" )
  || process.env.NODE_ENV === "production";

generate();

if ( !ONCE ) {
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

  // Adding/removing these to an existing sketch dir changes the generated
  // registries (entry module or option files), so they must trigger a regen
  // even though no directory was added/removed.
  const REGISTRY_FILES = new Set( [
    ...ENTRY_FILES,
    "options.ts",
    "options.json",
    SKETCH_FILE
  ] );

  function shouldRegenerate( filePath ) {
    return REGISTRY_FILES.has( path.basename( filePath ) );
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
    )
    .on(
      "change",
      ( filePath ) => {
        // Only sketch.json carries CONTENT into the catalogue; the other
        // registry files matter by their presence alone.
        if ( path.basename( filePath ) === SKETCH_FILE ) {
          console.log( `✏️  Sketch settings changed: ${ filePath }` );
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
