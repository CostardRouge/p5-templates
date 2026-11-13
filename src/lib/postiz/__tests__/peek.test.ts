/**
 * The menu's Publishing line: Sketchbook's next send and its failures.
 */

import {
  publishingPeek
} from "../peek";
import type {
  PostizPost
} from "../client";

const NOW = Date.parse( "2026-11-13T11:00:00Z" );
const post = (
  id: string, identifier: string, date: string, state: PostizPost[ "state" ], group: string, tags = [
    "Sketchbook"
  ]
): PostizPost => ( {
  id,
  group,
  tags,
  content: "",
  publishDate: date,
  state,
  releaseURL: null,
  error: state === "error" ? "nope" : null,
  channel: {
    id: identifier,
    name: "Steeve",
    identifier,
    picture: null
  }
} );

describe(
  "publishingPeek",
  () => {
    it(
      "names Sketchbook's next send with its networks, and counts failed sends once",
      () => {
        const peek = publishingPeek(
          [
            post(
              "a",
              "instagram-standalone",
              "2026-11-15T09:00:00Z",
              "queue",
              "g1"
            ),
            post(
              "b",
              "tiktok",
              "2026-11-15T09:00:00Z",
              "queue",
              "g1"
            ),
            post(
              "c",
              "instagram-standalone",
              "2026-11-17T08:00:00Z",
              "queue",
              "g2"
            ),
            post(
              "atelier",
              "instagram-standalone",
              "2026-11-13T18:00:00Z",
              "queue",
              "g3",
              [
                "Atelier"
              ]
            ),
            post(
              "x1",
              "x",
              "2026-11-11T21:00:00Z",
              "error",
              "g4"
            ),
            post(
              "x2",
              "bluesky",
              "2026-11-11T21:00:00Z",
              "error",
              "g4"
            )
          ],
          [],
          NOW
        );

        expect( peek ).toEqual( {
          next: {
            at: Date.parse( "2026-11-15T09:00:00Z" ),
            providers: [
              "instagram",
              "tiktok"
            ]
          },
          failed: 1
        } );
      }
    );

    it(
      "says nothing is planned",
      () => {
        expect( publishingPeek(
          [],
          [],
          NOW
        ) ).toEqual( {
          next: null,
          failed: 0
        } );
      }
    );
  }
);
