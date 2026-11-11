import {
  createCommandRegistry
} from "../../../../scripts/mcp/registry.ts";
import {
  publishCommands
} from "../commands/publishCommands";
import {
  exportCommands
} from "../commands/exportCommands";
import {
  PostizClient
} from "../../postiz/client";
import {
  resetPublishStore
} from "../../postiz/publishStore";
import {
  DEFAULT_RHYTHM
} from "../../postiz/rhythm";
import type {
  PostizConnection
} from "../../postiz/store";
import {
  fakeHandles
} from "./fakeHandles";

const conn: PostizConnection = {
  apiBase: "https://postiz.example/api/public/v1",
  apiKey: "KEY",
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
      id: "yt",
      name: "Sketchbook",
      identifier: "youtube",
      picture: null,
      disabled: false,
      handle: null
    }
  ],
  defaultChannelIds: [
    "ig"
  ],
  collaborator: "",
  handles: {},
  usual: {},
  rhythm: DEFAULT_RHYTHM,
  connectedAt: 0
};

const response = (
  status: number, body: unknown
) => ( {
  ok: status < 300,
  status,
  text: async() => JSON.stringify( body )
} as unknown as Response );

function setup( withPostiz = true ) {
  const calls: string[] = [];
  const posts: unknown[] = [];
  const client = new PostizClient(
    conn.apiBase,
    conn.apiKey,
    async(
      url, init
    ) => {
      const path = url.replace(
        conn.apiBase,
        ""
      );

      calls.push( `${ init?.method ?? "GET" } ${ path.split( "?" )[ 0 ] }` );

      if ( path === "/upload" ) {
        return response(
          200,
          {
            id: "m1",
            path: "https://p/u/x"
          }
        );
      }

      if ( path === "/posts" && init?.method === "POST" ) {
        const body = JSON.parse( String( init.body ) ) as { posts: unknown[];
          type: string };

        posts.push( body );

        return response(
          200,
          body.posts.map( (
            _, i
          ) => ( {
            postId: `p${ i }`
          } ) )
        );
      }

      if ( path.startsWith( "/posts?" ) ) {
        return response(
          200,
          {
            posts: [
              {
                id: "old",
                publishDate: "2020-01-01T10:00:00Z",
                state: "PUBLISHED",
                content: "<p>Done</p>"
              }
            ]
          }
        );
      }

      return response(
        200,
        {
          deleted: true
        }
      );
    }
  );
  const fake = fakeHandles(
    {},
    {}
  );

  fake.handles.publish = {
    ...fake.handles.publish,
    connection: () => withPostiz ? conn : null,
    client: () => withPostiz ? client : null
  };

  const registry = createCommandRegistry();

  registry.register( exportCommands( fake.handles ) );
  registry.register( publishCommands( fake.handles ) );

  return {
    registry,
    calls,
    posts
  };
}

