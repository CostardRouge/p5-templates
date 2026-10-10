/**
 * `jobs.*` — follow a recording, fetch what it made, list and cancel jobs.
 * The routes are the recordings dashboard's own.
 */
import {
  JOB_STATUSES, safeName, type Context
} from "./context.ts";
import {
  CommandError, isRecord, type CommandSpec
} from "./registry.ts";

const TERMINAL = new Set( [
  "completed",
  "failed",
  "cancelled"
] );

export function jobCommands( ctx: Context ): CommandSpec[] {
  const {
    deps
  } = ctx;

  return [
    {
      id: "jobs.get",
      title: "Job status",
      description: "A recording job's status (draft · queued · active · completed · failed · cancelled), percentage and current step; once completed, the download URLs; once failed, the step it died in.",
      params: {
        jobId: {
          type: "string",
          description: "From render.video"
        }
      },
      available: ctx.queueUp,
      run: ( params ) => ctx.jobState( params.jobId )
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
      available: ctx.queueUp,
      async run( params ) {
        const deadline = deps.now() + ( ( params.timeoutSeconds as number | undefined ) ?? 300 ) * 1000;

        for ( ;; ) {
          const state = await ctx.jobState( params.jobId );

          if ( TERMINAL.has( String( state.status ) ) ) {
            return state;
          }
          if ( state.status === "draft" ) {
            throw new CommandError(
              "invalid",
              `${ String( params.jobId ) } is a draft, nothing is recording — render.video { draft } records it`
            );
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
      description: "Download a completed job's MP4 (one per slide for a multi-slide piece) into outputDir and answer the local paths and the server URLs.",
      params: {
        jobId: {
          type: "string",
          description: "From render.video"
        }
      },
      available: ctx.queueUp,
      async run( params ) {
        const state = await ctx.jobState( params.jobId );

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
    },
    {
      id: "jobs.list",
      title: "List jobs",
      description: "Recording jobs and drafts, newest first: id, sketch, status, when.",
      params: {
        status: {
          type: "strings",
          description: `Only these statuses: ${ JOB_STATUSES.join( ", " ) }`,
          optional: true
        },
        limit: {
          type: "number",
          description: "At most this many (default 50)",
          min: 1,
          max: 500,
          integer: true,
          optional: true
        }
      },
      available: ctx.queueUp,
      async run( params ) {
        const statuses = Array.isArray( params.status ) ? params.status as string[] : [];

        for ( const status of statuses ) {
          if ( !( JOB_STATUSES as readonly string[] ).includes( status ) ) {
            throw new CommandError(
              "invalid",
              `"${ status }" is not a status — ${ JOB_STATUSES.join( ", " ) }`
            );
          }
        }

        const jobs = await ctx.getJson( `/api/recordings${ statuses.length ? `?status=${ statuses.join( "," ) }` : "" }` );
        const list = Array.isArray( jobs ) ? jobs.filter( isRecord ) : [];

        return {
          total: list.length,
          jobs: list.slice(
            0,
            ( params.limit as number | undefined ) ?? 50
          ).map( ( job ) => ( {
            jobId: job.id,
            sketch: String( job.sketch ?? "" ).replace(
              /^sketches\//,
              ""
            ),
            status: job.status,
            createdAt: job.createdAt
          } ) )
        };
      }
    },
    {
      id: "jobs.cancel",
      title: "Cancel a job",
      description: "Stop a queued or recording job (the dashboard's Cancel). A draft or a finished job is left as it is.",
      params: {
        jobId: {
          type: "string",
          description: "Job id"
        }
      },
      available: ctx.queueUp,
      async run( params ) {
        const answer = await ctx.getJson(
          `/api/recordings/${ ctx.jobPath( params.jobId ) }/cancel`,
          {
            method: "POST"
          }
        ) as Record<string, unknown>;

        if ( answer.cancelled !== true ) {
          throw new CommandError(
            "invalid",
            `not cancelled: ${ String( answer.reason ?? answer.error ?? "the server said no" ) }`
          );
        }

        return {
          jobId: params.jobId,
          cancelled: true
        };
      }
    }
  ];
}
