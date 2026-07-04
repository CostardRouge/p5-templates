import {
  execFileSync
} from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  createZip, type ZipEntry
} from "../clientZip";

/**
 * Validate the hand-rolled store-only ZIP writer against an independent
 * oracle — Python's `zipfile`. `testzip()` recomputes every entry's CRC-32
 * and returns the first corrupt name (or `None`), so a passing archive proves
 * the headers, sizes, offsets and CRCs all line up.
 */

type OracleResult = {
  bad: string | null;
  names: string[];
  contents: Record<string, string>; // name -> hex
};

async function zipToBuffer( entries: ZipEntry[] ): Promise<Buffer> {
  const blob = createZip(
    entries,
    // Fixed date keeps the bytes deterministic across runs.
    new Date( "2020-01-02T03:04:05Z" )
  );

  return Buffer.from( await blob.arrayBuffer() );
}

function inspectWithPython( zipBuffer: Buffer ): OracleResult {
  const file = path.join(
    fs.mkdtempSync( path.join(
      os.tmpdir(),
      "clientzip-"
    ) ),
    "archive.zip"
  );

  fs.writeFileSync(
    file,
    zipBuffer
  );

  const script = [
    "import zipfile, json, sys",
    "z = zipfile.ZipFile(sys.argv[1])",
    "bad = z.testzip()",
    "names = z.namelist()",
    "contents = {n: z.read(n).hex() for n in names}",
    "print(json.dumps({'bad': bad, 'names': names, 'contents': contents}))"
  ].join( "\n" );

  const stdout = execFileSync(
    "python3",
    [
      "-c",
      script,
      file
    ],
    {
      encoding: "utf8"
    }
  );

  return JSON.parse( stdout ) as OracleResult;
}

function toHex( bytes: Uint8Array ): string {
  return Buffer.from( bytes ).toString( "hex" );
}

describe(
  "createZip",
  () => {
    it(
      "produces an archive whose CRCs and contents a real unzip verifies",
      async() => {
        const encoder = new TextEncoder();
        const entries: ZipEntry[] = [
          {
            name: "frame-01.png",
            data: encoder.encode( "hello world" )
          },
          {
            name: "frame-02.png",
            // Full byte range, incl. 0x00, to exercise binary payloads.
            data: new Uint8Array( Array.from(
              {
                length: 256
              },
              (
                _unused, index
              ) => index
            ) )
          }
        ];

        const result = inspectWithPython( await zipToBuffer( entries ) );

        expect( result.bad ).toBeNull();
        expect( result.names ).toEqual( [
          "frame-01.png",
          "frame-02.png"
        ] );
        expect( result.contents[ "frame-01.png" ] ).toBe( toHex( entries[ 0 ].data ) );
        expect( result.contents[ "frame-02.png" ] ).toBe( toHex( entries[ 1 ].data ) );
      }
    );

    it(
      "preserves entry order for a many-frame export",
      async() => {
        const entries: ZipEntry[] = Array.from(
          {
            length: 20
          },
          (
            _unused, index
          ) => ( {
            name: `frame-${ String( index + 1 ).padStart(
              2,
              "0"
            ) }.png`,
            data: new Uint8Array( [
              index,
              index + 1,
              index + 2
            ] )
          } )
        );

        const result = inspectWithPython( await zipToBuffer( entries ) );

        expect( result.bad ).toBeNull();
        expect( result.names ).toEqual( entries.map( ( entry ) => entry.name ) );
      }
    );

    it(
      "emits a valid empty archive",
      async() => {
        const result = inspectWithPython( await zipToBuffer( [] ) );

        expect( result.bad ).toBeNull();
        expect( result.names ).toEqual( [] );
      }
    );
  }
);
