import {
  spawnSync
} from "child_process";
import path from "path";

/**
 * scripts/sketch-file.mjs — the one definition of a sketch's `sketch.json`,
 * shared by the catalogue generator and by outside writers. It is an ES
 * module, which this (CommonJS) Jest setup cannot import, so each case runs it
 * the way the generator does: in Node, the answer read back as JSON.
 */
const modulePath = path.resolve(
  __dirname,
  "..",
  "sketch-file.mjs"
);

function run(
  expression: string, input: unknown = null
): { ok: true;
  value: any; } | { ok: false;
    error: string; } {
  const source = `
    import * as m from ${ JSON.stringify( modulePath ) };
    const input = ${ JSON.stringify( input ) };
    try {
      const value = ${ expression };
      console.log( JSON.stringify( { ok: true, value: value instanceof Map ? Object.fromEntries( value ) : value } ) );
    } catch ( error ) {
      console.log( JSON.stringify( { ok: false, error: error.message } ) );
    }`;
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      source
    ],
    {
      encoding: "utf8"
    }
  );

  return JSON.parse( result.stdout );
}

const parse = ( value: unknown ) => run(
  "m.parseSketchFile( JSON.stringify( input ) )",
  value
);

describe(
  "parseSketchFile",
  () => {
    it(
      "reads an empty file as every default",
      () => {
        expect( parse( {} ) ).toEqual( {
          ok: true,
          value: {
            favorite: false,
            hiddenFromHome: false,
            hiddenFromGallery: false
          }
        } );
      }
    );

    it(
      "normalises the description and de-duplicates the tags",
      () => {
        expect( parse( {
          description: "  A  torus\n knot. ",
          tags: [
            "3d",
            "mesh",
            "3d"
          ],
          favorite: true,
          hiddenFromHome: true,
          createdAt: "2023-04-02"
        } ) ).toEqual( {
          ok: true,
          value: {
            description: "A torus knot.",
            tags: [
              "3d",
              "mesh"
            ],
            favorite: true,
            hiddenFromHome: true,
            hiddenFromGallery: false,
            createdAt: "2023-04-02"
          }
        } );
      }
    );

    it.each( [
      [
        "an unknown key",
        {
          favourite: true
        },
        /unknown key "favourite"/
      ],
      [
        "a flag that is not a boolean",
        {
          favorite: "yes"
        },
        /"favorite" must be true or false/
      ],
      [
        "a tag with capitals",
        {
          tags: [
            "Needs Photo"
          ]
        },
        /lowercase/
      ],
      [
        "a day that does not exist",
        {
          createdAt: "2023-02-30"
        },
        /"createdAt" must be a day/
      ],
      [
        "an empty description",
        {
          description: "  "
        },
        /non-empty/
      ],
      [
        "a list",
        [],
        /must be an object/
      ]
    ] )(
      "refuses %s",
      (
        _label, value, message
      ) => {
        const result = parse( value );

        expect( result.ok ).toBe( false );
        expect( ( result as { error: string } ).error ).toMatch( message );
      }
    );
  }
);

describe(
  "serializeSketchFile",
  () => {
    it(
      "writes only what differs from the defaults, in a fixed order",
      () => {
        expect( run(
          "m.serializeSketchFile( input )",
          {
            createdAt: "2023-04-02",
            hiddenFromGallery: false,
            favorite: true,
            tags: [
              "3d"
            ]
          }
        ) ).toEqual( {
          ok: true,
          value: "{\n  \"tags\": [\n    \"3d\"\n  ],\n  \"favorite\": true,\n  \"createdAt\": \"2023-04-02\"\n}\n"
        } );
      }
    );

    it(
      "says there is nothing to write when every value is a default",
      () => {
        expect( run(
          "m.serializeSketchFile( input )",
          {
            favorite: false,
            hiddenFromHome: false
          }
        ) ).toEqual( {
          ok: true,
          value: null
        } );
      }
    );

    it(
      "round-trips through parseSketchFile",
      () => {
        expect( run(
          "m.parseSketchFile( m.serializeSketchFile( m.parseSketchFile( JSON.stringify( input ) ) ) )",
          {
            description: "A knot.",
            favorite: true
          }
        ) ).toEqual( {
          ok: true,
          value: {
            description: "A knot.",
            favorite: true,
            hiddenFromHome: false,
            hiddenFromGallery: false
          }
        } );
      }
    );
  }
);

describe(
  "birthDates",
  () => {
    const log = [
      "@2023-01-10",
      "A\tsrc/sketches/p5/sketches/rings/rings-v1/index.js",
      "A\tsrc/sketches/p5/sketches/rings/rings-v1/options.ts",
      "@2023-02-01",
      // A v2 copied from v1: git calls it a rename-with-copy, it is a new sketch.
      "R080\tsrc/sketches/p5/sketches/rings/rings-v1/index.js\tsrc/sketches/p5/sketches/rings/rings-v2/index.js",
      "@2023-03-05",
      // A move: the folder keeps its name, so it keeps its day.
      "R100\tsrc/sketches/p5/sketches/rings/rings-v1/index.js\tsrc/sketches/p5/sketches/loops/rings-v1/index.js",
      // A real rename: the old name is no longer a sketch.
      "R100\tsrc/old/first-name/index.js\tsrc/sketches/p5/sketches/loops/second-name/index.js",
      "@2023-04-01",
      "A\tsrc/sketches/p5/sketches/rings/rings-v1/index.js"
    ].join( "\n" );

    it(
      "dates a sketch to its first commit, through moves and real renames only",
      () => {
        expect( run(
          "m.birthDates( input.log, new Set( input.alive ) )",
          {
            log: `@2022-12-01\nA\tsrc/old/first-name/index.js\n${ log }`,
            alive: [
              "rings-v1",
              "rings-v2",
              "second-name"
            ]
          }
        ) ).toEqual( {
          ok: true,
          value: {
            "first-name": "2022-12-01",
            "rings-v1": "2023-01-10",
            "rings-v2": "2023-02-01",
            "second-name": "2022-12-01"
          }
        } );
      }
    );
  }
);
