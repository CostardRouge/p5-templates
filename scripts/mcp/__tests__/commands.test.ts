import type {
  CatalogEntry
} from "../catalog.ts";
import {
  createCommands, type CommandDeps
} from "../commands.ts";
import type {
  FrameRequest
} from "../frameRenderer.ts";
import {
  createCommandRegistry
} from "../registry.ts";

const CATALOG: CatalogEntry[] = [
  {
    name: "voronoi-v1-cells",
    engine: "p5",
    category: "voronoi",
    hasSketchForm: true
  }
];
const FORM = {
  sketch: "voronoi/voronoi-v1-cells",
  formValues: {
    render: {
      hueSpeed: 0,
      palette: "rainbow"
    },
    backgroundColor: [
      0,
      0,
      0,
      255
    ]
  },
  formConfiguration: {
    render: {
      component: "nested-object",
      fields: {
        hueSpeed: {
          component: "slider",
          min: 0,
          max: 3
        },
        palette: {
          component: "select",
          options: [
            {
              value: "rainbow"
            },
            {
              value: "mono"
            }
          ]
        }
      }
    },
    backgroundColor: {
      component: "color"
    }
  }
};

type Route = ( init?: RequestInit ) => unknown;

function setup(
  routes: Record<string, Route>, overrides: Partial<CommandDeps> = {}
) {
  const calls: { path: string;
    init?: RequestInit }[] = [];
  const frames: FrameRequest[] = [];
  const written: Record<string, number> = {};
  let clock = 0;
  const deps: CommandDeps = {
    baseUrl: "http://sketch.test",
    fetch: ( async(
      url: string, init?: RequestInit
    ) => {
      const path = url.replace(
        "http://sketch.test",
        ""
      );

      calls.push( {
        path,
        init
      } );

      const route = routes[ path ];

      if ( !route ) {
        return new Response(
          JSON.stringify( {
            error: "nope"
          } ),
          {
            status: 404
          }
        );
      }

      const body = route( init );

      return body instanceof Response ? body : new Response( JSON.stringify( body ) );
    } ) as typeof fetch,
    catalog: async() => CATALOG,
    localOptions: async() => ( {
      animation: {
        framerate: 30,
        duration: 4
      }
    } ),
    renderFrame: async( request ) => {
      frames.push( request );

      return {
        mimeType: "image/jpeg",
        data: "AAAA",
        width: 410,
        height: 512,
        sourceWidth: 1080,
        sourceHeight: 1350,
        frames: request.placements.map( (
          _, i
        ) => 90 + i ),
        timing: {
          frameRate: 30,
          duration: 4,
          totalFrames: 120
        },
        url: request.url,
        problems: []
      };
    },
    outputDir: "/out",
    writeFile: async(
      path, bytes
    ) => {
      written[ path ] = bytes.byteLength;
    },
    readMedia: async( path ) => ( {
      bytes: new Uint8Array( 3 ),
      name: path.split( "/" ).pop() as string
    } ),
    sleep: async( ms ) => {
      clock += ms;
    },
    now: () => clock,
    ...overrides
  };
  const registry = createCommandRegistry();

  registry.register( createCommands( deps ) );

  return {
    registry,
    calls,
    frames,
    written
  };
}

const UP: Record<string, Route> = {
  "/api/health": () => ( {
    status: 200
  } ),
  "/api/sketches/form?sketch=voronoi-v1-cells&engine=p5": () => FORM,
  "/api/recordings/health": () => ( {
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0
  } ),
  "/api/options/validate": ( init ) => {
    const document = JSON.parse( String( init?.body ) );

    return Array.isArray( document.content ) && document.content.some( ( item: Record<string, unknown> ) => "text" in item )
      ? {
        valid: false,
        issues: [
          {
            path: "content.0.text",
            message: "Unknown key, not part of the options schema — known here: type, content"
          }
        ]
      }
      : {
        valid: true,
        issues: []
      };
  }
};

function formOf( init?: RequestInit ): FormData {
  return init?.body as FormData;
}

