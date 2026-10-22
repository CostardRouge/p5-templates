import path from "node:path";

import resolveInsideDirectory from "../resolveInsideDirectory";

const ROOT = path.resolve( "/srv/workspace" );

describe(
  "resolveInsideDirectory",
  () => {
    it(
      "resolves plain names and nested folders inside the root",
      () => {
        expect( resolveInsideDirectory(
          ROOT,
          "photo.jpg"
        ) ).toBe( path.join(
          ROOT,
          "photo.jpg"
        ) );
        expect( resolveInsideDirectory(
          ROOT,
          "job-1",
          "assets",
          "photo.jpg"
        ) ).toBe( path.join(
          ROOT,
          "job-1",
          "assets",
          "photo.jpg"
        ) );
      }
    );

    it(
      "keeps a `..` that stays inside the root",
      () => {
        expect( resolveInsideDirectory(
          ROOT,
          "a/../b.png"
        ) ).toBe( path.join(
          ROOT,
          "b.png"
        ) );
      }
    );

    it(
      "allows names that merely start with two dots",
      () => {
        expect( resolveInsideDirectory(
          ROOT,
          "..hidden"
        ) ).toBe( path.join(
          ROOT,
          "..hidden"
        ) );
      }
    );

    it.each( [
      [
        "../etc/passwd"
      ],
      [
        "../../etc/passwd"
      ],
      [
        "a/../../etc/passwd"
      ],
      [
        "/etc/passwd"
      ],
      [
        ".."
      ],
      [
        "."
      ],
      [
        ""
      ]
    ] )(
      "rejects %j",
      ( segment ) => {
        expect( resolveInsideDirectory(
          ROOT,
          segment
        ) ).toBeNull();
      }
    );

    it(
      "rejects an escape in any segment, not only the last",
      () => {
        expect( resolveInsideDirectory(
          ROOT,
          "../other-root",
          "assets",
          "photo.jpg"
        ) ).toBeNull();
        expect( resolveInsideDirectory(
          ROOT,
          "job-1",
          "assets",
          "../../../etc/passwd"
        ) ).toBeNull();
      }
    );

    it(
      "rejects a sibling directory that shares the root's prefix",
      () => {
        expect( resolveInsideDirectory(
          ROOT,
          "../workspace-evil/x"
        ) ).toBeNull();
      }
    );
  }
);
