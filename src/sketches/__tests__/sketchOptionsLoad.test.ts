/**
 * No sketch's `options.ts` may reach the p5 runtime.
 *
 * The studio reads a sketch's form through `@/engines/sketchOptionLoaders`,
 * server-side, and `getSketchMeta` turns an import error into an EMPTY form:
 * the sketch then renders with no controls at all, and nothing in CI said so.
 * The classic way to get there is a shared form module that imports the p5
 * runtime (`animation.js` → `sketch.js`) — which is exactly what the
 * `iridescent` category did on its first day.
 *
 * Importing every options file here would be the direct check, but ts-jest
 * compiles to CommonJS and a third of them use top-level `await` (the video
 * and photo sketches resolve their test assets at import), so instead this
 * walks each file's static import graph and fails on any path that reaches a
 * runtime module. Resolution covers what the option files actually use:
 * relative imports and the `@/` aliases of tsconfig.
 */
import fs from "fs";
import path from "path";

const REPO_ROOT = path.resolve(
  __dirname,
  "../../.."
);
const SRC_DIR = path.join(
  REPO_ROOT,
  "src"
);
const SKETCHES_DIR = path.join(
  SRC_DIR,
  "sketches"
);

// Modules an options file must never pull in: they expect a live p5 instance
// (or the browser) the moment they are evaluated.
const RUNTIME_MODULES = [
  "sketches/p5/utils/sketch.js",
  "sketches/p5/utils/options.js",
  "sketches/p5/utils/animation.js",
  "sketches/p5/utils/time.js",
  "sketches/p5/utils/mappers.js",
  "sketches/p5/utils/graphics.js"
].map( ( rel ) => path.join(
  SRC_DIR,
  rel
) );

const ALIASES: Array<[string, string]> = [
  [
    "@/p5/",
    "sketches/p5/"
  ],
  [
    "@/gsap/",
    "sketches/gsap/"
  ],
  [
    "@/threejs/",
    "sketches/threejs/"
  ],
  [
    "@/html/",
    "sketches/html/"
  ],
  [
    "@/public/",
    "../public/"
  ],
  [
    "@/",
    ""
  ]
];

const EXTENSIONS = [
  "",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  "/index.ts",
  "/index.js"
];

function findOptionFiles( dir: string ): string[] {
  const found: string[] = [];

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
      if ( entry.name === "__tests__" || entry.name === "node_modules" ) {
        continue;
      }

      found.push( ...findOptionFiles( full ) );
    } else if ( entry.name === "options.ts" ) {
      found.push( full );
    }
  }

  return found;
}

function resolveSpecifier(
  specifier: string, from: string
): string | null {
  let base: string | null = null;

  if ( specifier.startsWith( "." ) ) {
    base = path.resolve(
      path.dirname( from ),
      specifier
    );
  } else {
    for ( const [
      alias,
      target
    ] of ALIASES ) {
      if ( specifier.startsWith( alias ) ) {
        base = path.join(
          SRC_DIR,
          target,
          specifier.slice( alias.length )
        );
        break;
      }
    }
  }

  // A bare package import (node_modules) is not ours to walk.
  if ( !base ) {
    return null;
  }

  for ( const ext of EXTENSIONS ) {
    const candidate = base + ext;

    if ( fs.existsSync( candidate ) && fs.statSync( candidate ).isFile() ) {
      return candidate;
    }
  }

  return null;
}

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)\s[^"'`]*?from\s*["']([^"']+)["']|(?:^|\n)\s*import\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

function importsOf( file: string ): string[] {
  const source = fs.readFileSync(
    file,
    "utf8"
  );
  const specifiers: string[] = [];

  for ( const match of source.matchAll( IMPORT_RE ) ) {
    const specifier = match[ 1 ] ?? match[ 2 ] ?? match[ 3 ];

    if ( specifier ) {
      specifiers.push( specifier );
    }
  }

  return specifiers;
}

/** The first import chain from `file` to a runtime module, or null. */
function runtimePath( file: string ): string[] | null {
  const seen = new Set<string>();
  const stack: Array<{ file: string;
    chain: string[] }> = [
    {
      file,
      chain: [
        file
      ]
    }
  ];

  while ( stack.length > 0 ) {
    const {
      file: current,
      chain
    } = stack.pop()!;

    if ( RUNTIME_MODULES.includes( current ) ) {
      return chain;
    }

    if ( seen.has( current ) ) {
      continue;
    }

    seen.add( current );

    for ( const specifier of importsOf( current ) ) {
      const resolved = resolveSpecifier(
        specifier,
        current
      );

      if ( resolved && !seen.has( resolved ) ) {
        stack.push( {
          file: resolved,
          chain: [
            ...chain,
            resolved
          ]
        } );
      }
    }
  }

  return null;
}

const optionFiles = findOptionFiles( SKETCHES_DIR );

describe(
  "no sketch options.ts reaches the p5 runtime",
  () => {
    it(
      "finds the option files",
      () => {
        expect( optionFiles.length ).toBeGreaterThan( 0 );
      }
    );

    it(
      "the walk resolves the project's aliases",
      () => {
        expect( resolveSpecifier(
          "@/p5/utils/sketch.js",
          optionFiles[ 0 ]
        ) ).toBe( RUNTIME_MODULES[ 0 ] );
      }
    );

    it(
      "the walk does find a runtime chain where one exists (the material's runtime half)",
      () => {
        const chain = runtimePath( path.join(
          SKETCHES_DIR,
          "p5/sketches/iridescent/_iridescence.js"
        ) );

        expect( chain ).not.toBeNull();
        expect( chain![ chain!.length - 1 ] ).toMatch( /sketches\/p5\/utils\/(animation|mappers|sketch)\.js$/ );
      }
    );

    it.each( optionFiles.map( ( file ) => [
      path.relative(
        SKETCHES_DIR,
        file
      ),
      file
    ] ) )(
      "%s",
      (
        _label, file
      ) => {
        const chain = runtimePath( file );

        if ( chain ) {
          throw new Error( "options.ts reaches the p5 runtime, so the studio would load it as an empty form:\n  "
            + chain.map( ( f ) => path.relative(
              REPO_ROOT,
              f
            ) ).join( "\n  → " ) );
        }
      }
    );
  }
);
