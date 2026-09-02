/**
 * No p5 sketch may keep its mutable state in a module-level object literal.
 *
 * A sketch module evaluates once, but it can run in several places at once —
 * the page, plus every "sketch" content item embedding it — and a
 * `const sketchState = { … }` at the top level is then one object shared by
 * all of them (the last layer to set up wins its buffer, layout caches thrash
 * between layers of different sizes). `sketch.state( () => ( { … } ) )` gives
 * the same object a record per instance; see `@/p5/utils/instanceState.js`.
 *
 * This is the drift check for that rule: the four names the codebase used for
 * that object are refused as plain literals. A new name needs adding here, and
 * a `let` at module scope is the same hazard in a shape this cannot see.
 */

import fs from "node:fs";
import path from "node:path";

const SKETCHES_DIR = path.join(
  process.cwd(),
  "src/sketches/p5/sketches"
);

const PLAIN_STATE_LITERAL = /^const (sketchState|state|canvases|buffers) = \{/m;

function* sketchEntryFiles( dir: string ): Generator<string> {
  for ( const entry of fs.readdirSync(
    dir,
    {
      withFileTypes: true
    }
  ) ) {
    const full = path.join(
      dir,
      entry.name
    );

    if ( entry.isDirectory() ) {
      yield* sketchEntryFiles( full );
    } else if ( entry.name === "index.js" ) {
      yield full;
    }
  }
}

describe(
  "p5 sketches keep their state per instance",
  () => {
    it(
      "declare no module-level state object as a plain literal",
      () => {
        const offenders: string[] = [];

        for ( const file of sketchEntryFiles( SKETCHES_DIR ) ) {
          const source = fs.readFileSync(
            file,
            "utf8"
          );

          if ( PLAIN_STATE_LITERAL.test( source ) ) {
            offenders.push( path.relative(
              SKETCHES_DIR,
              file
            ) );
          }
        }

        expect( offenders ).toEqual( [] );
      }
    );
  }
);
