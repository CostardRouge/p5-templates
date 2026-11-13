/**
 * What became of a send, account by account, from what Postiz lists.
 */

import {
  failedChannels, mergeResend, outcomeWindow, publishedPosts, readOutcomes, stillMoving
} from "../outcome";
import type {
  PostizPost
} from "../client";
import type {
  Publication
} from "../publishStore";

const publication: Publication = {
  postIds: [
    "p1",
    "p2",
    "p3",
    "s1"
  ],
  posts: [
    {
      postId: "p1",
      channelId: "ig",
      story: false
    },
    {
      postId: "p2",
      channelId: "x",
      story: false
    },
    {
      postId: "p3",
      channelId: "bsky",
      story: false
    },
    {
      postId: "s1",
      channelId: "ig",
      story: true
    }
  ],
  channelIds: [
    "ig",
    "x",
    "bsky"
  ],
  kind: "reel",
  variantName: "Reel + Square",
  files: 2,
  at: "2026-11-11T21:01:00.000Z",
  target: "now",
  sentAt: Date.parse( "2026-11-11T21:01:00.000Z" )
};
const listed = (
  id: string, state: PostizPost[ "state" ], error: string | null = null, url: string | null = null
): PostizPost => ( {
  id,
  group: "g",
  tags: [],
  content: "",
  publishDate: "2026-11-11T21:01:00.000Z",
  state,
  releaseURL: url,
  error,
  channel: null
} );

describe(
  "a send's outcome",
  () => {
    it(
      "reads each account's state, error and live link from Postiz's listing",
      () => {
        const outcomes = readOutcomes(
          publication,
          [
            listed(
              "p1",
              "published",
              null,
              "https://instagram.com/p/1"
            ),
            listed(
              "p2",
              "error"
            ),
            listed(
              "p3",
              "error",
              "Could not prepare the post for Bluesky, nothing was published: missing jobId"
            )
          ]
        );

        expect( outcomes.map( ( o ) => [
          o.channelId,
          o.state,
          o.url
        ] ) ).toEqual( [
          [
            "ig",
            "published",
            "https://instagram.com/p/1"
          ],
          [
            "x",
            "error",
            null
          ],
          [
            "bsky",
            "error",
            null
          ],
          [
            "ig",
            "unknown",
            null
          ]
        ] );
        expect( failedChannels( outcomes ) ).toEqual( [
          "x",
          "bsky"
        ] );
        // The story is not listed yet: still moving.
        expect( stillMoving( outcomes ) ).toBe( true );
      }
    );

    it(
      "leaves an account whose story alone failed out of what Send again resends",
      () => {
        const outcomes = readOutcomes(
          publication,
          [
            listed(
              "p1",
              "published"
            ),
            listed(
              "s1",
              "error"
            )
          ]
        );

        expect( failedChannels( outcomes ) ).toEqual( [] );
      }
    );

    it(
      "guesses which post is whose by order for a send recorded before the map existed",
      () => {
        const old: Publication = {
          ...publication,
          posts: undefined,
          postIds: [
            "p1",
            "p2"
          ],
          channelIds: [
            "ig",
            "x"
          ]
        };

        expect( publishedPosts( old ).map( ( p ) => p.channelId ) ).toEqual( [
          "ig",
          "x"
        ] );
      }
    );

    it(
      "lists a day each side of when it goes out",
      () => {
        const w = outcomeWindow( publication );

        expect( w.from.toISOString() ).toBe( "2026-11-10T21:01:00.000Z" );
        expect( w.to.toISOString() ).toBe( "2026-11-12T21:01:00.000Z" );
      }
    );

    it(
      "replaces the failed accounts' posts with the ones sent again",
      () => {
        const resent: Publication = {
          ...publication,
          postIds: [
            "n1"
          ],
          posts: [
            {
              postId: "n1",
              channelId: "bsky",
              story: false
            }
          ],
          channelIds: [
            "bsky"
          ]
        };
        const merged = mergeResend(
          publication,
          [
            "bsky"
          ],
          resent
        );

        expect( merged.postIds ).toEqual( [
          "p1",
          "p2",
          "s1",
          "n1"
        ] );
        expect( merged.channelIds ).toEqual( [
          "ig",
          "x",
          "bsky"
        ] );
      }
    );
  }
);