describe(
  "publish commands",
  () => {
    beforeEach( () => resetPublishStore() );

    it(
      "say plainly when no Postiz is connected",
      async() => {
        const {
          registry
        } = setup( false );

        await expect( registry.execute(
          "publish.status",
          {}
        ) ).rejects.toMatchObject( {
          message: expect.stringMatching( /Menu › Publishing/ )
        } );
      }
    );

    it(
      "compose a post, refusing a kind the variant cannot be and an unknown account",
      async() => {
        const {
          registry
        } = setup();
        const still = await registry.execute(
          "export.add",
          {
            preset: "still"
          }
        ) as { id: string };

        await expect( registry.execute(
          "publish.compose",
          {
            variant: still.id,
            kind: "reel"
          }
        ) ).rejects.toMatchObject( {
          message: expect.stringMatching( /cannot be a Reel — it can be Post, Story/ )
        } );
        await expect( registry.execute(
          "publish.compose",
          {
            accounts: [
              "tt"
            ]
          }
        ) ).rejects.toMatchObject( {
          message: expect.stringMatching( /no account tt/ )
        } );

        const post = await registry.execute(
          "publish.compose",
          {
            variant: still.id,
            kind: "story",
            accounts: [
              "ig",
              "yt"
            ],
            when: "draft"
          }
        ) as { accounts: { id: string;
          refused?: string;
          sends?: { instagramKind?: string;
            variant: string } }[];
        verb: string };
        const ig = post.accounts.find( ( a ) => a.id === "ig" );

        expect( ig?.sends ).toMatchObject( {
          instagramKind: "Story",
          variant: still.id
        } );
        expect( post.accounts.find( ( a ) => a.id === "yt" )?.refused ).toMatch( /one video/ );
        await expect( registry.execute(
          "publish.compose",
          {
            routes: {
              ig: "nope"
            }
          }
        ) ).rejects.toMatchObject( {
          message: expect.stringMatching( /no variant "nope"/ )
        } );
        await expect( registry.execute(
          "publish.compose",
          {
            kinds: {
              yt: "reel"
            }
          }
        ) ).rejects.toMatchObject( {
          message: expect.stringMatching( /not one of his Instagram accounts/ )
        } );
        expect( post.verb ).toBe( "Send as a draft" );
      }
    );

    it(
      "schedule only a caption the person approved, then send it the panel's way",
      async() => {
        const {
          registry, calls, posts
        } = setup();
        const still = await registry.execute(
          "export.add",
          {
            preset: "still"
          }
        ) as { id: string };

        await registry.execute(
          "publish.compose",
          {
            variant: still.id,
            when: "draft"
          }
        );
        expect( await registry.execute(
          "publish.caption",
          {
            template: "{title} — a loop {tags}"
          }
        ) ).toMatchObject( {
          caption: "Voronoi · Cells — a loop #geometry",
          approved: false
        } );
        await expect( registry.execute(
          "publish.schedule",
          {}
        ) ).rejects.toMatchObject( {
          message: expect.stringMatching( /not approved/ )
        } );

        await registry.execute(
          "publish.approve",
          {}
        );

        const sent = await registry.execute(
          "publish.schedule",
          {}
        ) as { sent: string;
          postIds: string[] };

        expect( sent ).toMatchObject( {
          sent: "draft",
          postIds: [
            "p0"
          ]
        } );
        expect( calls.filter( ( c ) => !c.startsWith( "GET" ) ) ).toEqual( [
          "POST /upload",
          "POST /posts"
        ] );
        expect( posts[ 0 ] ).toMatchObject( {
          type: "draft",
          posts: [
            {
              integration: {
                id: "ig"
              },
              value: [
                {
                  content: "Voronoi · Cells — a loop #geometry"
                }
              ]
            }
          ]
        } );

        const status = await registry.execute(
          "publish.status",
          {}
        ) as { sent: { postIds: string[] }[] };

        expect( status.sent[ 0 ].postIds ).toEqual( [
          "p0"
        ] );
        expect( await registry.execute(
          "publish.unschedule",
          {
            postId: "p0"
          }
        ) ).toEqual( {
          deleted: [
            "p0"
          ]
        } );
      }
    );

    it(
      "invite his other Instagram account to co-sign, never one the post goes to",
      async() => {
        const {
          registry
        } = setup();

        await expect( registry.execute(
          "publish.compose",
          {
            collaborators: [
              "yt"
            ]
          }
        ) ).rejects.toMatchObject( {
          message: expect.stringMatching( /not one of his Instagram accounts/ )
        } );
        await expect( registry.execute(
          "publish.compose",
          {
            accounts: [
              "ig"
            ],
            collaborators: [
              "ig"
            ]
          }
        ) ).rejects.toMatchObject( {
          message: expect.stringMatching( /cannot also be invited/ )
        } );
      }
    );

    it(
      "refuse a past time, and taking back a post already published",
      async() => {
        const {
          registry
        } = setup();

        await expect( registry.execute(
          "publish.compose",
          {
            when: "2020-01-01T10:00:00Z"
          }
        ) ).rejects.toMatchObject( {
          message: "that time is past"
        } );
        await expect( registry.execute(
          "publish.compose",
          {
            when: "2030-01-01T10:00"
          }
        ) ).rejects.toMatchObject( {
          message: expect.stringMatching( /WITH its zone/ )
        } );
        await expect( registry.execute(
          "publish.unschedule",
          {
            postId: "old"
          }
        ) ).rejects.toMatchObject( {
          message: expect.stringMatching( /published already/ )
        } );
      }
    );
  }
);
