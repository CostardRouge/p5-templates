/**
 * Sketchbook's agent commands. Each one goes through the door a person's
 * gesture goes through, so an agent is validated like a person:
 *
 * - the catalogue is `src/sketches/metadata.json`, the gallery's own list;
 * - a sketch's parameters come from `GET /api/sketches/form`, the route the
 *   embed panel and the sketch-layer picker read, and a delta is checked
 *   against those controls (`sketchForm.ts`) before anything renders;
 * - a frame is rendered by the recorder's own capture protocol on the public
 *   `/embed` route (`frameRenderer.ts`);
 * - a video is `POST /api/recordings/enqueue`, the studio's "Record" button,
 *   followed through `/api/progression/<id>` and fetched from
 *   `/api/recordings/download/<id>` — the backend pipeline of `recording.md`,
 *   untouched.
 *
 * Every I/O is injected (`CommandDeps`) so the commands are tested without a
 * server, a browser or a disk.
 */
import {
  filterCatalog, resolveSketch, sketchId, type CatalogEntry
} from "./catalog.ts";
import type {
  FrameRequest, FrameResult
} from "./frameRenderer.ts";
import {
  CommandError, isRecord, type CommandSpec, type ImageResult
} from "./registry.ts";
import {
  checkSketchOptions, formSchema, mergeOptions
} from "./sketchForm.ts";

export interface CommandDeps {
  /** The Sketchbook origin, no trailing slash. */
  baseUrl: string;
  fetch: typeof fetch;
  catalog: () => Promise<CatalogEntry[]>;
  /** The sketch's `options.json` in this checkout (size, animation, slides), when it has one. */
  localOptions: ( entry: CatalogEntry ) => Promise<Record<string, unknown> | null>;
  renderFrame: ( request: FrameRequest ) => Promise<FrameResult>;
  /** Where saved frames and downloaded videos land. */
  outputDir: string;
  writeFile: ( path: string, bytes: Uint8Array ) => Promise<void>;
  sleep: ( ms: number ) => Promise<void>;
  now: () => number;
}

const ENGINES = [
  "p5",
  "gsap",
  "threejs"
] as const;
const TERMINAL = new Set( [
  "completed",
  "failed",
  "cancelled"
] );
const SERVER_CHECK_TTL_MS = 5000;

/** The sizes and clock bounds `SketchSizeSchema` / `SketchAnimationSchema` allow. */
const SIZE = {
  min: 50,
  max: 8192
};

type Form = {
  formValues: Record<string, unknown>;
  formConfiguration: Record<string, unknown>;
};

function sizeOf( params: Record<string, unknown> ): { width: number;
  height: number } | undefined {
  const width = params.width as number | undefined;
  const height = params.height as number | undefined;

  if ( ( width === undefined ) !== ( height === undefined ) ) {
    throw new CommandError(
      "invalid",
      "give width and height together, or neither for the sketch's own size"
    );
  }

  return width !== undefined && height !== undefined
    ? {
      width,
      height
    }
    : undefined;
}

function safeName( value: string ): string {
  return value.replace(
    /[^A-Za-z0-9_-]+/g,
    "-"
  );
}

