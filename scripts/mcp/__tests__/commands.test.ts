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
        frame: 90,
        timing: {
          frameRate: 30,
          duration: 4,
          totalFrames: 120
        },
        url: "http://sketch.test/embed/x",
        problems: []
      };
    },
    outputDir: "/out",
    writeFile: async(
      path, bytes
    ) => {
      written[ path ] = bytes.byteLength;
    },
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

const UP = {
  "/api/health": () => ( {
    status: 200
  } ),
  "/api/sketches/form?sketch=voronoi-v1-cells&engine=p5": () => FORM,
  "/api/recordings/health": () => ( {
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0
  } )
};

describe(
  "Sketchbook commands",
  () => {
    it(
      "list every command, unavailable with the reason when the server is down",
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
          "jobs.get",
          "jobs.result",
          "jobs.wait",
          "render.frame",
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
        expect( described.schema.properties.render.properties.hueSpeed ).toMatchObject( {
          minimum: 0,
          maximum: 3,
          default: 0
        } );
      }
    );

    it(
      "render.frame checks the delta, then hands the renderer the request and the agent an image",
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
          id: "p5/voronoi/voronoi-v1-cells",
          options: {
            render: {
              hueSpeed: 2
            }
          },
          time: 3,
          size: {
            width: 540,
            height: 675
          },
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
            posted = init?.body as FormData;

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
      "jobs.wait gives up at its timeout with the last state",
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
      }
    );

    it(
      "keeps frames available but marks video and jobs unavailable when the queue is down",
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
