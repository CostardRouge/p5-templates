// What a sketch SAYS about itself, as opposed to what its files show:
// `sketch.json` beside the entry file. One optional file per sketch, every key
// optional, an absent key meaning its default — so most sketches carry none.
//
//   {
//     "description": "One or two sentences on what it draws and how it moves.",
//     "tags": [ "3d", "raymarched" ],
//     "favorite": true,
//     "hiddenFromHome": true,
//     "hiddenFromGallery": true,
//     "createdAt": "2023-04-02"
//   }
//
// The keys are the catalogue's own names: watch-sketches.mjs copies them into
// src/sketches/metadata.json as they are, so what you write is what a reader
// of the catalogue gets. It replaces the three files a sketch could carry
// before (`about.json`, `.hidden-home`, `.hidden-template`): a marker file can
// only say yes or no, and one file per flag does not scale past two flags.
//
// Adding a key: validate it in parseSketchFile(), copy it in buildRecord()
// (watch-sketches.mjs), type it in SketchMetadata (src/engines/types.ts), and
// extend the drift test (src/sketches/__tests__/sketches.test.ts). A key no
// code reads does not belong here.
//
// This module is pure apart from readSketchFile()'s two fs calls, so the
// generator, its tests and any outside writer (the favourites editor of
// steevepommier.com writes `favorite` here) agree on one definition.

import fs from "fs";
import path from "path";

export const SKETCH_FILE = "sketch.json";

/** The files `sketch.json` replaced. Finding one fails the generation. */
export const LEGACY_FILES = [
  "about.json",
  ".hidden-home",
  ".hidden-template"
];

/** A tag is a short lowercase word or kebab-case phrase: `typography`, `needs-photo`. */
const TAG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const DESCRIPTION_MAX = 400;

const FLAGS = [
  "favorite",
  "hiddenFromHome",
  "hiddenFromGallery"
];

const KEYS = new Set( [
  "description",
  "tags",
  ...FLAGS,
  "createdAt"
] );

/** `YYYY-MM-DD`, and a day that exists. */
export function isDay( value ) {
  if ( typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test( value ) ) {
    return false;
  }

  const date = new Date( `${ value }T00:00:00Z` );

  return !Number.isNaN( date.getTime() ) && date.toISOString().slice(
    0,
    10
  ) === value;
}

/**
 * Validate the text of a `sketch.json` and return what the catalogue records:
 * the description trimmed to single spaces, the tags de-duplicated in order,
 * the three flags as booleans (absent = false), and `createdAt` when the file
 * overrides the date the sketch was first committed.
 *
 * A malformed file THROWS — an unknown key, a tag with capitals, a flag that
 * is not a boolean — so a typo stops the generation rather than being dropped
 * in silence. `file` only names the culprit in the message.
 */
export function parseSketchFile(
  text, file = SKETCH_FILE
) {
  let parsed;

  try {
    parsed = JSON.parse( text );
  } catch( error ) {
    throw new Error( `${ file }: not valid JSON (${ error.message })` );
  }

  if ( typeof parsed !== "object" || parsed === null || Array.isArray( parsed ) ) {
    throw new Error( `${ file }: must be an object` );
  }
  for ( const key of Object.keys( parsed ) ) {
    if ( !KEYS.has( key ) ) {
      throw new Error( `${ file }: unknown key "${ key }" — known keys: ${ [
        ...KEYS
      ].join( ", " ) }` );
    }
  }

  const sketch = {};

  if ( parsed.description !== undefined ) {
    if ( typeof parsed.description !== "string" || !parsed.description.trim() ) {
      throw new Error( `${ file }: "description" must be a non-empty string` );
    }
    if ( parsed.description.trim().length > DESCRIPTION_MAX ) {
      throw new Error( `${ file }: "description" is over ${ DESCRIPTION_MAX } characters — it is a blurb, not a manual` );
    }
    sketch.description = parsed.description.trim().replace(
      /\s+/g,
      " "
    );
  }
  if ( parsed.tags !== undefined ) {
    if ( !Array.isArray( parsed.tags ) || parsed.tags.some( ( tag ) => typeof tag !== "string" ) ) {
      throw new Error( `${ file }: "tags" must be a list of strings` );
    }
    for ( const tag of parsed.tags ) {
      if ( !TAG_PATTERN.test( tag ) ) {
        throw new Error( `${ file }: tag "${ tag }" must be lowercase letters, digits and hyphens (e.g. "needs-photo")` );
      }
    }
    sketch.tags = [
      ...new Set( parsed.tags )
    ];
  }
  for ( const flag of FLAGS ) {
    if ( parsed[ flag ] !== undefined && typeof parsed[ flag ] !== "boolean" ) {
      throw new Error( `${ file }: "${ flag }" must be true or false` );
    }
    sketch[ flag ] = parsed[ flag ] === true;
  }
  if ( parsed.createdAt !== undefined ) {
    if ( !isDay( parsed.createdAt ) ) {
      throw new Error( `${ file }: "createdAt" must be a day, YYYY-MM-DD` );
    }
    sketch.createdAt = parsed.createdAt;
  }

  return sketch;
}