export function createCommands( deps: CommandDeps ): CommandSpec[] {
  type Check = { at: number;
    result: true | string };
  let serverCheck: Check | null = null;
  let queueCheck: Check | null = null;
  const forms = new Map<string, Form>();

  async function getJson(
    path: string, init?: RequestInit
  ): Promise<unknown> {
    let response: Response;

    try {
      response = await deps.fetch(
        `${ deps.baseUrl }${ path }`,
        init
      );
    } catch( error ) {
      throw new CommandError(
        "unavailable",
        `Sketchbook is not reachable at ${ deps.baseUrl } (${ error instanceof Error ? error.message : String( error ) })`
      );
    }

    const body = await response.json().catch( () => null );

    if ( !response.ok ) {
      const reason = isRecord( body ) && typeof body.error === "string" ? body.error : response.statusText;

      throw new CommandError(
        response.status === 400 || response.status === 404 ? "invalid" : "failed",
        `${ path } answered ${ response.status }: ${ reason }`
      );
    }

    return body;
  }

  async function serverUp(): Promise<true | string> {
    if ( serverCheck && deps.now() - serverCheck.at < SERVER_CHECK_TTL_MS ) {
      return serverCheck.result;
    }

    let result: true | string;

    try {
      const response = await deps.fetch( `${ deps.baseUrl }/api/health` );

      result = response.ok ? true : `Sketchbook at ${ deps.baseUrl } answered ${ response.status } on /api/health`;
    } catch {
      result = `Sketchbook is not reachable at ${ deps.baseUrl } — start it (npm run dev) or point SKETCHBOOK_URL at a running one`;
    }
    serverCheck = {
      at: deps.now(),
      result
    };

    return result;
  }

  /**
   * The recording pipeline answers: Redis, Postgres and the worker behind
   * `/api/recordings/health` (which is also what starts the worker in a fresh
   * server process). A server can render frames without any of it.
   */
  async function queueUp(): Promise<true | string> {
    const server = await serverUp();

    if ( server !== true ) {
      return server;
    }
    if ( queueCheck && deps.now() - queueCheck.at < SERVER_CHECK_TTL_MS ) {
      return queueCheck.result;
    }

    let result: true | string;

    try {
      const response = await deps.fetch( `${ deps.baseUrl }/api/recordings/health` );
      const body = await response.json().catch( () => null );

      result = response.ok
        ? true
        : `the recording queue at ${ deps.baseUrl } is down (${ isRecord( body ) && typeof body.error === "string" ? body.error : response.status }) — it needs Redis, Postgres and S3 (docker-compose up -d redis minio postgres)`;
    } catch( error ) {
      result = `the recording queue at ${ deps.baseUrl } did not answer (${ error instanceof Error ? error.message : String( error ) })`;
    }
    queueCheck = {
      at: deps.now(),
      result
    };

    return result;
  }

  async function sketch( ref: unknown ): Promise<CatalogEntry> {
    return resolveSketch(
      await deps.catalog(),
      String( ref )
    );
  }

  async function form( entry: CatalogEntry ): Promise<Form> {
    const id = sketchId( entry );
    const cached = forms.get( id );

    if ( cached ) {
      return cached;
    }

    const body = await getJson( `/api/sketches/form?sketch=${ encodeURIComponent( entry.name ) }&engine=${ encodeURIComponent( entry.engine ) }` );
    const loaded: Form = {
      formValues: isRecord( body ) && isRecord( body.formValues ) ? body.formValues : {},
      formConfiguration: isRecord( body ) && isRecord( body.formConfiguration ) ? body.formConfiguration : {}
    };

    forms.set(
      id,
      loaded
    );

    return loaded;
  }

  /** The delta, checked against the sketch's own controls. */
  async function checkedDelta(
    entry: CatalogEntry, options: unknown
  ): Promise<{ delta: Record<string, unknown>;
    form: Form }> {
    const loaded = await form( entry );
    const delta = isRecord( options ) ? options : {};

    checkSketchOptions(
      loaded.formConfiguration,
      loaded.formValues,
      delta
    );

    return {
      delta,
      form: loaded
    };
  }

  function jobPath( jobId: unknown ): string {
    const id = String( jobId );

    // The same alphabet `isSafeJobId` admits server-side.
    if ( !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test( id ) ) {
      throw new CommandError(
        "invalid",
        `"${ id }" is not a job id`
      );
    }

    return encodeURIComponent( id );
  }

  async function jobState( jobId: unknown ): Promise<Record<string, unknown>> {
    const id = jobPath( jobId );
    const job = await getJson( `/api/recordings/${ id }` ) as Record<string, unknown>;
    const progression = await getJson( `/api/progression/${ id }` ).catch( () => null ) as Record<string, unknown> | null;
    const status = String( job.status );
    const state: Record<string, unknown> = {
      jobId: job.id,
      sketch: job.sketch,
      status,
      percentage: progression?.percentage ?? job.progress ?? 0,
      step: isRecord( progression?.currentStep ) ? progression.currentStep : null,
      createdAt: job.createdAt,
      recordingDurationMs: job.recordingDuration ?? null
    };

    if ( status === "failed" ) {
      // The job row keeps no error text: the reason is only in the server's log.
      const where = isRecord( progression?.currentStep ) ? progression.currentStep.name : null;

      state.failure = `failed${ where ? ` during ${ String( where ) }` : "" } — the reason is in the Sketchbook server's log (the job record does not keep it)`;
    }

    if ( status === "completed" ) {
      const videos = Array.isArray( job.videoUrls ) ? job.videoUrls : [];

      state.result = {
        video: `${ deps.baseUrl }/api/recordings/download/${ id }`,
        slides: videos.length > 1
          ? videos.map( (
            _, i
          ) => `${ deps.baseUrl }/api/recordings/download/${ id }/slide/${ i }` )
          : undefined,
        page: `${ deps.baseUrl }/recordings`
      };
    }

    return state;
  }

  return [
    {
      id: "app.status",
      title: "Status",
      description: "Where this server points, whether Sketchbook answers there, whether its recording queue is up (Redis + worker), how many sketches the catalogue holds and where files are written. Call first.",
      async run() {
        const reachable = await serverUp();
        let queue: unknown = null;

        if ( reachable === true ) {
          // Also what starts the recording worker in a fresh server process.
          queue = await getJson( "/api/recordings/health" ).catch( ( error: Error ) => ( {
            error: error.message
          } ) );
        }

        return {
          server: deps.baseUrl,
          reachable: reachable === true,
          ...( reachable === true ? {} : {
            reason: reachable
          } ),
          queue,
          sketches: ( await deps.catalog() ).length,
          outputDir: deps.outputDir
        };
      }
    },
    {
      id: "sketches.list",
      title: "List sketches",
      description: "Search the catalogue. Answers each sketch's id (`<engine>/<category>/<name>`, what every other command takes) and the categories the result spans. Hidden studies are left out unless includeHidden.",
      params: {
        engine: {
          type: "string",
          description: "Only this engine",
          enum: ENGINES,
          optional: true
        },
        category: {
          type: "string",
          description: "Only this category (e.g. voronoi, flip, sculpt)",
          optional: true
        },
        query: {
          type: "string",
          description: "Case-insensitive substring of the id",
          optional: true
        },
        includeHidden: {
          type: "boolean",
          description: "Include sketches the gallery hides",
          optional: true
        },
        limit: {
          type: "number",
          description: "At most this many sketches (default 100)",
          min: 1,
          max: 1000,
          integer: true,
          optional: true
        }
      },
      async run( params ) {
        const found = filterCatalog(
          await deps.catalog(),
          params
        );
        const categories: Record<string, number> = {};

        for ( const entry of found ) {
          const key = `${ entry.engine }/${ entry.category ?? "" }`;

          categories[ key ] = ( categories[ key ] ?? 0 ) + 1;
        }

        return {
          total: found.length,
          categories,
          sketches: found.slice(
            0,
            ( params.limit as number | undefined ) ?? 100
          ).map( ( entry ) => ( {
            id: sketchId( entry ),
            hasForm: entry.hasSketchForm ?? false,
            ...( entry.hiddenFromGallery ? {
              hidden: true
            } : {} )
          } ) )
        };
      }
    },
    {
      id: "sketches.describe",
      title: "Describe a sketch",
      description: "A sketch's parameters as JSON Schema (ranges, choices, defaults, labels) and its current default values, plus the studio and embed URLs. What render.frame and render.video accept as `options` is any nested subset of these parameters.",
      params: {
        sketch: {
          type: "string",
          description: "Sketch id from sketches.list (a bare name works when unique)"
        }
      },
      available: serverUp,
      async run( params ) {
        const entry = await sketch( params.sketch );
        const loaded = await form( entry );
        const own = await deps.localOptions( entry );

        return {
          id: sketchId( entry ),
          studio: `${ deps.baseUrl }/sketches/${ sketchId( entry ) }`,
          embed: `${ deps.baseUrl }/embed/${ sketchId( entry ) }`,
          size: own?.size ?? null,
          animation: own?.animation ?? null,
          slides: Array.isArray( own?.slides ) ? own.slides.length : 0,
          defaults: loaded.formValues,
          schema: formSchema(
            loaded.formConfiguration,
            loaded.formValues
          )
        };
      }
    },
    {
      id: "render.frame",
      title: "Render one frame",
      description: "Render one frame of a sketch with the given parameters and LOOK at it: answers the picture. Place it with ONE of time (seconds), progress (0–1 through the loop) or frame (index); none = the first frame. Rendering is the recorder's deterministic path, so this frame is the same frame a video would contain. save=true also writes the full-size PNG to outputDir.",
      params: {
        sketch: {
          type: "string",
          description: "Sketch id from sketches.list"
        },
        options: {
          type: "object",
          description: "Parameter delta over the sketch's defaults (see sketches.describe); checked against the sketch's controls",
          optional: true
        },
        time: {
          type: "number",
          description: "Seconds into the loop",
          min: 0,
          max: 600,
          optional: true
        },
        progress: {
          type: "number",
          description: "Position in the loop, 0 = start, 1 = end",
          min: 0,
          max: 1,
          optional: true
        },
        frame: {
          type: "number",
          description: "Frame index",
          min: 0,
          max: 1000000,
          integer: true,
          optional: true
        },
        width: {
          type: "number",
          description: "Canvas width in px (with height); default the sketch's own size",
          ...SIZE,
          integer: true,
          optional: true
        },
        height: {
          type: "number",
          description: "Canvas height in px (with width)",
          ...SIZE,
          integer: true,
          optional: true
        },
        format: {
          type: "string",
          description: "Picture handed back (default jpeg)",
          enum: [
            "jpeg",
            "png"
          ],
          optional: true
        },
        maxEdge: {
          type: "number",
          description: "Longest edge of the picture handed back, px (default 1024); the saved file stays full size",
          min: 64,
          max: 4096,
          integer: true,
          optional: true
        },
        save: {
          type: "boolean",
          description: "Also write the full-size PNG to outputDir and answer its path",
          optional: true
        },
        settleMs: {
          type: "number",
          description: "Live time before the clock is pinned, for shaders to compile and images to decode (default 1000)",
          min: 0,
          max: 30000,
          integer: true,
          optional: true
        }
      },
      available: serverUp,
      async run( params ): Promise<ImageResult> {
        const entry = await sketch( params.sketch );
        const {
          delta
        } = await checkedDelta(
          entry,
          params.options
        );
        const id = sketchId( entry );
        const savePath = params.save
          ? `${ deps.outputDir }/${ safeName( id ) }-${ deps.now() }.png`
          : undefined;
        let result: FrameResult;

        try {
          result = await deps.renderFrame( {
            id,
            options: delta,
            size: sizeOf( params ),
            frame: params.frame as number | undefined,
            time: params.time as number | undefined,
            progress: params.progress as number | undefined,
            format: ( params.format as "jpeg" | "png" | undefined ) ?? "jpeg",
            maxEdge: ( params.maxEdge as number | undefined ) ?? 1024,
            savePath,
            settleMs: ( params.settleMs as number | undefined ) ?? 1000,
            timeoutMs: 120000
          } );
        } catch( error ) {
          if ( error instanceof CommandError ) {
            throw error;
          }

          const message = error instanceof Error ? error.message : String( error );

          // The placement refusals are about the request, not the render.
          throw new CommandError(
            /^(give one of|frame \d+ is past|this server does not report)/.test( message ) ? "invalid" : "failed",
            message
          );
        }

        const clock = result.timing
          ? `frame ${ result.frame } of ${ result.timing.totalFrames } (${ ( result.frame / result.timing.frameRate ).toFixed( 2 ) } s of a ${ result.timing.duration } s loop at ${ result.timing.frameRate } fps)`
          : `frame ${ result.frame }`;
        const notes = [
          `${ id } — ${ clock }, canvas ${ result.sourceWidth }×${ result.sourceHeight }${ result.width !== result.sourceWidth ? `, shown at ${ result.width }×${ result.height }` : "" }.`,
          savePath ? `Full-size PNG saved to ${ savePath }.` : "",
          result.problems.length ? `The page reported: ${ result.problems.slice(
            0,
            5
          ).join( " | " ) }` : "",
          `Open it: ${ result.url }`
        ];

        return {
          kind: "image",
          mimeType: result.mimeType,
          data: result.data,
          width: result.width,
          height: result.height,
          note: notes.filter( Boolean ).join( " " )
        };
      }
    },
    {
      id: "render.video",
      title: "Render a video",
      description: "Queue an MP4 render of a sketch on the server's recording pipeline (headless Chromium + FFmpeg; a sketch's synthesised sound is mixed in). Answers the job id at once — follow it with jobs.wait or jobs.get, then fetch it with jobs.result. One loop of the animation is recorded; duration and framerate set that loop.",
      params: {
        sketch: {
          type: "string",
          description: "Sketch id from sketches.list"
        },
        options: {
          type: "object",
          description: "Parameter delta over the sketch's defaults (see sketches.describe); checked against the sketch's controls",
          optional: true
        },
        width: {
          type: "number",
          description: "Video width in px (with height); default the sketch's own size",
          ...SIZE,
          integer: true,
          optional: true
        },
        height: {
          type: "number",
          description: "Video height in px (with width)",
          ...SIZE,
          integer: true,
          optional: true
        },
        framerate: {
          type: "number",
          description: "Frames per second; default the sketch's own (60 unless it says otherwise)",
          min: 1,
          max: 240,
          integer: true,
          optional: true
        },
        duration: {
          type: "number",
          description: "Loop length in seconds; default the sketch's own (12 unless it says otherwise)",
          min: 1,
          max: 60,
          optional: true
        }
      },
      available: queueUp,
      async run( params ) {
        const entry = await sketch( params.sketch );
        const {
          delta, form: loaded
        } = await checkedDelta(
          entry,
          params.options
        );
        const own = await deps.localOptions( entry ) ?? {};
        const size = sizeOf( params );
        const ownAnimation = isRecord( own.animation ) ? own.animation : {};
        const animation = params.framerate !== undefined || params.duration !== undefined
          ? {
            ...ownAnimation,
            ...( params.framerate !== undefined ? {
              framerate: params.framerate
            } : {} ),
            ...( params.duration !== undefined ? {
              duration: params.duration
            } : {} )
          }
          : own.animation;
        // The page merges these keys over its own defaults (`?id=` in the
        // sketch route), so `sketch` must be the WHOLE parameter object.
        const options: Record<string, unknown> = {
          ...own,
          sketch: mergeOptions(
            loaded.formValues,
            delta
          ),
          ...( size ? {
            size
          } : {} ),
          ...( animation ? {
            animation
          } : {} )
        };
        const body = new FormData();

        body.set(
          "sketch",
          `sketches/${ sketchId( entry ) }`
        );
        body.set(
          "options",
          JSON.stringify( options )
        );
        body.set(
          "status",
          "queued"
        );

        const answer = await getJson(
          "/api/recordings/enqueue",
          {
            method: "POST",
            body
          }
        ) as Record<string, unknown>;

        if ( !answer.success || typeof answer.jobId !== "string" ) {
          throw new CommandError(
            "failed",
            `the server did not queue it: ${ String( answer.error ?? "no job id" ) }`
          );
        }

        return {
          jobId: answer.jobId,
          status: "queued",
          next: "jobs.wait { jobId } until completed, then jobs.result { jobId }"
        };
      }
    },
    {
      id: "jobs.get",
      title: "Job status",
      description: "A recording job's status (draft · queued · active · completed · failed · cancelled), percentage and current step; once completed, the download URLs.",
      params: {
        jobId: {
          type: "string",
          description: "From render.video"
        }
      },
      available: queueUp,
      run: ( params ) => jobState( params.jobId )
    },
    {
      id: "jobs.wait",
      title: "Wait for a job",
      description: "Follow a recording job until it completes, fails or is cancelled, or until timeoutSeconds pass (then answers timedOut: true and the last state — call again to keep waiting).",
      params: {
        jobId: {
          type: "string",
          description: "From render.video"
        },
        timeoutSeconds: {
          type: "number",
          description: "Give up waiting after this long (default 300)",
          min: 1,
          max: 1800,
          optional: true
        }
      },
      available: queueUp,
      async run( params ) {
        const deadline = deps.now() + ( ( params.timeoutSeconds as number | undefined ) ?? 300 ) * 1000;

        for ( ;; ) {
          const state = await jobState( params.jobId );

          if ( TERMINAL.has( String( state.status ) ) ) {
            return state;
          }
          if ( deps.now() >= deadline ) {
            return {
              ...state,
              timedOut: true
            };
          }
          await deps.sleep( 2000 );
        }
      }
    },
    {
      id: "jobs.result",
      title: "Fetch a video",
      description: "Download a completed job's MP4 (one per slide for a multi-slide sketch) into outputDir and answer the local paths and the server URLs.",
      params: {
        jobId: {
          type: "string",
          description: "From render.video"
        }
      },
      available: queueUp,
      async run( params ) {
        const state = await jobState( params.jobId );

        if ( state.status !== "completed" ) {
          throw new CommandError(
            "unavailable",
            `job ${ String( params.jobId ) } is ${ String( state.status ) }, not completed — jobs.wait first`
          );
        }

        const result = state.result as { video: string;
          slides?: string[] };
        const urls = result.slides ?? [
          result.video
        ];
        const files: { url: string;
          path: string;
          bytes: number }[] = [];

        for ( const [
          i,
          url
        ] of urls.entries() ) {
          const response = await deps.fetch( url );

          if ( !response.ok ) {
            throw new CommandError(
              "failed",
              `${ url } answered ${ response.status }`
            );
          }

          const bytes = new Uint8Array( await response.arrayBuffer() );
          const path = `${ deps.outputDir }/${ safeName( String( params.jobId ) ) }${ urls.length > 1 ? `-slide-${ i }` : "" }.mp4`;

          await deps.writeFile(
            path,
            bytes
          );
          files.push( {
            url,
            path,
            bytes: bytes.byteLength
          } );
        }

        return {
          jobId: state.jobId,
          sketch: state.sketch,
          files
        };
      }
    }
  ];
}
