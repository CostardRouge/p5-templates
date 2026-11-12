/**
 * @jest-environment jsdom
 */

/**
 * What Sketchbook adds to Atelier's Postiz client: one post to several
 * accounts (Instagram, TikTok, YouTube) with each network's own settings,
 * what a variant can be posted as before it renders, the caption's words, the
 * kept connection and the per-sketch post.
 */

import {
  PostizClient, channelProblem, channelSettings, postBody, providerOf, readChannels
} from "../client";
import {
  fitKind, kindWhy, postShape, providerFits
} from "../postShape";
import {
  DEFAULT_CAPTION, captionLimit, fillCaption, hashtags, sketchTitle, type CaptionFacts
} from "../caption";
import {
  forgetPostiz, getPostiz, initialDefaults, putPostiz, resetPostizCache, updatePostiz
} from "../store";
import {
  DEFAULT_RHYTHM
} from "../rhythm";
import {
  addPublication, dropPublication, getDraft, getPublications, patchDraft, readDraft, resetPublishStore
} from "../publishStore";
import {
  jpegName, mimeOf, routesProblem, sendRoutes
} from "../send";

const json = (
  status: number, body: unknown
) => ( {
  ok: status >= 200 && status < 300,
  status,
  text: async() => JSON.stringify( body )
} as unknown as Response );

const IG = {
  id: "ig",
  name: "Steeve Pommier",
  identifier: "instagram",
  picture: null,
  disabled: false,
  handle: null
};
const TT = {
  id: "tt",
  name: "sketchbook",
  identifier: "tiktok",
  picture: null,
  disabled: false,
  handle: null
};
const YT = {
  id: "yt",
  name: "Sketchbook",
  identifier: "youtube",
  picture: null,
  disabled: false,
  handle: null
};

describe(
  "one post, several accounts",
  () => {
    it(
      "names the network from the account's identifier",
      () => {
        expect( providerOf( "instagram-standalone" ) ).toBe( "instagram" );
        expect( providerOf( "tiktok-business" ) ).toBe( "tiktok" );
        expect( providerOf( "youtube" ) ).toBe( "youtube" );
        expect( providerOf( "linkedin" ) ).toBe( "other" );
        expect( readChannels( [
          {
            id: "a",
            name: "A",
            platform: "instagram"
          }
        ] )[ 0 ].identifier ).toBe( "instagram" );
      }
    );

    it(
      "gives every account its entry, with the settings its network requires",
      () => {
        const body = postBody( {
          entries: [
            IG,
            TT,
            YT
          ].map( ( channel ) => ( {
            channel,
            choices: {
              kind: "reel",
              tiktokPrivacy: "SELF_ONLY",
              youtubeTitle: "  Iridescent · Peaks shell ",
              youtubeVisibility: "unlisted"
            },
            caption: "A shell",
            media: [
              {
                id: "m",
                path: "https://p/u/a.mp4"
              }
            ],
            video: true
          } ) ),
          at: new Date( "2026-11-15T09:00:00Z" )
        } );
        const posts = body.posts as { integration: { id: string };
          settings: Record<string, unknown> }[];

        expect( posts.map( ( p ) => p.integration.id ) ).toEqual( [
          "ig",
          "tt",
          "yt"
        ] );
        expect( posts[ 1 ].settings ).toEqual( {
          __type: "tiktok",
          privacy_level: "SELF_ONLY",
          duet: false,
          stitch: false,
          comment: true,
          autoAddMusic: "no",
          brand_content_toggle: false,
          brand_organic_toggle: false,
          content_posting_method: "DIRECT_POST",
          video_made_with_ai: false
        } );
        expect( posts[ 2 ].settings ).toEqual( {
          __type: "youtube",
          title: "Iridescent · Peaks shell",
          type: "unlisted"
        } );
        // TikTok pictures carry no video-only setting.
        expect( channelSettings(
          TT,
          {
            kind: "carousel"
          },
          false
        ) ).not.toHaveProperty( "video_made_with_ai" );
      }
    );

    it(
      "says which network cannot take which files",
      () => {
        const video = [
          {
            type: "video/mp4"
          }
        ];
        const pictures = [
          {
            type: "image/jpeg"
          },
          {
            type: "image/jpeg"
          }
        ];

        expect( channelProblem(
          "youtube",
          pictures
        ) ).toMatch( /one video/ );
        expect( channelProblem(
          "youtube",
          video
        ) ).toBeNull();
        expect( channelProblem(
          "tiktok",
          pictures
        ) ).toBeNull();
        expect( channelProblem(
          "tiktok",
          [
            ...video,
            ...video
          ]
        ) ).toMatch( /one video/ );
      }
    );
  }
);

