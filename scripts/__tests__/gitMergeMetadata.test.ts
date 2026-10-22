import {
  spawnSync
} from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * The merge driver for src/sketches/metadata.json, run the way git runs it:
 * `node scripts/git-merge-metadata.mjs %A %O %B`, the result read back from %A.
 * Each sketch is merged field by field against the common ancestor — a plain
 * union once kept "our" copy of a sketch present on both sides and silently
 * dropped the fields the other branch had added to it.
 */
const driver = path.resolve(
  __dirname,
  "..",
  "git-merge-metadata.mjs"
);

type Entry = Record<string, unknown>;

function sketch(
  name: string, mtime: string, fields: Entry = {}
): Entry {
  return {
    name,
    engine: "p5",
    category: "demo",
    hasSketchForm: true,
    hasThumbnail: false,
    hasPreview: false,
    hiddenFromHome: false,
    hiddenFromGallery: false,
    ...fields,
    mtime,
    ctime: mtime
  };
}

function merge(
  base: Entry[], ours: Entry[], theirs: Entry[]
) {
  const dir = fs.mkdtempSync( path.join(
    os.tmpdir(),
    "merge-metadata-"
  ) );
  const write = (
    name: string, entries: Entry[]
  ) => {
    const file = path.join(
      dir,
      name
    );

    fs.writeFileSync(
      file,
      JSON.stringify(
        entries,
        null,
        2
      )
    );

    return file;
  };
  const oursPath = write(
    "ours.json",
    ours
  );
  const basePath = write(
    "base.json",
    base
  );
  const theirsPath = write(
    "theirs.json",
    theirs
  );
  const run = spawnSync(
    process.execPath,
    [
      driver,
      oursPath,
      basePath,
      theirsPath
    ],
    {
      encoding: "utf8"
    }
  );
  const text = fs.readFileSync(
    oursPath,
    "utf8"
  );

  fs.rmSync(
    dir,
    {
      recursive: true,
      force: true
    }
  );

  return {
    text,
    entries: JSON.parse( text ) as Entry[],
    stderr: run.stderr,
    status: run.status
  };
}

const T1 = "2026-01-01T00:00:00.000Z";
const T2 = "2026-02-01T00:00:00.000Z";
const T3 = "2026-03-01T00:00:00.000Z";

describe(
  "git-merge-metadata",
  () => {
    it(
      "keeps the fields the other side added to a sketch both sides have",
      () => {
        const base = [
          sketch(
            "a",
            T1
          )
        ];
        const ours = [
          sketch(
            "a",
            T1
          ),
          sketch(
            "mine",
            T3
          )
        ];
        const theirs = [
          sketch(
            "a",
            T1,
            {
              description: "A described sketch.",
              tags: [
                "flat",
                "demo"
              ]
            }
          )
        ];
        const {
          entries
        } = merge(
          base,
          ours,
          theirs
        );

        expect( entries.map( ( entry ) => entry.name ) ).toEqual( [
          "a",
          "mine"
        ] );
        expect( entries[ 0 ] ).toEqual( theirs[ 0 ] );
        // The added fields land where the generator writes them, before the timestamps.
        expect( Object.keys( entries[ 0 ] ) ).toEqual( Object.keys( theirs[ 0 ] ) );
      }
    );

    it(
      "takes each field from the side that changed it",
      () => {
        const base = [
          sketch(
            "a",
            T1
          )
        ];
        const ours = [
          sketch(
            "a",
            T1,
            {
              hasThumbnail: true
            }
          )
        ];
        const theirs = [
          sketch(
            "a",
            T1,
            {
              hiddenFromHome: true,
              description: "Theirs."
            }
          )
        ];
        const [
          merged
        ] = merge(
          base,
          ours,
          theirs
        ).entries;

        expect( merged.hasThumbnail ).toBe( true );
        expect( merged.hiddenFromHome ).toBe( true );
        expect( merged.description ).toBe( "Theirs." );
      }
    );

    it(
      "applies a change that turns a flag off on one side only",
      () => {
        const base = [
          sketch(
            "a",
            T1,
            {
              hasPreview: true
            }
          )
        ];
        const ours = base;
        const theirs = [
          sketch(
            "a",
            T1,
            {
              hasPreview: false
            }
          )
        ];

        expect( merge(
          base,
          ours,
          theirs
        ).entries[ 0 ].hasPreview ).toBe( false );
      }
    );

    it(
      "drops a field one side removed when the other left it alone",
      () => {
        const base = [
          sketch(
            "a",
            T1,
            {
              description: "Old."
            }
          )
        ];
        const ours = [
          sketch(
            "a",
            T1
          )
        ];

        expect( merge(
          base,
          ours,
          base
        ).entries[ 0 ] ).not.toHaveProperty( "description" );
      }
    );

    it(
      "unions sketches added on either side, ordered by mtime, with a final newline",
      () => {
        const base = [
          sketch(
            "a",
            T1
          )
        ];
        const {
          entries, text
        } = merge(
          base,
          [
            ...base,
            sketch(
              "late",
              T3
            )
          ],
          [
            ...base,
            sketch(
              "early",
              T2
            )
          ]
        );

        expect( entries.map( ( entry ) => entry.name ) ).toEqual( [
          "a",
          "early",
          "late"
        ] );
        expect( text.endsWith( "]\n" ) ).toBe( true );
      }
    );

    it(
      "honours a deletion the other side did not touch, and keeps an edited one",
      () => {
        const base = [
          sketch(
            "gone",
            T1
          ),
          sketch(
            "edited",
            T2
          )
        ];
        const ours = [
          sketch(
            "gone",
            T1
          ),
          sketch(
            "edited",
            T2,
            {
              hasThumbnail: true
            }
          )
        ];
        const theirs: Entry[] = [];

        expect( merge(
          base,
          ours,
          theirs
        ).entries.map( ( entry ) => entry.name ) ).toEqual( [
          "edited"
        ] );
      }
    );

    it(
      "ORs presence flags both sides changed, and keeps ours with a warning for anything else",
      () => {
        const base = [
          sketch(
            "a",
            T1,
            {
              description: "Base."
            }
          )
        ];
        const ours = [
          sketch(
            "a",
            T1,
            {
              hasThumbnail: true,
              description: "Ours."
            }
          )
        ];
        const theirs = [
          sketch(
            "a",
            T2,
            {
              hasThumbnail: true,
              hasPreview: true,
              description: "Theirs."
            }
          )
        ];
        const {
          entries, stderr, status
        } = merge(
          base,
          ours,
          theirs
        );

        expect( status ).toBe( 0 );
        expect( entries[ 0 ].hasThumbnail ).toBe( true );
        expect( entries[ 0 ].hasPreview ).toBe( true );
        expect( entries[ 0 ].description ).toBe( "Ours." );
        // Both timestamps moved: the later one wins.
        expect( entries[ 0 ].mtime ).toBe( T2 );
        expect( stderr ).toMatch( /"description" changed on both sides/ );
        expect( stderr ).toMatch( /sketch:meta:write/ );
      }
    );

    it(
      "still merges when the ancestor is missing (a sketch added on both sides)",
      () => {
        const ours = [
          sketch(
            "a",
            T1,
            {
              hasThumbnail: true
            }
          )
        ];
        const theirs = [
          sketch(
            "a",
            T1
          )
        ];

        expect( merge(
          [],
          ours,
          theirs
        ).entries ).toEqual( ours );
      }
    );
  }
);
