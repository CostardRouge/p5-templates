import type {
  PostizPost
} from "../client";
import {
  HIDDEN_NOTE, sketchbookPosts
} from "../own";
import {
  plannedInstants
} from "../plan";

let hour = 0;
const post = (
  id: string, tags: string[] = [], group: string | null = null
): PostizPost => ( {
  id,
  group,
  tags,
  content: "",
  publishDate: new Date( Date.UTC(
    2026,
    10,
    16,
    hour++
  ) ).toISOString(),
  state: "queue",
  releaseURL: null,
  error: null,
  channel: null
} );

describe(
  "Sketchbook's own posts",
  () => {
    it(
      "keeps the tagged, the kept and their groups; leaves other apps' and untagged posts out",
      () => {
        const posts = [
          post(
            "tagged",
            [
              "SKETCHBOOK"
            ]
          ),
          post(
            "kept",
            [],
            "g1"
          ),
          post(
            "sibling",
            [],
            "g1"
          ),
          post(
            "atelier",
            [
              "Atelier"
            ],
            "g2"
          ),
          post( "nobody" )
        ];
        const {
          mine, others
        } = sketchbookPosts(
          posts,
          [
            "kept"
          ]
        );

        expect( mine.map( ( p ) => p.id ) ).toEqual( [
          "tagged",
          "kept",
          "sibling"
        ] );
        expect( others ).toBe( 2 );
        expect( HIDDEN_NOTE ).toMatch( /still take their slots/ );
        // The rhythm is untouched: it reads every post, whatever app made it.
        expect( plannedInstants( posts ) ).toHaveLength( 5 );
        expect( plannedInstants( mine ) ).toHaveLength( 3 );
      }
    );

    it(
      "knows nothing as its own with no tag and no kept id",
      () => {
        expect( sketchbookPosts(
          [
            post(
              "a",
              [],
              "g"
            )
          ],
          []
        ) ).toEqual( {
          mine: [],
          others: 1
        } );
      }
    );
  }
);