describe(
  "what a variant can be posted as, before it renders",
  () => {
    const variant = {
      kind: "video" as const,
      format: "mp4" as const,
      delivery: "separate" as const,
      frameCount: 10 as number | "all"
    };

    it(
      "reads a single mp4 as a Reel first, a webm as nothing",
      () => {
        expect( postShape(
          variant,
          1
        ) ).toEqual( {
          files: 1,
          media: "video",
          kinds: [
            "reel",
            "post",
            "story"
          ],
          reason: null
        } );
        expect( postShape(
          {
            ...variant,
            format: "webm"
          },
          1
        ).reason ).toMatch( /mp4, not webm/ );
        expect( postShape(
          {
            ...variant,
            delivery: "combined"
          },
          4
        ).files ).toBe( 1 );
      }
    );

    it(
      "makes several files a carousel, and more than ten nothing",
      () => {
        expect( postShape(
          variant,
          4
        ).kinds ).toEqual( [
          "carousel"
        ] );
        expect( postShape(
          {
            ...variant,
            kind: "image"
          },
          1
        ).kinds ).toEqual( [
          "post",
          "story"
        ] );
        expect( postShape(
          {
            ...variant,
            kind: "frames",
            frameCount: 4
          },
          3
        ).reason ).toMatch( /12 files/ );
        expect( postShape(
          {
            ...variant,
            kind: "frames",
            frameCount: "all"
          },
          1
        ).files ).toBeNull();
      }
    );

    it(
      "keeps the kind asked when it still fits, and says why another does not",
      () => {
        const still = postShape(
          {
            ...variant,
            kind: "image"
          },
          1
        );

        expect( fitKind(
          "reel",
          still
        ) ).toBe( "post" );
        expect( fitKind(
          "story",
          still
        ) ).toBe( "story" );
        expect( kindWhy(
          "reel",
          still
        ) ).toMatch( /one video/ );
        expect( providerFits(
          "youtube",
          still
        ) ).toMatch( /one video/ );
        expect( providerFits(
          "tiktok",
          still
        ) ).toBeNull();
      }
    );
  }
);

describe(
  "the caption",
  () => {
    const facts: CaptionFacts = {
      title: "Iridescent · Peaks shell",
      sketch: "iridescent-v7-peaks-shell",
      description: "A spiny seashell.",
      tags: "#3d #mesh",
      engine: "p5.js",
      seconds: "12",
      link: "p5.steeve.website/sketches/p5/iridescent/iridescent-v7-peaks-shell"
    };

    it(
      "fills Sketchbook's own template, an unknown token left as typed",
      () => {
        expect( fillCaption(
          DEFAULT_CAPTION,
          facts
        ) ).toBe( "Iridescent · Peaks shell\nA spiny seashell.\n\np5.js · a 12 s loop · p5.steeve.website/sketches/p5/iridescent/iridescent-v7-peaks-shell\n#3d #mesh #generativeart #creativecoding" );
        expect( fillCaption(
          "{title} {nope}\n\n\n\n{tags}",
          facts
        ) ).toBe( "Iridescent · Peaks shell {nope}\n\n#3d #mesh" );
      }
    );

    it(
      "names a sketch and its tags for a person",
      () => {
        expect( sketchTitle(
          "iridescent-v7-peaks-shell",
          "iridescent"
        ) ).toBe( "Iridescent · Peaks shell" );
        expect( sketchTitle( "voronoi-v1-cells" ) ).toBe( "Voronoi cells" );
        expect( sketchTitle(
          "flame",
          "materials"
        ) ).toBe( "Materials · Flame" );
        expect( hashtags( [
          "3d",
          "Generative Art",
          "3D",
          "noise-field"
        ] ) ).toBe( "#3d #generativeart #noisefield" );
      }
    );

    it(
      "holds to the shortest limit of the accounts ticked",
      () => {
        expect( captionLimit( [
          "instagram"
        ] ) ).toBe( 2200 );
        expect( captionLimit( [
          "instagram",
          "tiktok"
        ] ) ).toBe( 2000 );
        expect( captionLimit( [] ) ).toBe( 2200 );
      }
    );
  }
);

