#!/usr/bin/env node
// Custom git merge driver for src/sketches/metadata.json.
//
// metadata.json is GENERATED from the filesystem by watch-sketches.mjs, so a
// textual 3-way merge is meaningless: it conflicts every time two branches each
// add (or re-thumbnail) a sketch. Instead of merging text, we union the two JSON
// arrays by sketch identity — which is exactly what a clean regeneration would
// produce once both sets of sketches exist on disk.
//
// git invokes this (see .gitattributes + setup-git-merge-drivers.mjs) as:
//   node scripts/git-merge-metadata.mjs %A %O %B
//     %A = ours / current  (ALSO the path git reads the merged result back from)
//     %O = common ancestor (unused — a union doesn't need it)
//     %B = theirs / other
// Exit 0 means "resolved"; any other status leaves the conflict for the user.

import fs from "node:fs";

const [
  oursPath,, theirsPath
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

const merged = new Map();

for ( const entry of [
  ...readEntries( oursPath ),
  ...readEntries( theirsPath )
] ) {
  const key = keyOf( entry );
  const existing = merged.get( key );

  if ( !existing ) {
    merged.set(
      key,
      {
        ...entry
      }
    );

    continue;
  }

  // Same sketch touched on both sides: keep the "richer" booleans so a thumbnail,
  // preview or form added on either branch survives the merge (and stays
  // consistent with the assets, which are themselves unioned into the tree).
  existing.hasSketchForm = existing.hasSketchForm || entry.hasSketchForm;
  existing.hasThumbnail = existing.hasThumbnail || entry.hasThumbnail;
  existing.hasPreview = existing.hasPreview || entry.hasPreview;
  existing.hiddenFromHome = existing.hiddenFromHome || entry.hiddenFromHome;
  existing.hiddenFromGallery =
    existing.hiddenFromGallery || entry.hiddenFromGallery;
}

// Match watch-sketches.mjs ordering (ascending mtime) so the file stays stable
// and the next regeneration produces no diff.
const out = [
  ...merged.values()
].sort( (
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
