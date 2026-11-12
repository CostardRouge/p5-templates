/**
 * One reading of a post for the Export dialog and the `publish.*` commands:
 * for each account, the variant it takes, as what, with which words, when,
 * and why it cannot go yet.
 */

import {
  planPost, plannedInstants, routeWords, type VariantSpan
} from "../plan";
import {
  DEFAULT_DRAFT, type PostDraft
} from "../publishStore";
import {
  DEFAULT_RHYTHM, slotLabel, zonedInstant
} from "../rhythm";
import type {
  PostizConnection
} from "../store";
import type {
  ExportVariant
} from "../../export/variants";

const tz = "Europe/Paris";
const now = new Date( "2026-11-10T20:30:00Z" );
const facts = {
  title: "Iridescent · Peaks shell",
  sketch: "iridescent-v7-peaks-shell",
  description: "A spiny seashell.",
  tags: "#3d",
  engine: "p5.js",
  seconds: "12",
  link: "p5.steeve.website/sketches/p5/iridescent/iridescent-v7-peaks-shell"
};
const channel = (
  id: string, identifier: string, name = id
) => ( {
  id,
  name,
  identifier,
  picture: null,
  disabled: false,
  handle: null
} );
const conn: PostizConnection = {
  apiBase: "https://p/api/public/v1",
  apiKey: "K",
  channels: [
    channel(
      "ig",
      "instagram",
      "Steeve Pommier"
    ),
    channel(
      "th",
      "threads",
      "costardrouge.jpg"
    ),
    channel(
      "x",
      "x",
      "Steeve on X"
    ),
    channel(
      "yt",
      "youtube",
      "Sketchbook"
    ),
    channel(
      "li",
      "linkedin"
    )
  ],
  defaultChannelIds: [
    "ig",
    "th",
    "x"
  ],
  collaborator: "",
  handles: {},
  usual: {},
  rhythm: DEFAULT_RHYTHM,
  connectedAt: 0
};
const variant = (
  id: string, patch: Partial<ExportVariant> = {}
): ExportVariant => ( {
  id,
  name: id,
  kind: "video",
  size: null,
  framerate: null,
  format: "mp4",
  frameCount: 10,
  slides: "current",
  delivery: "separate",
  sizeStrategy: "smallest",
  ...patch
} );
const variants: VariantSpan[] = [
  {
    variant: variant(
      "web",
      {
        format: "webm"
      }
    ),
    slideSpan: 1,
    size: {
      width: 1080,
      height: 1080
    }
  },
  {
    variant: variant( "reel" ),
    slideSpan: 1,
    size: {
      width: 1080,
      height: 1920
    }
  },
  {
    variant: variant(
      "square",
      {
        kind: "image"
      }
    ),
    slideSpan: 1,
    size: {
      width: 1080,
      height: 1080
    }
  }
];
const plan = (
  draft: Partial<PostDraft> = {}, extra: Partial<Parameters<typeof planPost>[ 0 ]> = {}
) => planPost( {
  conn,
  draft: {
    ...DEFAULT_DRAFT,
    ...draft
  },
  when: {
    kind: "next"
  },
  variants,
  facts,
  planned: [],
  now,
  ...extra
} );
const routeOf = (
  p: ReturnType<typeof plan>, id: string
) => p.routes.find( ( r ) => r.channel.id === id );

