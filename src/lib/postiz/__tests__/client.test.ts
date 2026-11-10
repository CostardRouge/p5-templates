import {
  PostizClient, PostizError, apiCandidates, findApi, postBody, postProblem, readChannels, readCreated, readPosts, uploadProblem
} from "../client";

const json = (
  status: number, body: unknown
) => new Response(
  JSON.stringify( body ),
  {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  }
);

describe(
  "the Postiz client",
  () => {
    it(
      "finds the public API from the address typed",
      () => {
        expect( apiCandidates( "https://postiz.example.com/" ) ).toEqual( [
          "https://postiz.example.com/api/public/v1",
          "https://postiz.example.com/public/v1"
        ] );
        expect( apiCandidates( "https://postiz.example.com/api/public/v1" ) ).toEqual( [
          "https://postiz.example.com/api/public/v1"
        ] );
        expect( () => apiCandidates( "http://postiz.example.com" ) ).toThrow( PostizError );
      }
    );

    it(
      "builds a scheduled Reel, a trial, a carousel with a collaborator, a story",
      () => {
        const channels = [
          {
            id: "ch1",
            identifier: "instagram"
          }
        ];
        const media = [
          {
            id: "m1",
            path: "https://p/u/a.mp4"
          }
        ];
        const at = new Date( "2026-11-17T08:00:00Z" );
        const reel = postBody( {
          channels,
          choices: {
            kind: "reel"
          },
          caption: "Tasmania",
          media,
          video: true,
          at
        } );

        expect( reel ).toMatchObject( {
          type: "schedule",
          date: "2026-11-17T08:00:00.000Z",
          posts: [
            {
              integration: {
                id: "ch1"
              },
              value: [
                {
                  content: "Tasmania",
                  image: [
                    {
                      id: "m1",
                      path: "https://p/u/a.mp4"
                    }
                  ]
                }
              ],
              settings: {
                __type: "instagram",
                post_type: "post"
              }
            }
          ]
        } );
        const trial = postBody( {
          channels,
          choices: {
            kind: "reel",
            trial: true
          },
          caption: "",
          media,
          video: true,
          at
        } );

        expect( ( trial.posts as { settings: Record<string, unknown> }[] )[ 0 ].settings ).toMatchObject( {
          is_trial_reel: true,
          graduation_strategy: "SS_PERFORMANCE"
        } );
        const carousel = postBody( {
          channels,
          choices: {
            kind: "carousel",
            collaborators: [
              "@vanessa"
            ]
          },
          caption: "",
          media,
          video: false,
          at: "now"
        } );

        expect( carousel.type ).toBe( "now" );
        expect( ( carousel.posts as { settings: Record<string, unknown> }[] )[ 0 ].settings ).toMatchObject( {
          collaborators: [
            {
              label: "vanessa"
            }
          ]
        } );
        const story = postBody( {
          channels,
          choices: {
            kind: "story",
            collaborators: [
              "vanessa"
            ]
          },
          caption: "",
          media,
          video: false,
          at: "draft"
        } );

        expect( story.type ).toBe( "draft" );
        expect( ( story.posts as { settings: Record<string, unknown> }[] )[ 0 ].settings ).toEqual( {
          __type: "instagram",
          post_type: "story"
        } );
      }
    );

    it(
      "says before sending what Instagram or the server would refuse",
      () => {
        expect( uploadProblem( {
          size: 12 * 1024 * 1024,
          type: "image/png",
          name: "a.png"
        } ) ).toMatch( /10 MB/ );
        expect( uploadProblem( {
          size: 120 * 1024 * 1024,
          type: "video/mp4",
          name: "a.mp4"
        } ) ).toMatch( /95 MB/ );
        expect( uploadProblem( {
          size: 30 * 1024 * 1024,
          type: "video/mp4",
          name: "a.mp4"
        } ) ).toBeNull();
        expect( postProblem(
          "reel",
          [
            {
              type: "image/png"
            }
          ]
        ) ).toMatch( /one video/ );
        expect( postProblem(
          "carousel",
          Array.from(
            {
              length: 11
            },
            () => ( {
              type: "image/png"
            } )
          )
        ) ).toMatch( /10 at most/ );
        expect( postProblem(
          "story",
          [
            {
              type: "image/png"
            }
          ]
        ) ).toBeNull();
      }
    );

    it(
      "reads what Postiz answers, whatever extra it carries",
      () => {
        expect( readChannels( [
          {
            id: "a",
            name: "Steeve",
            identifier: "instagram",
            picture: "p",
            disabled: false,
            profile: "@steeve.pommier",
            extra: 1
          },
          {
            nope: true
          }
        ] ) ).toEqual( [
          {
            id: "a",
            name: "Steeve",
            identifier: "instagram",
            picture: "p",
            disabled: false,
            handle: "steeve.pommier"
          }
        ] );
        const posts = readPosts( {
          posts: [
            {
              id: "p1",
              group: "g",
              content: "hi",
              publishDate: "2026-11-17T08:00:00Z",
              state: "ERROR",
              error: "media",
              releaseURL: null,
              integration: {
                id: "a",
                name: "Steeve",
                providerIdentifier: "instagram",
                picture: null
              }
            }
          ]
        } );

        expect( posts[ 0 ] ).toMatchObject( {
          id: "p1",
          state: "error",
          error: "media",
          channel: {
            id: "a",
            identifier: "instagram"
          }
        } );
        expect( readCreated( [
          {
            postId: "x",
            integration: "a"
          }
        ] ) ).toEqual( [
          "x"
        ] );
        expect( readCreated( {
          posts: [
            {
              id: "y"
            }
          ]
        } ) ).toEqual( [
          "y"
        ] );
      }
    );

    it(
      "sends the key, and finds the API under /api first",
      async() => {
        const seen: string[] = [];
        const fetcher = async(
          url: string, init?: RequestInit
        ) => {
          seen.push( `${ init?.method ?? "GET" } ${ url } ${ ( init?.headers as Record<string, string> )?.Authorization }` );
          if ( url.endsWith( "/api/public/v1/is-connected" ) ) {
            return json(
              200,
              {
                connected: true
              }
            );
          }
          if ( url.endsWith( "/integrations" ) ) {
            return json(
              200,
              [
                {
                  id: "a",
                  name: "Steeve",
                  identifier: "instagram"
                }
              ]
            );
          }
          return json(
            404,
            {
              message: "nope"
            }
          );
        };
        const client = await findApi(
          "https://postiz.example.com",
          "KEY",
          fetcher
        );

        expect( client.apiBase ).toBe( "https://postiz.example.com/api/public/v1" );
        expect( ( await client.channels() ).map( ( c ) => c.name ) ).toEqual( [
          "Steeve"
        ] );
        expect( seen[ 0 ] ).toBe( "GET https://postiz.example.com/api/public/v1/is-connected KEY" );
      }
    );

    it(
      "says a refused key plainly",
      async() => {
        const client = new PostizClient(
          "https://p/api/public/v1",
          "bad",
          async() => json(
            401,
            {
              message: "Unauthorized"
            }
          )
        );

        await expect( client.channels() ).rejects.toThrow( /API key/ );
        await expect( findApi(
          "https://p",
          "bad",
          async() => json(
            401,
            {}
          )
        ) ).rejects.toThrow( /API key/ );
      }
    );
  }
);

