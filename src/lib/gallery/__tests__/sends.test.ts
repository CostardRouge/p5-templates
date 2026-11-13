/**
 * What each piece became: local sends matched to Postiz's listing and tied to
 * the piece they left from.
 */

import {
  buildSends, failedAccounts, filterCounts, pieceFilterOf, pieceOfPublication, sendLine, sendsByPiece, sendState
} from "../sends";
import {
  galleryPrefsValue, readGalleryPrefs
} from "../view";
import type {
  PostizChannel, PostizPost
} from "@/lib/postiz/client";
import type {
  Publication
} from "@/lib/postiz/publishStore";
import type {
  GalleryEntry
} from "../types";

const TZ = "Europe/Paris";
const NOW = Date.parse( "2026-11-13T11:00:00Z" );

const entry = (
  id: string, name: string, at: string
): GalleryEntry => ( {
  id,
  at: Date.parse( at ),
  sketch: `p5/materials/${ name }`,
  engine: "p5",
  name,
  title: "",
  origin: "export",
  options: {},
  fingerprint: id,
  hadAssets: false,
  width: 1080,
  height: 1350,
  thumbnail: null
} );

const channels: PostizChannel[] = [
  {
    id: "ig",
    name: "Steeve Pommier",
    identifier: "instagram-standalone",
    picture: null,
    disabled: false,
    handle: null
  },
  {
    id: "x",
    name: "Steeve Pommier",
    identifier: "x",
    picture: null,
    disabled: false,
    handle: null
  },
  {
    id: "bsky",
    name: "Steeve Pommier",
    identifier: "bluesky",
    picture: null,
    disabled: false,
    handle: null
  }
];

const post = (
  id: string, channel: string, state: PostizPost[ "state" ], extra: Partial<PostizPost> = {}
): PostizPost => ( {
  id,
  group: "g1",
  tags: [
    "Sketchbook"
  ],
  content: "",
  publishDate: "2026-11-11T21:01:00Z",
  state,
  releaseURL: state === "published" ? `https://example.net/${ id }` : null,
  error: null,
  channel: {
    id: channel,
    name: "Steeve Pommier",
    identifier: channels.find( ( c ) => c.id === channel )?.identifier ?? "",
    picture: null
  },
  ...extra
} );

const sent: Publication = {
  postIds: [
    "p1",
    "p2",
    "p3"
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
    }
  ],
  channelIds: [
    "ig",
    "x",
    "bsky"
  ],
  kind: "reel",
  variantName: "Reel",
  files: 1,
  at: "2026-11-11T21:01:00Z",
  target: "schedule",
  sentAt: Date.parse( "2026-11-11T20:00:00Z" ),
  pieceId: "iri-2"
};

const entries = [
  entry(
    "iri-1",
    "iridescent-v7-peaks-shell",
    "2026-11-09T10:00:00Z"
  ),
  entry(
    "iri-2",
    "iridescent-v7-peaks-shell",
    "2026-11-11T19:59:00Z"
  ),
  entry(
    "ice",
    "materials-v5-ice",
    "2026-11-12T10:00:00Z"
  )
];

describe(
  "pieceOfPublication",
  () => {
    it(
      "takes the piece the send recorded",
      () => {
        expect( pieceOfPublication(
          sent,
          "p5/iridescent-v7-peaks-shell",
          entries
        ) ).toBe( "iri-2" );
      }
    );

    it(
      "falls back to the newest piece of the sketch kept before the send",
      () => {
        const older = {
          ...sent,
          pieceId: undefined,
          sentAt: Date.parse( "2026-11-10T12:00:00Z" )
        };

        expect( pieceOfPublication(
          older,
          "p5/iridescent-v7-peaks-shell",
          entries
        ) ).toBe( "iri-1" );
        expect( pieceOfPublication(
          {
            ...older,
            pieceId: "deleted"
          },
          "p5/materials-v6-lava",
          entries
        ) ).toBeNull();
      }
    );
  }
);

