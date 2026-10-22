#!/usr/bin/env node
// Custom git merge driver for src/sketches/metadata.json.
//
// metadata.json is GENERATED from the filesystem by watch-sketches.mjs, so a
// textual 3-way merge is meaningless: it conflicts every time two branches each
// add (or re-thumbnail) a sketch. Instead of merging text, we merge the JSON
// arrays by sketch identity, then each entry field by field against the common
// ancestor — which is what a clean regeneration produces once both sides' files
// exist on disk.
//
// git invokes this (see .gitattributes + setup-git-merge-drivers.mjs) as:
//   node scripts/git-merge-metadata.mjs %A %O %B
//     %A = ours / current  (ALSO the path git reads the merged result back from)
//     %O = common ancestor
//     %B = theirs / other
// Exit 0 means "resolved"; any other status leaves the conflict for the user.
//
// Why the ancestor matters: a union that keeps "our" copy of a sketch present
// on both sides silently drops every field the other branch added or changed
// on it. That happened for real — a catch-up merge lost main's new
// `description` / `tags` on 8 sketches without a conflict.

import fs from "node:fs";

const [
  oursPath,
  basePath,
  theirsPath
] = process.argv.slice( 2 );

function readEntries( filePath ) {
  try {
    const parsed = JSON.parse( fs.readFileSync(
      filePath,
      "utf8"
    ) );

    return Array.isArray( parsed ) ? parsed : [];
  } catch {
    return [];
  }
}

// A sketch is uniquely identified by engine + category + name.
const keyOf = ( entry ) => `${ entry.engine }:${ entry.category ?? "" }:${ entry.name }`;

const byKey = ( entries ) => new Map( entries.map( ( entry ) => [
  keyOf( entry ),
  entry
] ) );

// Values are JSON (strings, booleans, arrays of tags), so their serialisation
// is a faithful equality; `undefined` stands for "field absent".
const same = (
  a, b
) => JSON.stringify( a ) === JSON.stringify( b );

// Flags that describe assets on disk. When both sides changed one differently,
// the assets themselves were unioned into the tree, so the flag that says
// "present" is the one consistent with it.
const PRESENCE_FLAGS = new Set( [
  "hasSketchForm",
  "hasThumbnail",
  "hasPreview",
  "hiddenFromHome",
  "hiddenFromGallery"
] );

const warnings = [];

/**
 * Merges one sketch's entry. Each field takes the side that changed it from the
 * ancestor; a field both sides changed differently ORs the presence flags, takes
 * the later timestamp, and otherwise keeps ours with a warning — the only case
 * where regenerating can still disagree with the result.
 */
function mergeEntry(
  key, base, ours, theirs
) {
  // Key order follows the side that has the extra fields, so a field one side
  // added lands where the generator writes it.
  const leading = Object.keys( theirs ).length > Object.keys( ours ).length
    ? theirs
    : ours;
  const keys = [
    ...new Set( [
      ...Object.keys( leading ),
      ...Object.keys( ours ),
      ...Object.keys( theirs )
    ] )
  ];
  const merged = {};

  for ( const field of keys ) {
    const before = base?.[ field ];
    const mine = ours[ field ];
    const other = theirs[ field ];
    let value;

    if ( same(
      mine,
      other
    ) || same(
      other,
      before
    ) ) {
      value = mine;
    } else if ( same(
      mine,
      before
    ) ) {
      value = other;
    } else if ( PRESENCE_FLAGS.has( field ) ) {
      value = Boolean( mine ) || Boolean( other );
    } else if ( field === "mtime" || field === "ctime" ) {
      value = new Date( mine ).getTime() >= new Date( other ).getTime() ? mine : other;
    } else {
      value = mine;
      warnings.push( `${ key }: "${ field }" changed on both sides, kept ours` );
    }

    if ( value !== undefined ) {
      merged[ field ] = value;
    }
  }

  return merged;
}

const base = byKey( readEntries( basePath ) );
const ours = byKey( readEntries( oursPath ) );
const theirs = byKey( readEntries( theirsPath ) );
const out = [];

for ( const key of new Set( [
  ...ours.keys(),
  ...theirs.keys()
] ) ) {
  const before = base.get( key );
  const mine = ours.get( key );
  const other = theirs.get( key );

  if ( mine && other ) {
    out.push( mergeEntry(
      key,
      before,
      mine,
      other
    ) );
    continue;
  }

  const present = mine ?? other;

  // Present on one side only. If the ancestor had it and the side that still
  // has it left it untouched, the other side deleted the sketch: honour that
  // rather than resurrect it. A sketch deleted on one side and edited on the
  // other is kept — its files' fate is git's call, and the drift test will say.
  if ( before && same(
    present,
    before
  ) ) {
    continue;
  }

  out.push( {
    ...present
  } );
}

// Match watch-sketches.mjs ordering (ascending mtime) so the file stays stable
// and the next regeneration produces no diff.
out.sort( (
  a, b
) => new Date( a.mtime ).getTime() - new Date( b.mtime ).getTime() );

fs.writeFileSync(
  oursPath,
  `${ JSON.stringify(
    out,
    null,
    2
  ) }\n`
);

if ( warnings.length ) {
  process.stderr.write( `git-merge-metadata: ${ warnings.join( "; " ) }. Run \`npm run sketch:meta:write\` and commit what it changes.\n` );
}