describe(
  "what this browser keeps",
  () => {
    beforeEach( () => {
      localStorage.clear();
      resetPostizCache();
      resetPublishStore();
    } );

    it(
      "keeps one Postiz, its accounts and rhythm, and forgets it whole",
      () => {
        putPostiz( {
          apiBase: "https://postiz.example/api/public/v1",
          apiKey: "KEY",
          channels: [
            IG,
            TT
          ],
          defaultChannelIds: [
            "ig",
            "gone"
          ],
          collaborator: "@studio",
          handles: {},
          usual: {},
          rhythm: DEFAULT_RHYTHM,
          connectedAt: 1
        } );
        resetPostizCache();
        expect( getPostiz() ).toMatchObject( {
          apiKey: "KEY",
          defaultChannelIds: [
            "ig"
          ],
          collaborator: "studio"
        } );
        updatePostiz( {
          defaultChannelIds: [
            "ig",
            "tt"
          ]
        } );
        expect( getPostiz()?.defaultChannelIds ).toEqual( [
          "ig",
          "tt"
        ] );
        forgetPostiz();
        resetPostizCache();
        expect( getPostiz() ).toBeNull();
      }
    );

    it(
      "ticks the only Instagram account at first, none when there are several",
      () => {
        expect( initialDefaults( [
          IG,
          TT
        ] ) ).toEqual( [
          "ig"
        ] );
        expect( initialDefaults( [
          IG,
          {
            ...IG,
            id: "ig2"
          }
        ] ) ).toEqual( [] );
      }
    );

    it(
      "keeps a sketch's post, and new words take the approval back",
      () => {
        patchDraft(
          "p5/voronoi",
          {
            caption: "Hello",
            approved: true
          }
        );
        expect( getDraft( "p5/voronoi" ) ).toMatchObject( {
          caption: "Hello",
          approved: true
        } );
        patchDraft(
          "p5/voronoi",
          {
            caption: "Hello there"
          }
        );
        expect( getDraft( "p5/voronoi" ).approved ).toBe( false );
        patchDraft(
          "p5/voronoi",
          {
            trial: true
          }
        );
        resetPublishStore();
        expect( getDraft( "p5/voronoi" ) ).toMatchObject( {
          caption: "Hello there",
          trial: true,
          approved: false
        } );
        expect( readDraft( {
          mode: "nope",
          kind: "tweet"
        } ) ).toMatchObject( {
          mode: "publish",
          kind: null
        } );
      }
    );

    it(
      "remembers what a sketch sent, and forgets a post taken back",
      () => {
        addPublication(
          "k",
          {
            postIds: [
              "p1",
              "p2"
            ],
            channelIds: [
              "ig",
              "tt"
            ],
            kind: "reel",
            variantName: "Reel",
            files: 1,
            at: null,
            target: "draft",
            sentAt: 1
          }
        );
        expect( getPublications( "k" ) ).toHaveLength( 1 );
        dropPublication(
          "k",
          "p2"
        );
        expect( getPublications( "k" ) ).toHaveLength( 0 );
      }
    );
  }
);