describe(
  "buildSends",
  () => {
    const listed = [
      post(
        "p1",
        "ig",
        "published"
      ),
      post(
        "p2",
        "x",
        "published"
      ),
      post(
        "p3",
        "bsky",
        "error",
        {
          error: "Could not prepare the post for Bluesky, nothing was published: missing jobId"
        }
      )
    ];

    it(
      "reads each account's state, link and error from Postiz",
      () => {
        const [
          send
        ] = buildSends( {
          publications: [
            {
              key: "p5/iridescent-v7-peaks-shell",
              publication: sent
            }
          ],
          posts: listed,
          channels,
          entries,
          now: NOW
        } );

        expect( send.pieceId ).toBe( "iri-2" );
        expect( send.accounts.map( ( a ) => [
          a.provider,
          a.state,
          a.url
        ] ) ).toEqual( [
          [
            "instagram",
            "published",
            "https://example.net/p1"
          ],
          [
            "x",
            "published",
            "https://example.net/p2"
          ],
          [
            "bluesky",
            "error",
            null
          ]
        ] );
        expect( sendState( send ) ).toBe( "failed" );
        expect( failedAccounts( send ).map( ( a ) => a.channelId ) ).toEqual( [
          "bsky"
        ] );
        expect( sendLine(
          send,
          TZ,
          NOW
        ) ).toBe( "Bluesky failed · 2 out" );
      }
    );

    it(
      "says nothing it does not know when Postiz was not read",
      () => {
        const [
          planned,
          past
        ] = buildSends( {
          publications: [
            {
              key: "p5/materials-v5-ice",
              publication: {
                ...sent,
                pieceId: "ice",
                at: "2026-11-15T09:00:00Z"
              }
            },
            {
              key: "p5/iridescent-v7-peaks-shell",
              publication: sent
            }
          ],
          posts: null,
          channels,
          entries,
          now: NOW
        } );

        expect( sendState( planned ) ).toBe( "planned" );
        expect( sendLine(
          planned,
          TZ,
          NOW
        ) ).toBe( "Planned · Sun 10:00" );
        expect( sendState( past ) ).toBe( "unknown" );
        expect( sendLine(
          past,
          TZ,
          NOW
        ) ).toBe( "Sent · 11 Nov" );
      }
    );

    it(
      "follows Postiz's date when the post was moved there",
      () => {
        const [
          send
        ] = buildSends( {
          publications: [
            {
              key: "p5/iridescent-v7-peaks-shell",
              publication: sent
            }
          ],
          posts: listed.map( ( p ) => ( {
            ...p,
            publishDate: "2026-11-12T08:00:00Z"
          } ) ),
          channels,
          entries,
          now: NOW
        } );

        expect( new Date( send.at ).toISOString() ).toBe( "2026-11-12T08:00:00.000Z" );
      }
    );

    it(
      "counts the chips by each piece's newest send",
      () => {
        const sends = buildSends( {
          publications: [
            {
              key: "p5/iridescent-v7-peaks-shell",
              publication: sent
            }
          ],
          posts: listed.map( ( p ) => ( {
            ...p,
            state: "published" as const,
            error: null
          } ) ),
          channels,
          entries,
          now: NOW
        } );
        const byPiece = sendsByPiece( sends );

        expect( sendLine(
          sends[ 0 ],
          TZ,
          NOW
        ) ).toBe( "Posted on 3 · 11 Nov" );
        expect( pieceFilterOf( byPiece.get( "iri-2" ) ) ).toBe( "published" );
        expect( filterCounts(
          entries.map( ( e ) => e.id ),
          byPiece
        ) ).toEqual( {
          all: 3,
          planned: 0,
          published: 1,
          failed: 0,
          none: 2
        } );
      }
    );
  }
);

describe(
  "the view cookie",
  () => {
    it(
      "round-trips and refuses what it does not know",
      () => {
        expect( readGalleryPrefs( galleryPrefsValue( {
          view: "week",
          timeZone: "America/New_York"
        } ) ) ).toEqual( {
          view: "week",
          timeZone: "America/New_York"
        } );
        expect( readGalleryPrefs( undefined ) ).toEqual( {
          view: "month",
          timeZone: "Europe/Paris"
        } );
        expect( readGalleryPrefs( "table~Mars/Olympus" ) ).toEqual( {
          view: "month",
          timeZone: "Europe/Paris"
        } );
        expect( readGalleryPrefs( "%E0%A4%A" ).view ).toBe( "month" );
      }
    );
  }
);
