/**
 * Sketch regression tests.
 *
 * Asserts that every entry in `src/templates/metadata.json` resolves to a
 * sketch directory on disk with the files it claims to have, and that the
 * committed metadata.json matches what watch-sketches.mjs would generate
 * today. Catches:
 *
 *   - stale metadata.json (sketch added/renamed but meta not regenerated)
 *   - missing index/options files (broken imports at runtime)
 *   - missing thumbnails/previews (broken cards on the gallery + OG images)
 *   - sketches present on disk but absent from metadata (and vice versa)
 */
import fs from "fs";
import path from "path";

import type {
  SketchMetadata
} from "@/engines/types";

import metadata from "@/templates/metadata.json";

const REPO_ROOT = path.resolve(
  __dirname,
  "../../.."
);
const TEMPLATES_DIR = path.join(
  REPO_ROOT,
  "src/templates"
);
const PUBLIC_ASSETS_DIR = path.join(
  REPO_ROOT,
  "public/assets/images/templates"
);

const SKETCH_ENTRY_FILES = [
  "index.js",
  "index.ts",
  "index.jsx",
  "index.tsx"
];

function sketchDir( entry: SketchMetadata ): string {
  return entry.category
    ? path.join(
      TEMPLATES_DIR,
      entry.engine,
      "sketches",
      entry.category,
      entry.name
    )
    : path.join(
      TEMPLATES_DIR,
      entry.engine,
      "sketches",
      entry.name
    );
}

function assetsDir( entry: SketchMetadata ): string {
  return path.join(
    PUBLIC_ASSETS_DIR,
    entry.engine,
    entry.name
  );
}

function hasEntryFile( dir: string ): boolean {
  return SKETCH_ENTRY_FILES.some( ( name ) => fs.existsSync( path.join(
    dir,
    name
  ) ) );
}

function isPublicSubdir( name: string ): boolean {
  return !name.startsWith( "_" ) && !name.startsWith( "." );
}

/**
 * Fail a "metadata is in sync with disk" check with an actionable message.
 * Every such drift is fixed by regenerating metadata.json from disk, so point
 * the developer straight at the command instead of just dumping a diff.
 */
function expectInSync( problems: string[] ): void {
  if ( problems.length > 0 ) {
    throw new Error( `${ problems.join( "\n" ) }`
      + "\n\nmetadata.json is out of sync with the filesystem."
      + "\nRun `npm run sketch:meta:write` and commit the regenerated files."
      + "\n(The pre-commit hook runs this automatically when a sketch or a"
      + " template asset changes.)" );
  }
}

const entries = metadata as SketchMetadata[];

describe(
  "metadata.json",
  () => {
    it(
      "contains at least one sketch (sanity check that the file isn't empty)",
      () => {
        expect( entries.length ).toBeGreaterThan( 0 );
      }
    );

    it(
      "has unique (engine, name) pairs",
      () => {
        const seen = new Set<string>();
        const duplicates: string[] = [];

        for ( const entry of entries ) {
          const key = `${ entry.engine }/${ entry.name }`;

          if ( seen.has( key ) ) {
            duplicates.push( key );
          }
          seen.add( key );
        }

        expect( duplicates ).toEqual( [] );
      }
    );

    it(
      "has the required shape on every entry",
      () => {
        for ( const entry of entries ) {
          expect( typeof entry.name ).toBe( "string" );
          expect( entry.name.length ).toBeGreaterThan( 0 );
          expect( typeof entry.engine ).toBe( "string" );
          expect( entry.engine.length ).toBeGreaterThan( 0 );
          expect( entry.category === null || typeof entry.category === "string" ).toBe( true );
          expect( typeof entry.hasSketchForm ).toBe( "boolean" );
          expect( typeof entry.hasThumbnail ).toBe( "boolean" );
          expect( typeof entry.hasPreview ).toBe( "boolean" );
        }
      }
    );
  }
);

describe(
  "every metadata entry resolves to a sketch on disk",
  () => {
    it.each( entries.map( ( e ) => [
      `${ e.engine }/${ e.category ?? "_" }/${ e.name }`,
      e
    ] ) as Array<[string, SketchMetadata]> )(
      "%s — has a sketch directory with an index file",
      (
        _label, entry
      ) => {
        const dir = sketchDir( entry );

        expect( fs.existsSync( dir ) ).toBe( true );
        expect( hasEntryFile( dir ) ).toBe( true );
      }
    );

    it.each( entries
      .filter( ( e ) => e.hasSketchForm )
      .map( ( e ) => [
        `${ e.engine }/${ e.name }`,
        e
      ] ) as Array<[string, SketchMetadata]> )(
      "%s — claims hasSketchForm and has options.ts",
      (
        _label, entry
      ) => {
        expect( fs.existsSync( path.join(
          sketchDir( entry ),
          "options.ts"
        ) ) ).toBe( true );
      }
    );

    it.each( entries
      .filter( ( e ) => e.hasThumbnail )
      .map( ( e ) => [
        `${ e.engine }/${ e.name }`,
        e
      ] ) as Array<[string, SketchMetadata]> )(
      "%s — claims hasThumbnail and the thumbnail.webp exists",
      (
        _label, entry
      ) => {
        expect( fs.existsSync( path.join(
          assetsDir( entry ),
          "thumbnail.webp"
        ) ) ).toBe( true );
      }
    );

    it.each( entries
      .filter( ( e ) => e.hasPreview )
      .map( ( e ) => [
        `${ e.engine }/${ e.name }`,
        e
      ] ) as Array<[string, SketchMetadata]> )(
      "%s — claims hasPreview and the preview.webm exists",
      (
        _label, entry
      ) => {
        expect( fs.existsSync( path.join(
          assetsDir( entry ),
          "preview.webm"
        ) ) ).toBe( true );
      }
    );
  }
);