describe(
  "what Postiz keeps, read for a person",
  () => {
    it(
      "reads a caption’s HTML as plain text, never as markup",
      async() => {
        const {
          postizText
        } = await import( "../client" );

        expect( postizText( "<p></p>" ) ).toBe( "" );
        expect( postizText( "<p>Ceci est un petit test</p><p>de publication &amp; plus</p>" ) ).toBe( "Ceci est un petit test\nde publication & plus" );
        expect( postizText( "A<br>B<br/>C &lt;b&gt; &#127462;&#127482; &nbsp;" ) ).toBe( "A\nB\nC <b> 🇦🇺" );
        expect( postizText( "<p><img src=x onerror=alert(1)>Hi</p>" ) ).toBe( "Hi" );
      }
    );

    it(
      "says what to do about the failures it knows, and the Postiz to open",
      async() => {
        const {
          failureHint, postizHome
        } = await import( "../client" );

        expect( failureHint( "Instagram could not process this video. If the issue persists…" ) ).toMatch( /30 fps/ );
        expect( failureHint( "Failed to fetch media from url" ) ).toMatch( /reachable/ );
        expect( failureHint( "The access token has expired" ) ).toMatch( /Reconnect/ );
        expect( failureHint( "Something else" ) ).toBeNull();
        expect( failureHint( null ) ).toBeNull();
        expect( postizHome( "https://postiz.example.com/api/public/v1" ) ).toBe( "https://postiz.example.com" );
        expect( postizHome( "https://api.postiz.example.com/public/v1" ) ).toBe( "https://api.postiz.example.com" );
      }
    );
  }
);
