#!/usr/bin/env node
/**
 * Set or clear the `favorite` flag of sketches, then regenerate the catalogue.
 *
 * The write half of the favourites editor (`/api/dev/favorites`, a development
 * server only — `docs/memory/sketches.md`). It runs as its own process so the
 * app's route never bundles `sketch-file.mjs` and the file system it walks.
 *
 * stdin: a JSON array of `{ dir, favorite }`, `dir` a sketch folder relative
 * to the repository (`src/sketches/<engine>/sketches/[<category>/]<name>`).
 * stdout: `{ "written": N }`. Exits 1 with the reason on stderr.
 */
import {
  execFileSync
} from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  fileURLToPath
} from "node:url";

import {
  readSketchFile, serializeSketchFile, SKETCH_FILE
} from "./sketch-file.mjs";

const root = path.resolve(
  path.dirname( fileURLToPath( import.meta.url ) ),
  ".."
);
const SKETCH_DIR = /^src\/sketches\/(p5|gsap|threejs|html)\/sketches(\/[a-z0-9][a-z0-9-]*){1,2}$/;

function fail( message ) {
  process.stderr.write( `${ message }\n` );
  process.exit( 1 );
}

let targets;

try {
  targets = JSON.parse( fs.readFileSync(
    0,
    "utf8"
  ) );
} catch {
  fail( "expected a JSON array on stdin" );
}

if ( !Array.isArray( targets ) || targets.length === 0 || targets.length > 600 ) {
  fail( "expected 1 to 600 sketches" );
}

for ( const target of targets ) {
  if ( !target || typeof target.dir !== "string" || !SKETCH_DIR.test( target.dir ) || typeof target.favorite !== "boolean" ) {
    fail( `not a sketch folder and a boolean: ${ JSON.stringify( target ).slice(
      0,
      120
    ) }` );
  }
  if ( !fs.existsSync( path.join(
    root,
    target.dir
  ) ) ) {
    fail( `no such sketch folder: ${ target.dir }` );
  }
}

let written = 0;

for ( const {
  dir, favorite
} of targets ) {
  const sketchDir = path.join(
    root,
    dir
  );
  const values = readSketchFile( sketchDir );

  if ( Boolean( values.favorite ) === favorite ) {
    continue;
  }

  const text = serializeSketchFile( {
    ...values,
    favorite
  } );
  const file = path.join(
    sketchDir,
    SKETCH_FILE
  );

  if ( text === null ) {
    fs.rmSync(
      file,
      {
        force: true
      }
    );
  } else {
    fs.writeFileSync(
      file,
      text
    );
  }
  written++;
}

if ( written ) {
  execFileSync(
    process.execPath,
    [
      path.join(
        root,
        "scripts",
        "watch-sketches.mjs"
      ),
      "--once"
    ],
    {
      cwd: root,
      stdio: "ignore"
    }
  );
}

process.stdout.write( `${ JSON.stringify( {
  written
} ) }\n` );