describe(
  "a post, account by account",
  () => {
    it(
      "gives each ticked account the variant its network takes — a picture on the short ones — on the next free slot",
      () => {
        const fridayTaken = zonedInstant(
          2026,
          11,
          13,
          19,
          0,
          tz
        );
        const p = plan(
          {},
          {
            planned: [
              fridayTaken
            ]
          }
        );

        expect( p.routes.map( ( r ) => [
          r.channel.id,
          r.variant.id,
          r.source
        ] ) ).toEqual( [
          [
            "ig",
            "reel",
            "first"
          ],
          [
            "th",
            "square",
            "first"
          ],
          [
            "x",
            "square",
            "first"
          ]
        ] );
        expect( routeOf(
          p,
          "ig"
        )?.kind ).toBe( "reel" );
        expect( routeOf(
          p,
          "x"
        )?.kind ).toBeNull();
        expect( slotLabel(
          p.at as Date,
          tz
        ) ).toBe( "Sun 15 Nov · 10:00" );
        expect( p.verb ).toBe( "Schedule · Sun 15 Nov · 10:00" );
        expect( p.accounts.find( ( a ) => a.channel.id === "li" )?.reason ).toMatch( /Instagram, TikTok, YouTube, Threads, X and Bluesky/ );
        expect( p.blocked ).toBeNull();
      }
    );

    it(
      "gives the short networks a picture and the others a video when nothing says otherwise, even over a default variant",
      () => {
        // The send of 2026-11-11: a default `variantId` from the one-variant
        // days gave X, Threads and Bluesky the mp4.
        const p = plan( {
          variantId: "reel"
        } );

        expect( p.routes.map( ( r ) => [
          r.channel.id,
          r.variant.id
        ] ) ).toEqual( [
          [
            "ig",
            "reel"
          ],
          [
            "th",
            "square"
          ],
          [
            "x",
            "square"
          ]
        ] );
      }
    );

    it(
      "routes the Reel to Instagram and the square picture to Threads and X, each rendered once",
      () => {
        const p = plan(
          {
            variantFor: {
              th: "square"
            }
          },
          {
            conn: {
              ...conn,
              usual: {
                x: "picture 1:1",
                ig: "video 9:16"
              }
            }
          }
        );

        expect( p.routes.map( ( r ) => [
          r.channel.id,
          r.variant.id,
          r.source,
          r.format
        ] ) ).toEqual( [
          [
            "ig",
            "reel",
            "usual",
            "video 9:16"
          ],
          [
            "th",
            "square",
            "picked",
            "picture 1:1"
          ],
          [
            "x",
            "square",
            "usual",
            "picture 1:1"
          ]
        ] );
        expect( p.variants.map( ( v ) => v.id ) ).toEqual( [
          "reel",
          "square"
        ] );
        expect( p.files ).toBe( 2 );
        expect( routeWords( routeOf(
          p,
          "x"
        )! ) ).toBe( "Picture · jpg" );
      }
    );

    it(
      "gives Instagram a story beside its post, and the short networks the short caption",
      () => {
        const p = plan( {
          storyToo: [
            "ig"
          ],
          shortCaption: "{title} {link}"
        } );

        expect( routeOf(
          p,
          "ig"
        )?.story ).toBe( true );
        expect( routeWords( routeOf(
          p,
          "ig"
        )! ) ).toBe( "Reel + Story · mp4" );
        expect( routeOf(
          p,
          "x"
        )?.short ).toBe( true );
        expect( p.caption ).toMatchObject( {
          used: true,
          limit: 2200
        } );
        expect( p.shortCaption ).toMatchObject( {
          used: true,
          limit: 280,
          text: "Iridescent · Peaks shell p5.steeve.website/sketches/p5/iridescent/iridescent-v7-peaks-shell"
        } );
      }
    );

    it(
      "refuses a short caption over X's 280, a past time, a missing YouTube title",
      () => {
        expect( plan( {
          shortCaption: "x".repeat( 300 )
        } ).blocked ).toMatch( /short caption is 300 characters — 280 at most for Threads, X/ );
        expect( plan(
          {},
          {
            when: {
              kind: "at",
              at: "2026-11-01T10:00:00Z",
              custom: true
            }
          }
        ).blocked ).toMatch( /past/ );
        expect( plan( {
          channelIds: [
            "yt"
          ],
          youtubeTitle: " "
        } ).blocked ).toMatch( /YouTube needs a title/ );
      }
    );

    it(
      "keeps YouTube out of a picture, and says when nothing can be posted",
      () => {
        const p = plan( {
          channelIds: [
            "ig",
            "yt"
          ],
          variantFor: {
            yt: "square",
            ig: "square"
          },
          kind: "reel"
        } );

        expect( routeOf(
          p,
          "ig"
        )?.kind ).toBe( "post" );
        expect( p.accounts.find( ( a ) => a.channel.id === "yt" )?.options.find( ( o ) => o.variant.id === "square" )?.reason ).toMatch( /one video/ );
        expect( routeOf(
          p,
          "yt"
        )?.variant.id ).toBe( "reel" );
        expect( plan(
          {},
          {
            variants: [
              variants[ 0 ]
            ]
          }
        ).blocked ).toMatch( /No variant can be posted/ );
      }
    );
  }
);

describe(
  "his other Instagram account as collaborator",
  () => {
    const two: PostizConnection = {
      ...conn,
      channels: [
        {
          ...channel(
            "motion",
            "instagram",
            "Steeve Pommier"
          ),
          handle: "steeve.motion"
        },
        channel(
          "photo",
          "instagram",
          "Steeve taking photos"
        )
      ],
      defaultChannelIds: [
        "motion"
      ]
    };

    it(
      "posts on one account alone by default, and offers the other to co-sign once its username is known",
      () => {
        const alone = plan(
          {},
          {
            conn: two
          }
        );

        expect( alone.targets.map( ( c ) => c.id ) ).toEqual( [
          "motion"
        ] );
        expect( alone.partners[ 0 ] ).toMatchObject( {
          handle: null,
          invited: false
        } );

        const cosigned = plan(
          {
            collabAccounts: [
              "photo"
            ]
          },
          {
            conn: {
              ...two,
              handles: {
                photo: "steeve.photos"
              }
            }
          }
        );

        expect( cosigned.collaborators ).toEqual( [
          "steeve.photos"
        ] );
        expect( cosigned.routes[ 0 ].choices.collaborators ).toEqual( [
          "steeve.photos"
        ] );
      }
    );

    it(
      "posts on each when both are ticked, and then offers no collaborator",
      () => {
        const p = plan(
          {
            channelIds: [
              "motion",
              "photo"
            ],
            collabAccounts: [
              "photo"
            ]
          },
          {
            conn: two
          }
        );

        expect( p.targets ).toHaveLength( 1 );
        expect( p.partners.map( ( x ) => x.channel.id ) ).toEqual( [
          "photo"
        ] );
      }
    );
  }
);

describe(
  "the posts that hold a slot",
  () => {
    it(
      "counts a post sent to several accounts once, and no draft nor failure",
      () => {
        const at = "2026-11-13T18:00:00.000Z";

        expect( plannedInstants( [
          {
            publishDate: at,
            state: "queue"
          },
          {
            publishDate: at,
            state: "queue"
          },
          {
            publishDate: "2026-11-14T10:00:00.000Z",
            state: "draft"
          },
          {
            publishDate: "2026-11-15T10:00:00.000Z",
            state: "error"
          }
        ] ).map( ( d ) => d.toISOString() ) ).toEqual( [
          at
        ] );
      }
    );
  }
);
