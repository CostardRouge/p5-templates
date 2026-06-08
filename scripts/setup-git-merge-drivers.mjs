#!/usr/bin/env node
// Wires up the repo-local git merge driver used to auto-resolve conflicts in the
// generated metadata.json (see .gitattributes + scripts/git-merge-metadata.mjs).
//
// The registries use git's built-in `union` merge, which needs no setup. Only
// metadata.json needs a custom driver, and a driver name is just a label until
// it's defined in the (per-clone, not committed) git config — so this runs from
// `npm install` via the "prepare" script to configure it on every checkout.

import {
  execSync
} from "node:child_process";

function git( args ) {
  execSync(
    `git ${ args }`,
    {
      stdio: "ignore"
    }
  );
}

// Skip silently when not inside a git work tree (e.g. installed as a dependency
// tarball, or a CI cache) — there's nothing to configure.
try {
  git( "rev-parse --is-inside-work-tree" );
} catch {
  process.exit( 0 );
}

try {
  // git substitutes %A/%O/%B with the (already shell-quoted) temp-file paths for
  // ours / ancestor / theirs; the driver writes the resolution back into %A.
  git( "config merge.sketch-metadata.name "
    + "\"Union metadata.json by sketch identity\"" );
  git( "config merge.sketch-metadata.driver "
    + "\"node scripts/git-merge-metadata.mjs %A %O %B\"" );

  console.log( "✅  Configured git merge driver 'sketch-metadata'." );
} catch( error ) {
  // Never fail an install over this — worst case, conflicts are resolved by hand
  // with `npm run sketch:meta:write` exactly like before.
  console.warn( `⚠️  Could not configure 'sketch-metadata' merge driver: ${ error.message }` );
}