/**
 * Read a sketch directory's `sketch.json`. No file: every default. A file the
 * format replaced (`about.json`, a `.hidden-*` marker) throws with the fix —
 * a branch cut before the change merges one in without a conflict, and reading
 * past it would silently un-hide or un-describe the sketch.
 */
export function readSketchFile( sketchDir ) {
  for ( const legacy of LEGACY_FILES ) {
    if ( fs.existsSync( path.join(
      sketchDir,
      legacy
    ) ) ) {
      throw new Error( `${ path.join(
        sketchDir,
        legacy
      ) }: replaced by ${ SKETCH_FILE } — move it there (${ legacy === "about.json"
        ? "same keys"
        : `"${ legacy === ".hidden-home" ? "hiddenFromHome" : "hiddenFromGallery" }": true` }) and delete this file` );
    }
  }

  const file = path.join(
    sketchDir,
    SKETCH_FILE
  );

  if ( !fs.existsSync( file ) ) {
    return parseSketchFile(
      "{}",
      file
    );
  }

  return parseSketchFile(
    fs.readFileSync(
      file,
      "utf8"
    ),
    file
  );
}

/**
 * The text of a `sketch.json` holding `values` — the one shape every writer
 * produces, so a file rewritten by a tool and a file saved by hand diff on the
 * changed key alone. Keys in the documented order, a flag written only when
 * true, two-space JSON with a final newline. `null` when nothing is left to
 * say: the caller deletes the file rather than keeping an empty object.
 */
export function serializeSketchFile( values ) {
  const out = {};

  if ( values.description ) {
    out.description = values.description;
  }
  if ( values.tags?.length ) {
    out.tags = values.tags;
  }
  for ( const flag of FLAGS ) {
    if ( values[ flag ] === true ) {
      out[ flag ] = true;
    }
  }
  if ( values.createdAt ) {
    out.createdAt = values.createdAt;
  }

  return Object.keys( out ).length === 0
    ? null
    : `${ JSON.stringify(
      out,
      null,
      2
    ) }\n`;
}

/**
 * The arguments of the one `git log` birthDates() reads: every add and rename
 * in the history, oldest first, each commit headed `@<author day>`.
 */
export const BIRTH_LOG_ARGS = [
  "log",
  "--reverse",
  "-M",
  "--diff-merges=first-parent",
  "--diff-filter=AR",
  "--name-status",
  "--format=@%as"
];

/**
 * First day each sketch existed, keyed by sketch name (the folder holding its
 * entry file), read from the output of `git log` with BIRTH_LOG_ARGS.
 *
 * Not `git log --follow`: that follows content similarity, so a v2 copied from
 * v1 inherits v1's date, and a restructure commit that moved a whole family
 * paired files across siblings. A rename carries the date only when the folder
 * keeps its name (a move) or when the old name is no longer a sketch (a real
 * rename); otherwise the new name is born that day. A name seen twice keeps
 * its first date. `alive` is the set of sketch names that exist today.
 */
export function birthDates(
  log, alive
) {
  const nameOf = ( file ) => file?.match( /\/([^/]+)\/index\.[jt]sx?$/ )?.[ 1 ] ?? null;
  const born = new Map();
  let day = "";

  for ( const line of log.split( "\n" ) ) {
    if ( line.startsWith( "@" ) ) {
      day = line.slice( 1 );
      continue;
    }

    const [
      status,
      a,
      b
    ] = line.split( "\t" );

    if ( status === "A" ) {
      const name = nameOf( a );

      if ( name && !born.has( name ) ) {
        born.set(
          name,
          day
        );
      }
    } else if ( status?.startsWith( "R" ) ) {
      const from = nameOf( a );
      const to = nameOf( b );

      if ( !to || born.has( to ) ) {
        continue;
      }

      const carries = from && born.has( from ) && ( from === to || !alive.has( from ) );

      born.set(
        to,
        carries ? born.get( from ) : day
      );
    }
  }

  return born;
}
