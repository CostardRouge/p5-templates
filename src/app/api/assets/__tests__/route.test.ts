import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  GET
} from "../route";

function request( query: Record<string, string> ) {
  return new Request( `http://localhost/api/assets?${ new URLSearchParams( query ).toString() }` );
}

describe(
  "GET /api/assets",
  () => {
    let folder: string;

    beforeAll( () => {
      const workspace = fs.mkdtempSync( path.join(
        os.tmpdir(),
        "assets-route-"
      ) );

      folder = path.basename( workspace );
      fs.mkdirSync( path.join(
        workspace,
        "assets"
      ) );
      fs.writeFileSync(
        path.join(
          workspace,
          "assets",
          "photo.txt"
        ),
        "inside"
      );
    } );

    afterAll( () => {
      fs.rmSync(
        path.join(
          os.tmpdir(),
          folder
        ),
        {
          recursive: true,
          force: true
        }
      );
    } );

    it(
      "serves a file from a job's assets folder",
      async() => {
        const response = await GET( request( {
          folder,
          name: "photo.txt"
        } ) );

        expect( response.status ).toBe( 200 );
        expect( await response.text() ).toBe( "inside" );
      }
    );

    it(
      "requires a name",
      async() => {
        expect( ( await GET( request( {} ) ) ).status ).toBe( 400 );
      }
    );

    it.each( [
      [
        {
          name: "../../../../../../etc/passwd"
        }
      ],
      [
        {
          name: "/etc/passwd"
        }
      ],
      [
        {
          folder: "../../../../../../etc",
          name: "passwd"
        }
      ],
      [
        {
          folder: "job",
          name: "../../../../../../../etc/passwd"
        }
      ]
    ] )(
      "refuses to leave the temp directory: %j",
      async( query ) => {
        const response = await GET( request( query ) );

        expect( response.status ).toBe( 400 );
        expect( await response.text() ).not.toContain( "root:" );
      }
    );
  }
);