/**
 * Walk the filesystem the same way scripts/watch-sketches.mjs does and assert
 * every discoverable sketch appears in metadata.json. This is the test that
 * would catch "I added a new sketch but forgot to run sketch:meta" — exactly
 * the kind of mismatch that ships a broken `/templates/...` page.
 */
describe(
  "filesystem is in sync with metadata.json",
  () => {
    function discoverSketches(): Array<{ engine: string;
      category: string | null;
      name: string;
      dir: string }> {
      const discovered: Array<{ engine: string;
        category: string | null;
        name: string;
        dir: string }> = [];
      const engineDirs = fs.readdirSync( TEMPLATES_DIR ).filter( ( name ) => {
        const full = path.join(
          TEMPLATES_DIR,
          name
        );

        return fs.statSync( full ).isDirectory()
          && fs.existsSync( path.join(
            full,
            "sketches"
          ) );
      } );

      for ( const engine of engineDirs ) {
        const sketchesDir = path.join(
          TEMPLATES_DIR,
          engine,
          "sketches"
        );
        const topLevel = fs.readdirSync( sketchesDir ).filter( isPublicSubdir );

        for ( const name of topLevel ) {
          const fullPath = path.join(
            sketchesDir,
            name
          );

          if ( !fs.statSync( fullPath ).isDirectory() ) {
            continue;
          }

          if ( hasEntryFile( fullPath ) ) {
            discovered.push( {
              engine,
              category: null,
              name,
              dir: fullPath
            } );
            continue;
          }

          // Treated as a category folder.
          const nested = fs.readdirSync( fullPath ).filter( isPublicSubdir );

          for ( const child of nested ) {
            const childPath = path.join(
              fullPath,
              child
            );

            if ( fs.statSync( childPath ).isDirectory() && hasEntryFile( childPath ) ) {
              discovered.push( {
                engine,
                category: name,
                name: child,
                dir: childPath
              } );
            }
          }
        }
      }

      return discovered;
    }

    const onDisk = discoverSketches();

    it(
      "every sketch directory on disk is present in metadata.json",
      () => {
        const metaKeys = new Set( entries.map( ( e ) => `${ e.engine }/${ e.name }` ) );
        const missing = onDisk
          .map( ( s ) => `${ s.engine }/${ s.name }` )
          .filter( ( key ) => !metaKeys.has( key ) );

        expectInSync( missing );
      }
    );

    it(
      "every metadata entry has a matching directory on disk",
      () => {
        const diskKeys = new Set( onDisk.map( ( s ) => `${ s.engine }/${ s.name }` ) );
        const orphans = entries
          .map( ( e ) => `${ e.engine }/${ e.name }` )
          .filter( ( key ) => !diskKeys.has( key ) );

        expectInSync( orphans );
      }
    );

    it(
      "metadata category matches the directory layout",
      () => {
        const diskByKey = new Map( onDisk.map( ( s ) => [
          `${ s.engine }/${ s.name }`,
          s
        ] ) );
        const mismatches: string[] = [];

        for ( const entry of entries ) {
          const disk = diskByKey.get( `${ entry.engine }/${ entry.name }` );

          if ( disk && disk.category !== entry.category ) {
            mismatches.push( `${ entry.engine }/${ entry.name }: metadata=${ entry.category } disk=${ disk.category }` );
          }
        }

        expectInSync( mismatches );
      }
    );

    it(
      "hasSketchForm / hasThumbnail / hasPreview flags match what is on disk",
      () => {
        const diskByKey = new Map( onDisk.map( ( s ) => [
          `${ s.engine }/${ s.name }`,
          s
        ] ) );
        const drift: string[] = [];

        for ( const entry of entries ) {
          const disk = diskByKey.get( `${ entry.engine }/${ entry.name }` );

          if ( !disk ) {
            continue;
          }

          const realHasForm = fs.existsSync( path.join(
            disk.dir,
            "options.ts"
          ) );
          const realHasThumb = fs.existsSync( path.join(
            assetsDir( entry ),
            "thumbnail.webp"
          ) );
          const realHasPreview = fs.existsSync( path.join(
            assetsDir( entry ),
            "preview.webm"
          ) );

          if ( realHasForm !== entry.hasSketchForm ) {
            drift.push( `${ entry.engine }/${ entry.name }: hasSketchForm meta=${ entry.hasSketchForm } disk=${ realHasForm }` );
          }
          if ( realHasThumb !== entry.hasThumbnail ) {
            drift.push( `${ entry.engine }/${ entry.name }: hasThumbnail meta=${ entry.hasThumbnail } disk=${ realHasThumb }` );
          }
          if ( realHasPreview !== entry.hasPreview ) {
            drift.push( `${ entry.engine }/${ entry.name }: hasPreview meta=${ entry.hasPreview } disk=${ realHasPreview }` );
          }
        }

        expectInSync( drift );
      }
    );
  }
);