describe(
  "sending",
  () => {
    it(
      "names the JPEG and reads a type from a file name",
      () => {
        expect( jpegName( "loop-1080x1350.png" ) ).toBe( "loop-1080x1350.jpg" );
        expect( jpegName( "loop" ) ).toBe( "loop.jpg" );
        expect( mimeOf( "a.mp4" ) ).toBe( "video/mp4" );
        expect( mimeOf(
          "a.bin",
          "image/png"
        ) ).toBe( "image/png" );
      }
    );

    it(
      "refuses before a byte leaves, account by account",
      () => {
        const mp4 = {
          type: "video/mp4",
          size: 1000,
          name: "a.mp4"
        };
        const jpg = {
          type: "image/jpeg",
          size: 1000,
          name: "a.jpg"
        };
        const route = (
          channel: typeof IG, id: string, kind: "reel" | "post" | null
        ) => ( {
          channel,
          provider: providerOf( channel.identifier ),
          kind,
          variant: {
            id
          } as never
        } );
        const files = new Map( [
          [
            "reel",
            [
              mp4
            ]
          ],
          [
            "square",
            [
              jpg
            ]
          ]
        ] );

        expect( routesProblem(
          [],
          files
        ) ).toMatch( /Tick an account/ );
        expect( routesProblem(
          [
            route(
              IG,
              "square",
              "reel"
            )
          ],
          files
        ) ).toMatch( /Steeve Pommier: A Reel is one video/ );
        expect( routesProblem(
          [
            route(
              YT,
              "square",
              null
            )
          ],
          files
        ) ).toMatch( /^Sketchbook: YouTube takes one video/ );
        expect( routesProblem(
          [
            route(
              IG,
              "reel",
              "reel"
            ),
            route(
              TT,
              "square",
              null
            )
          ],
          files
        ) ).toBeNull();
        expect( routesProblem(
          [
            route(
              IG,
              "reel",
              "reel"
            )
          ],
          new Map( [
            [
              "reel",
              [
                {
                  ...mp4,
                  size: 200 * 1024 * 1024
                }
              ]
            ]
          ] )
        ) ).toMatch( /95 MB/ );
      }
    );

    it(
      "uploads each variant once, one post with each account's files and words, and the story beside it",
      async() => {
        const seen: string[] = [];
        const bodies: { posts: { integration: { id: string };
          value: { content: string;
            image: { id: string }[] }[];
          settings: Record<string, unknown> }[] }[] = [];
        const client = new PostizClient(
          "https://p/api/public/v1",
          "KEY",
          async(
            url, init
          ) => {
            seen.push( `${ init?.method ?? "GET" } ${ url.replace(
              "https://p/api/public/v1",
              ""
            ) }` );

            if ( url.endsWith( "/upload" ) ) {
              return json(
                200,
                {
                  id: `m${ seen.length }`,
                  path: "https://p/u/x"
                }
              );
            }

            const body = JSON.parse( String( init?.body ) );

            bodies.push( body );

            return json(
              200,
              body.posts.map( (
                _: unknown, i: number
              ) => ( {
                postId: `post${ bodies.length }-${ i }`
              } ) )
            );
          }
        );
        const reel = new File(
          [
            "x"
          ],
          "a.mp4",
          {
            type: "video/mp4"
          }
        );
        const square = new File(
          [
            "y"
          ],
          "b.jpg",
          {
            type: "image/jpeg"
          }
        );
        const route = (
          channel: typeof IG, variant: string, kind: "reel" | null, story = false
        ) => ( {
          channel,
          provider: providerOf( channel.identifier ),
          variant: {
            id: variant,
            name: variant === "reel" ? "Instagram Reel" : "Square still"
          } as never,
          shape: {
            files: 1,
            media: variant === "reel" ? "video" : "image",
            kinds: [],
            reason: null
          } as never,
          format: "",
          source: "first" as const,
          kind,
          story,
          short: providerOf( channel.identifier ) === "x",
          choices: {
            kind: kind ?? ( "post" as const )
          }
        } );
        const X = {
          ...IG,
          id: "x",
          name: "Steeve on X",
          identifier: "x"
        };
        const files: number[] = [];
        const publication = await sendRoutes( {
          client,
          routes: [
            route(
              IG,
              "reel",
              "reel",
              true
            ),
            route(
              X,
              "square",
              null
            )
          ],
          files: new Map( [
            [
              "reel",
              [
                reel
              ]
            ],
            [
              "square",
              [
                square
              ]
            ]
          ] ),
          caption: "The long one",
          shortCaption: "Short",
          at: new Date( "2026-11-15T09:00:00Z" ),
          onFile: ( n ) => files.push( n )
        } );

        expect( seen ).toEqual( [
          "POST /upload",
          "POST /upload",
          "POST /posts",
          "POST /posts"
        ] );
        expect( files ).toEqual( [
          1,
          2
        ] );
        expect( bodies[ 0 ].posts.map( ( p ) => [
          p.integration.id,
          p.value[ 0 ].content,
          p.value[ 0 ].image[ 0 ].id
        ] ) ).toEqual( [
          [
            "ig",
            "The long one",
            "m1"
          ],
          [
            "x",
            "Short",
            "m2"
          ]
        ] );
        expect( bodies[ 0 ].posts[ 1 ].settings ).toEqual( {
          __type: "x",
          post_type: "post",
          who_can_reply_post: "everyone",
          made_with_ai: false
        } );
        expect( bodies[ 1 ].posts ).toHaveLength( 1 );
        expect( bodies[ 1 ].posts[ 0 ].settings ).toMatchObject( {
          post_type: "story"
        } );
        expect( publication ).toMatchObject( {
          postIds: [
            "post1-0",
            "post1-1",
            "post2-0"
          ],
          channelIds: [
            "ig",
            "x"
          ],
          variantName: "Instagram Reel + Square still",
          files: 2,
          target: "schedule"
        } );
        // Which post is which account's, for the Sent screen's states.
        expect( publication.posts ).toEqual( [
          {
            postId: "post1-0",
            channelId: "ig",
            story: false
          },
          {
            postId: "post1-1",
            channelId: "x",
            story: false
          },
          {
            postId: "post2-0",
            channelId: "ig",
            story: true
          }
        ] );
      }
    );
  }
);