describe(
  "Sketchbook commands",
  () => {
    it(
      "lists every command, unavailable with the reason when the server is down",
      async() => {
        const {
          registry
        } = setup(
          {},
          {
            fetch: ( async() => {
              throw new Error( "ECONNREFUSED" );
            } ) as typeof fetch
          }
        );
        const listed = await registry.list();

        expect( listed.map( ( c ) => c.id ) ).toEqual( [
          "app.status",
          "drafts.copy",
          "drafts.create",
          "drafts.get",
          "drafts.update",
          "jobs.cancel",
          "jobs.get",
          "jobs.list",
          "jobs.result",
          "jobs.wait",
          "options.schema",
          "render.frame",
          "render.stills",
          "render.video",
          "sketches.describe",
          "sketches.list"
        ] );
        expect( listed.find( ( c ) => c.id === "render.frame" ) ).toMatchObject( {
          available: false,
          reason: expect.stringContaining( "not reachable at http://sketch.test" )
        } );
        // The catalogue is local: listing works with no server.
        expect( listed.find( ( c ) => c.id === "sketches.list" )?.available ).toBe( true );
      }
    );

    it(
      "keeps frames available but marks video, drafts and jobs unavailable when the queue is down",
      async() => {
        const {
          registry
        } = setup( {
          ...UP,
          "/api/recordings/health": () => new Response(
            JSON.stringify( {
              error: "REDIS_URL environment variable is required"
            } ),
            {
              status: 500
            }
          )
        } );
        const listed = await registry.list();

        expect( listed.find( ( c ) => c.id === "render.frame" )?.available ).toBe( true );
        expect( listed.find( ( c ) => c.id === "render.video" ) ).toMatchObject( {
          available: false,
          reason: expect.stringContaining( "the recording queue at http://sketch.test is down (REDIS_URL environment variable is required)" )
        } );
        expect( listed.find( ( c ) => c.id === "drafts.create" )?.available ).toBe( false );
        await expect( registry.execute(
          "jobs.get",
          {
            jobId: "job-1"
          }
        ) ).rejects.toMatchObject( {
          code: "unavailable"
        } );
      }
    );

    it(
      "describe answers the schema with defaults and the sketch's own clock",
      async() => {
        const {
          registry
        } = setup( UP );
        const described = await registry.execute(
          "sketches.describe",
          {
            sketch: "voronoi-v1-cells"
          }
        ) as Record<string, any>;

        expect( described.id ).toBe( "p5/voronoi/voronoi-v1-cells" );
        expect( described.animation ).toEqual( {
          framerate: 30,
          duration: 4
        } );
        expect( described.size ).toEqual( {
          width: 1080,
          height: 1350
        } );
        expect( described.schema.properties.render.properties.hueSpeed ).toMatchObject( {
          minimum: 0,
          maximum: 3,
          default: 0
        } );
      }
    );

    it(
      "options.schema answers the document schema a part at a time",
      async() => {
        const {
          registry
        } = setup( {
          ...UP,
          "/api/options/schema": () => ( {
            type: "object",
            properties: {
              size: {
                type: "object"
              },
              content: {
                type: "array",
                items: {
                  oneOf: [
                    {
                      type: "object",
                      properties: {
                        type: {
                          const: "text"
                        },
                        content: {
                          type: "string"
                        }
                      }
                    }
                  ]
                }
              }
            }
          } )
        } );

        await expect( registry.execute( "options.schema" ) ).resolves.toMatchObject( {
          contentTypes: [
            "text"
          ]
        } );
        await expect( registry.execute(
          "options.schema",
          {
            part: "content"
          }
        ) ).resolves.toEqual( {
          text: [
            "content"
          ]
        } );
        await expect( registry.execute(
          "options.schema",
          {
            part: "content.image"
          }
        ) ).rejects.toMatchObject( {
          code: "invalid"
        } );
      }
    );

    it(
      "render.frame checks the delta, then renders the sketch on /embed and answers an image",
      async() => {
        const {
          registry, frames
        } = setup( UP );

        await expect( registry.execute(
          "render.frame",
          {
            sketch: "voronoi-v1-cells",
            options: {
              render: {
                hueSpeed: 5
              }
            }
          }
        ) )
          .rejects.toMatchObject( {
            code: "invalid",
            message: "options.render.hueSpeed is 5, above its maximum 3"
          } );
        expect( frames ).toHaveLength( 0 );

        const image = await registry.execute(
          "render.frame",
          {
            sketch: "voronoi-v1-cells",
            options: {
              render: {
                hueSpeed: 2
              }
            },
            time: 3,
            width: 540,
            height: 675
          }
        ) as Record<string, unknown>;

        expect( frames[ 0 ] ).toMatchObject( {
          url: "http://sketch.test/embed/p5/voronoi/voronoi-v1-cells#o=eyJyZW5kZXIiOnsiaHVlU3BlZWQiOjJ9fQ&s=540x675",
          viewport: {
            width: 540,
            height: 675
          },
          placements: [
            {
              time: 3
            }
          ],
          format: "jpeg",
          maxEdge: 1024
        } );
        expect( image ).toMatchObject( {
          kind: "image",
          mimeType: "image/jpeg",
          data: "AAAA",
          width: 410,
          height: 512
        } );
        expect( image.note ).toContain( "frame 90 of 120 (3.00 s of a 4 s loop at 30 fps), canvas 1080×1350, shown at 410×512" );
      }
    );

    it(
      "render.frame renders a draft on its own capture page, at its stored size",
      async() => {
        const {
          registry, frames
        } = setup( {
          ...UP,
          "/api/recordings/d-1": () => ( {
            id: "d-1",
            status: "draft",
            sketch: "sketches/p5/voronoi/voronoi-v1-cells",
            options: {
              size: {
                width: 1080,
                height: 1920
              }
            }
          } )
        } );

        await registry.execute(
          "render.frame",
          {
            draft: "d-1",
            progress: 0.5
          }
        );
        expect( frames[ 0 ] ).toMatchObject( {
          url: "http://sketch.test/sketches/p5/voronoi/voronoi-v1-cells?id=d-1&capturing",
          viewport: {
            width: 1080,
            height: 1920
          },
          placements: [
            {
              progress: 0.5
            }
          ]
        } );
        await expect( registry.execute(
          "render.frame",
          {
            draft: "d-1",
            options: {}
          }
        ) ).rejects.toMatchObject( {
          code: "invalid",
          message: "options cannot go with draft — a draft renders as stored; change it with drafts.update"
        } );
        await expect( registry.execute(
          "render.frame",
          {}
        ) ).rejects.toMatchObject( {
          message: "give sketch or draft (one of them)"
        } );
      }
    );

    it(
      "render.stills spaces frames through the loop and saves each one",
      async() => {
        const {
          registry, frames
        } = setup( UP );
        const sheet = await registry.execute(
          "render.stills",
          {
            sketch: "voronoi-v1-cells",
            count: 4
          }
        ) as Record<string, string>;

        expect( frames[ 0 ].placements ).toEqual( [
          {
            progress: 0
          },
          {
            progress: 0.25
          },
          {
            progress: 0.5
          },
          {
            progress: 0.75
          }
        ] );
        expect( frames[ 0 ].savePaths ).toHaveLength( 4 );
        expect( frames[ 0 ].savePaths?.[ 3 ] ).toMatch( /^\/out\/p5-voronoi-voronoi-v1-cells-0-04\.png$/ );
        expect( sheet.note ).toContain( "4 stills" );
        await expect( registry.execute(
          "render.stills",
          {
            sketch: "voronoi-v1-cells",
            from: 0.5,
            to: 0.5
          }
        ) ).rejects.toMatchObject( {
          code: "invalid"
        } );
      }
    );

    it(
      "render.frame refuses a width without a height",
      async() => {
        const {
          registry
        } = setup( UP );

        await expect( registry.execute(
          "render.frame",
          {
            sketch: "voronoi-v1-cells",
            width: 540
          }
        ) ).rejects.toMatchObject( {
          code: "invalid"
        } );
      }
    );

    it(
      "render.video posts what the studio posts: the whole parameter object over the sketch's own options",
      async() => {
        let posted: FormData | null = null;
        const {
          registry
        } = setup( {
          ...UP,
          "/api/recordings/enqueue": ( init ) => {
            posted = formOf( init );

            return {
              success: true,
              jobId: "job-1"
            };
          }
        } );
        const answer = await registry.execute(
          "render.video",
          {
            sketch: "voronoi-v1-cells",
            options: {
              render: {
                palette: "mono"
              }
            },
            duration: 6
          }
        );

        expect( answer ).toMatchObject( {
          jobId: "job-1",
          status: "queued"
        } );
        expect( posted!.get( "sketch" ) ).toBe( "sketches/p5/voronoi/voronoi-v1-cells" );
        expect( posted!.get( "status" ) ).toBe( "queued" );
        expect( JSON.parse( posted!.get( "options" ) as string ) ).toEqual( {
          animation: {
            framerate: 30,
            duration: 6
          },
          sketch: {
            render: {
              hueSpeed: 0,
              palette: "mono"
            },
            backgroundColor: [
              0,
              0,
              0,
              255
            ]
          }
        } );
      }
    );

    it(
      "render.video records a draft from a copy, so the draft stays editable",
      async() => {
        const {
          registry, calls
        } = setup( {
          ...UP,
          "/api/recordings/d-1": () => ( {
            id: "d-1",
            status: "draft",
            sketch: "sketches/p5/voronoi/voronoi-v1-cells",
            options: {
              size: {
                width: 1080,
                height: 1920
              }
            }
          } ),
          "/api/recordings/d-odd": () => ( {
            id: "d-odd",
            status: "draft",
            sketch: "sketches/p5/voronoi/voronoi-v1-cells",
            options: {
              size: {
                width: 540,
                height: 675
              },
              slides: [
                {},
                {
                  size: {
                    width: 1081,
                    height: 1080
                  }
                }
              ]
            }
          } ),
          "/api/recordings/d-1/clone": () => ( {
            success: true,
            jobId: "copy-1"
          } ),
          "/api/recordings/copy-1/start": () => ( {
            started: true
          } )
        } );

        await expect( registry.execute(
          "render.video",
          {
            draft: "d-1"
          }
        ) ).resolves.toMatchObject( {
          jobId: "copy-1",
          fromDraft: "d-1"
        } );
        expect( calls.map( ( c ) => c.path ).filter( ( p ) => p.startsWith( "/api/recordings/" ) && p !== "/api/recordings/health" ) ).toEqual( [
          "/api/recordings/d-1",
          "/api/recordings/d-1/clone",
          "/api/recordings/copy-1/start"
        ] );
        // H.264 takes even dimensions only: refused before any job exists.
        await expect( registry.execute(
          "render.video",
          {
            draft: "d-odd"
          }
        ) ).rejects.toMatchObject( {
          code: "invalid",
          message: "a video needs even dimensions (H.264, yuv420p) — size is 540×675, slides.1.size is 1081×1080"
        } );
        await expect( registry.execute(
          "render.video",
          {
            sketch: "voronoi-v1-cells",
            width: 540,
            height: 675
          }
        ) ).rejects.toMatchObject( {
          code: "invalid"
        } );
        expect( calls.some( ( c ) => c.path.includes( "d-odd/clone" ) || c.path === "/api/recordings/enqueue" ) ).toBe( false );
        await expect( registry.execute(
          "render.video",
          {
            draft: "d-1",
            duration: 3
          }
        ) ).rejects.toMatchObject( {
          code: "invalid"
        } );
      }
    );

    it(
      "drafts.create saves the document, the whole parameter object and the media as the studio's Save draft",
      async() => {
        let posted: FormData | null = null;
        const {
          registry
        } = setup( {
          ...UP,
          "/api/recordings/enqueue": ( init ) => {
            posted = formOf( init );

            return {
              success: true,
              jobId: "d-1"
            };
          }
        } );
        const answer = await registry.execute(
          "drafts.create",
          {
            sketch: "voronoi-v1-cells",
            options: {
              render: {
                palette: "mono"
              }
            },
            document: {
              size: {
                width: 1080,
                height: 1920
              },
              content: [
                {
                  type: "image",
                  source: "global/images/cat.jpg"
                }
              ]
            },
            files: [
              "/home/me/cat.jpg",
              "/home/me/beat track.mp3"
            ]
          }
        ) as Record<string, unknown>;

        expect( answer ).toMatchObject( {
          draft: "d-1",
          assets: {
            "/home/me/cat.jpg": "global/images/cat.jpg",
            "/home/me/beat track.mp3": "global/audios/beat-track.mp3"
          },
          studio: "http://sketch.test/sketches/p5/voronoi/voronoi-v1-cells?id=d-1"
        } );
        expect( posted!.get( "status" ) ).toBe( "draft" );
        expect( JSON.parse( posted!.get( "options" ) as string ) ).toEqual( {
          animation: {
            framerate: 30,
            duration: 4
          },
          size: {
            width: 1080,
            height: 1920
          },
          content: [
            {
              type: "image",
              source: "global/images/cat.jpg"
            }
          ],
          sketch: {
            render: {
              hueSpeed: 0,
              palette: "mono"
            },
            backgroundColor: [
              0,
              0,
              0,
              255
            ]
          }
        } );
        expect( ( posted!.get( "file[global][images]" ) as File ).name ).toBe( "global/images/cat.jpg" );
        expect( ( posted!.get( "file[global][audios]" ) as File ).type ).toBe( "audio/mpeg" );
      }
    );

    it(
      "drafts.create refuses what the document schema refuses, and reserved keys",
      async() => {
        const {
          registry
        } = setup( UP );

        await expect( registry.execute(
          "drafts.create",
          {
            sketch: "voronoi-v1-cells",
            document: {
              content: [
                {
                  type: "text",
                  text: "hi"
                }
              ]
            }
          }
        ) )
          .rejects.toMatchObject( {
            code: "invalid",
            message: expect.stringContaining( "document.content.0.text: Unknown key" )
          } );
        await expect( registry.execute(
          "drafts.create",
          {
            sketch: "voronoi-v1-cells",
            document: {
              sketch: {}
            }
          }
        ) )
          .rejects.toMatchObject( {
            code: "invalid",
            message: "document.sketch is not set here — pass the sketch's parameters as `options`"
          } );
        await expect( registry.execute(
          "drafts.create",
          {
            sketch: "voronoi-v1-cells",
            files: [
              "/a/x.jpg",
              "/b/x.jpg"
            ]
          }
        ) )
          .rejects.toMatchObject( {
            code: "invalid",
            message: "/a/x.jpg and /b/x.jpg would both be stored as global/images/x.jpg — rename one"
          } );
        await expect( registry.execute(
          "drafts.create",
          {
            sketch: "voronoi-v1-cells",
            files: [
              "/a/notes.txt"
            ]
          }
        ) )
          .rejects.toMatchObject( {
            code: "invalid"
          } );
      }
    );

    it(
      "drafts.update merges over the stored document and re-sends every file it keeps",
      async() => {
        let posted: FormData | null = null;
        const stored = {
          size: {
            width: 1080,
            height: 1920
          },
          content: [
            {
              type: "image",
              source: "global/images/cat.jpg"
            }
          ],
          assets: {
            images: [
              "global/images/cat.jpg",
              "global/images/old.png"
            ],
            videos: [],
            audios: []
          },
          slides: [],
          sketch: {
            render: {
              hueSpeed: 1,
              palette: "mono"
            },
            backgroundColor: [
              0,
              0,
              0,
              255
            ]
          }
        };
        const {
          registry, calls
        } = setup( {
          ...UP,
          "/api/recordings/d-1": () => ( {
            id: "d-1",
            status: "draft",
            sketch: "sketches/p5/voronoi/voronoi-v1-cells",
            options: stored
          } ),
          "/api/s3/d-1/assets/global/images/cat.jpg": () => new Response( new Uint8Array( 5 ) ),
          "/api/recordings/enqueue": ( init ) => {
            posted = formOf( init );

            return {
              success: true,
              jobId: "d-1"
            };
          }
        } );
        const answer = await registry.execute(
          "drafts.update",
          {
            draft: "d-1",
            options: {
              render: {
                hueSpeed: 2
              }
            },
            document: {
              animation: {
                framerate: 24,
                duration: 5
              }
            },
            files: [
              "/home/me/dog.jpg"
            ],
            removeFiles: [
              "global/images/old.png"
            ]
          }
        ) as Record<string, unknown>;

        expect( answer ).toMatchObject( {
          assets: [
            "global/images/cat.jpg",
            "global/images/dog.jpg"
          ],
          removed: [
            "global/images/old.png"
          ]
        } );
        expect( posted!.get( "jobId" ) ).toBe( "d-1" );
        expect( JSON.parse( posted!.get( "options" ) as string ) ).toMatchObject( {
          size: {
            width: 1080,
            height: 1920
          },
          animation: {
            framerate: 24,
            duration: 5
          },
          sketch: {
            render: {
              hueSpeed: 2,
              palette: "mono"
            },
            backgroundColor: [
              0,
              0,
              0,
              255
            ]
          }
        } );
        expect( ( posted!.getAll( "file[global][images]" ) as File[] ).map( ( f ) => f.name ) ).toEqual( [
          "global/images/cat.jpg",
          "global/images/dog.jpg"
        ] );
        expect( calls.some( ( c ) => c.path.includes( "old.png" ) ) ).toBe( false );
      }
    );

    it(
      "drafts.update refuses a job that is not a draft, and a file it does not hold",
      async() => {
        const {
          registry
        } = setup( {
          ...UP,
          "/api/recordings/j-1": () => ( {
            id: "j-1",
            status: "completed",
            sketch: "sketches/p5/voronoi/voronoi-v1-cells",
            options: {}
          } ),
          "/api/recordings/d-2": () => ( {
            id: "d-2",
            status: "draft",
            sketch: "sketches/p5/voronoi/voronoi-v1-cells",
            options: {}
          } )
        } );

        await expect( registry.execute(
          "drafts.update",
          {
            draft: "j-1"
          }
        ) ).rejects.toMatchObject( {
          message: "j-1 is completed, not a draft — drafts.copy { draft } makes an editable copy"
        } );
        await expect( registry.execute(
          "drafts.update",
          {
            draft: "d-2",
            removeFiles: [
              "global/images/x.png"
            ]
          }
        ) ).rejects.toMatchObject( {
          message: "global/images/x.png is not in this draft — it has no files"
        } );
      }
    );

    it(
      "jobs.wait follows a job to its end, and jobs.result downloads it",
      async() => {
        let polls = 0;
        const {
          registry, written
        } = setup( {
          ...UP,
          "/api/recordings/job-1": () => ( {
            id: "job-1",
            sketch: "sketches/p5/voronoi/voronoi-v1-cells",
            status: ++polls < 3 ? "active" : "completed",
            videoUrls: [
              "job-1/a.mp4"
            ]
          } ),
          "/api/progression/job-1": () => ( {
            percentage: 50,
            currentStep: {
              name: "recording",
              progression: 50
            }
          } ),
          "/api/recordings/download/job-1": () => new Response( new Uint8Array( 7 ) )
        } );
        const done = await registry.execute(
          "jobs.wait",
          {
            jobId: "job-1"
          }
        ) as Record<string, any>;

        expect( done.status ).toBe( "completed" );
        expect( done.result.video ).toBe( "http://sketch.test/api/recordings/download/job-1" );

        const fetched = await registry.execute(
          "jobs.result",
          {
            jobId: "job-1"
          }
        ) as Record<string, any>;

        expect( fetched.files ).toEqual( [
          {
            url: "http://sketch.test/api/recordings/download/job-1",
            path: "/out/job-1.mp4",
            bytes: 7
          }
        ] );
        expect( written ).toEqual( {
          "/out/job-1.mp4": 7
        } );
      }
    );

    it(
      "jobs.wait gives up at its timeout with the last state, and refuses a draft",
      async() => {
        const {
          registry
        } = setup( {
          ...UP,
          "/api/recordings/job-2": () => ( {
            id: "job-2",
            status: "queued"
          } ),
          "/api/progression/job-2": () => ( {
            percentage: 0,
            currentStep: null
          } ),
          "/api/recordings/d-3": () => ( {
            id: "d-3",
            status: "draft"
          } )
        } );

        await expect( registry.execute(
          "jobs.wait",
          {
            jobId: "job-2",
            timeoutSeconds: 5
          }
        ) ).resolves.toMatchObject( {
          status: "queued",
          timedOut: true
        } );
        await expect( registry.execute(
          "jobs.wait",
          {
            jobId: "d-3"
          }
        ) ).rejects.toMatchObject( {
          code: "invalid"
        } );
      }
    );

    it(
      "jobs.list filters by status and jobs.cancel reports the server's answer",
      async() => {
        const {
          registry, calls
        } = setup( {
          ...UP,
          "/api/recordings?status=draft,failed": () => [
            {
              id: "d-1",
              sketch: "sketches/p5/a/b",
              status: "draft",
              createdAt: "t"
            }
          ],
          "/api/recordings/j-1/cancel": () => ( {
            cancelled: true
          } )
        } );

        await expect( registry.execute(
          "jobs.list",
          {
            status: [
              "draft",
              "failed"
            ]
          }
        ) ).resolves.toEqual( {
          total: 1,
          jobs: [
            {
              jobId: "d-1",
              sketch: "p5/a/b",
              status: "draft",
              createdAt: "t"
            }
          ]
        } );
        await expect( registry.execute(
          "jobs.list",
          {
            status: [
              "done"
            ]
          }
        ) ).rejects.toMatchObject( {
          code: "invalid"
        } );
        await expect( registry.execute(
          "jobs.cancel",
          {
            jobId: "j-1"
          }
        ) ).resolves.toEqual( {
          jobId: "j-1",
          cancelled: true
        } );
        expect( calls.find( ( c ) => c.path === "/api/recordings/j-1/cancel" )?.init?.method ).toBe( "POST" );
      }
    );

    it(
      "drafts store the document as the schema parses it, defaults filled in, for the keys given only",
      async() => {
        let posted: FormData | null = null;
        let validated: Record<string, unknown> | null = null;
        const {
          registry
        } = setup( {
          ...UP,
          "/api/options/validate": ( init ) => {
            validated = JSON.parse( String( init?.body ) );

            return {
              valid: true,
              issues: [],
              normalized: {
                size: {
                  width: 1080,
                  height: 1350
                },
                content: [
                  {
                    type: "text",
                    content: "hi",
                    alignment: {
                      horizontal: "center",
                      vertical: "baseline"
                    }
                  }
                ]
              }
            };
          },
          "/api/recordings/enqueue": ( init ) => {
            posted = formOf( init );

            return {
              success: true,
              jobId: "d-9"
            };
          }
        } );

        await registry.execute(
          "drafts.create",
          {
            sketch: "voronoi-v1-cells",
            document: {
              content: [
                {
                  type: "text",
                  content: "hi"
                }
              ]
            }
          }
        );
        // Only the keys given are checked and taken back: the root defaults
        // (1080×1350…) must not override the sketch's own options.
        expect( validated ).toEqual( {
          content: [
            {
              type: "text",
              content: "hi"
            }
          ]
        } );
        expect( JSON.parse( posted!.get( "options" ) as string ) ).toEqual( {
          animation: {
            framerate: 30,
            duration: 4
          },
          content: [
            {
              type: "text",
              content: "hi",
              alignment: {
                horizontal: "center",
                vertical: "baseline"
              }
            }
          ],
          sketch: {
            render: {
              hueSpeed: 0,
              palette: "rainbow"
            },
            backgroundColor: [
              0,
              0,
              0,
              255
            ]
          }
        } );
      }
    );

    it(
      "refuses a job id the server could not have minted before calling it",
      async() => {
        const {
          registry, calls
        } = setup( UP );

        await expect( registry.execute(
          "jobs.get",
          {
            jobId: "../etc"
          }
        ) ).rejects.toMatchObject( {
          code: "invalid"
        } );
        expect( calls.some( ( c ) => c.path.includes( "etc" ) ) ).toBe( false );
      }
    );
  }
);
