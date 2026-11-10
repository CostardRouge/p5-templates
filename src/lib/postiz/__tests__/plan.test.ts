/**
 * One reading of a post for the Export dialog and the `publish.*` commands:
 * which variant goes, to whom, as what, when, and why it cannot yet.
 */

import {
  planPost, plannedInstants
} from "../plan";
import {
  DEFAULT_DRAFT
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
const conn: PostizConnection = {
  apiBase: "https://p/api/public/v1",
  apiKey: "K",
  channels: [
    {
      id: "ig",
      name: "Steeve Pommier",
      identifier: "instagram",
      picture: null,
      disabled: false,
      handle: null
    },
    {
      id: "tt",
      name: "sketchbook",
      identifier: "tiktok",
      picture: null,
      disabled: false,
      handle: null
    },
    {
      id: "yt",
      name: "Sketchbook",
      identifier: "youtube",
      picture: null,
      disabled: false,
      handle: null
    }
  ],
  defaultChannelIds: [
    "ig",
    "yt"
  ],
  collaborator: "studio",
  handles: {},
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
const variants = [
  {
    variant: variant(
      "web",
      {
        format: "webm"
      }
    ),
    slideSpan: 1
  },
  {
    variant: variant( "reel" ),
    slideSpan: 1
  },
  {
    variant: variant(
      "still",
      {
        kind: "image"
      }
    ),
    slideSpan: 1
  }
];

describe(
  "a post, as the Export dialog and an agent read it",
  () => {
    it(
      "takes the first postable variant, the default accounts, the next free slot",
      () => {
        const fridayTaken = zonedInstant(
          2026,
          11,
          13,
          19,
          0,
          tz
        );
        const plan = planPost( {
          conn,
          draft: DEFAULT_DRAFT,
          when: {
            kind: "next"
          },
          variants,
          facts,
          planned: [
            fridayTaken
          ],
          now
        } );

        expect( plan.variant?.id ).toBe( "reel" );
        expect( plan.targets.map( ( c ) => c.id ) ).toEqual( [
          "ig",
          "yt"
        ] );
        expect( plan.kind ).toBe( "reel" );
        expect( slotLabel(
          plan.at as Date,
          tz
        ) ).toBe( "Sun 15 Nov · 10:00" );
        expect( plan.verb ).toBe( "Schedule · Sun 15 Nov · 10:00" );
        expect( plan.choices ).toMatchObject( {
          collaborators: [
            "studio"
          ],
          youtubeTitle: "Iridescent · Peaks shell"
        } );
        expect( plan.blocked ).toBeNull();
      }
    );

    it(
      "keeps YouTube out of a still, and says when nobody can take it",
      () => {
        const still = planPost( {
          conn,
          draft: {
            ...DEFAULT_DRAFT,
            variantId: "still",
            kind: "reel"
          },
          when: {
            kind: "draft"
          },
          variants,
          facts,
          planned: [],
          now
        } );

        expect( still.kind ).toBe( "post" );
        expect( still.targets.map( ( c ) => c.id ) ).toEqual( [
          "ig"
        ] );
        expect( still.accounts.find( ( a ) => a.channel.id === "yt" )?.reason ).toMatch( /one video/ );
        expect( still.verb ).toBe( "Send as a draft" );

        const nobody = planPost( {
          conn,
          draft: {
            ...DEFAULT_DRAFT,
            variantId: "still",
            channelIds: [
              "yt"
            ]
          },
          when: {
            kind: "next"
          },
          variants,
          facts,
          planned: [],
          now
        } );

        expect( nobody.blocked ).toMatch( /tick another/ );
      }
    );

    it(
      "refuses a past time, a caption too long for TikTok, a missing YouTube title",
      () => {
        const base = {
          conn,
          variants,
          facts,
          planned: [],
          now
        };

        expect( planPost( {
          ...base,
          draft: DEFAULT_DRAFT,
          when: {
            kind: "at",
            at: "2026-11-01T10:00:00Z",
            custom: true
          }
        } ).blocked ).toMatch( /past/ );
        expect( planPost( {
          ...base,
          draft: {
            ...DEFAULT_DRAFT,
            channelIds: [
              "ig",
              "tt"
            ],
            caption: "x".repeat( 2100 )
          },
          when: {
            kind: "now"
          }
        } ).blocked ).toMatch( /2,000 at most/ );
        expect( planPost( {
          ...base,
          draft: {
            ...DEFAULT_DRAFT,
            youtubeTitle: " "
          },
          when: {
            kind: "now"
          }
        } ).blocked ).toMatch( /YouTube needs a title/ );
      }
    );

    it(
      "says there is nothing to post when no variant can be",
      () => {
        expect( planPost( {
          conn,
          draft: DEFAULT_DRAFT,
          when: {
            kind: "next"
          },
          variants: [
            variants[ 0 ]
          ],
          facts,
          planned: [],
          now
        } ).blocked ).toMatch( /No variant can be posted/ );
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

describe(
  "his other Instagram account as collaborator",
  () => {
    const two: PostizConnection = {
      ...conn,
      channels: [
        {
          id: "motion",
          name: "Steeve Pommier",
          identifier: "instagram",
          picture: null,
          disabled: false,
          handle: "steeve.motion"
        },
        {
          id: "photo",
          name: "Steeve taking photos",
          identifier: "instagram",
          picture: null,
          disabled: false,
          handle: null
        }
      ],
      defaultChannelIds: [
        "motion"
      ],
      collaborator: "",
      handles: {}
    };
    const base = {
      when: {
        kind: "next" as const
      },
      variants,
      facts,
      planned: [],
      now
    };

    it(
      "posts on one account alone by default, and offers the other to co-sign",
      () => {
        const plan = planPost( {
          ...base,
          conn: two,
          draft: DEFAULT_DRAFT
        } );

        expect( plan.targets.map( ( c ) => c.id ) ).toEqual( [
          "motion"
        ] );
        expect( plan.partners ).toEqual( [
          {
            channel: two.channels[ 1 ],
            handle: null,
            invited: false
          }
        ] );
        expect( plan.collaborators ).toEqual( [] );
      }
    );

    it(
      "invites it once its username is known, into ONE post's settings",
      () => {
        const plan = planPost( {
          ...base,
          conn: {
            ...two,
            handles: {
              photo: "steeve.photos"
            }
          },
          draft: {
            ...DEFAULT_DRAFT,
            collabAccounts: [
              "photo"
            ]
          }
        } );

        expect( plan.collaborators ).toEqual( [
          "steeve.photos"
        ] );
        expect( plan.choices?.collaborators ).toEqual( [
          "steeve.photos"
        ] );
        expect( plan.targets ).toHaveLength( 1 );
      }
    );

    it(
      "posts on each when both are ticked, and then offers no collaborator",
      () => {
        const plan = planPost( {
          ...base,
          conn: two,
          draft: {
            ...DEFAULT_DRAFT,
            channelIds: [
              "motion",
              "photo"
            ],
            collabAccounts: [
              "photo"
            ]
          }
        } );

        expect( plan.targets ).toHaveLength( 2 );
        expect( plan.partners ).toEqual( [] );
        expect( plan.collaborators ).toEqual( [] );
      }
    );
  }
);
