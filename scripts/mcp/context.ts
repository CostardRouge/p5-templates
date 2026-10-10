/**
 * What every command file shares: the injected I/O (`CommandDeps`), the HTTP
 * helpers that turn a route's answer into a `CommandError` with the right
 * code, the availability probes, and the lookups (a sketch, its form, a job)
 * several commands need.
 *
 * Every I/O is injected so the commands are tested without a server, a
 * browser or a disk (`__tests__/commands.test.ts`).
 */
import {
  resolveSketch, sketchId, type CatalogEntry
} from "./catalog.ts";
import type {
  FrameRequest, FrameResult
} from "./frameRenderer.ts";
import {
  CommandError, isRecord
} from "./registry.ts";
import {
  checkSketchOptions
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
  /** A local media file the agent hands over (`drafts.*`); refuses what is not one. */
  readMedia: ( path: string ) => Promise<{ bytes: Uint8Array;
    name: string }>;
  sleep: ( ms: number ) => Promise<void>;
  now: () => number;
}

export type Form = {
  formValues: Record<string, unknown>;
  formConfiguration: Record<string, unknown>;
};

export const ENGINES = [
  "p5",
  "gsap",
  "threejs"
] as const;

export const JOB_STATUSES = [
  "draft",
  "queued",
  "active",
  "completed",
  "failed",
  "cancelled"
] as const;

/** The sizes `SketchSizeSchema` allows. */
export const SIZE = {
  min: 50,
  max: 8192
};

const CHECK_TTL_MS = 5000;

export function safeName( value: string ): string {
  return value.replace(
    /[^A-Za-z0-9_-]+/g,
    "-"
  );
}

export function sizeOf( params: Record<string, unknown> ): { width: number;
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

/** The parameters that may not travel together, as one refusal. */
export function refuseWith(
  params: Record<string, unknown>, given: string, others: string[], why: string
): void {
  const clash = others.filter( ( key ) => params[ key ] !== undefined );

  if ( params[ given ] !== undefined && clash.length ) {
    throw new CommandError(
      "invalid",
      `${ clash.join( ", " ) } cannot go with ${ given } — ${ why }`
    );
  }
}

export function createContext( deps: CommandDeps ) {
  type Check = { at: number;
    result: true | string };
  let serverCheck: Check | null = null;
  let queueCheck: Check | null = null;
  const forms = new Map<string, Form>();

  function errorText(
    body: unknown, fallback: string | number
  ): string {
    if ( isRecord( body ) ) {
      if ( typeof body.error === "string" ) {
        return body.error;
      }
      if ( typeof body.reason === "string" ) {
        return body.reason;
      }
    }

    return String( fallback );
  }

  async function request(
    path: string, init?: RequestInit
  ): Promise<Response> {
    try {
      return await deps.fetch(
        `${ deps.baseUrl }${ path }`,
        init
      );
    } catch( error ) {
      throw new CommandError(
        "unavailable",
        `Sketchbook is not reachable at ${ deps.baseUrl } (${ error instanceof Error ? error.message : String( error ) })`
      );
    }
  }

  async function getJson(
    path: string, init?: RequestInit
  ): Promise<unknown> {
    const response = await request(
      path,
      init
    );
    const body = await response.json().catch( () => null );

    if ( !response.ok ) {
      throw new CommandError(
        response.status === 400 || response.status === 404 ? "invalid" : "failed",
        `${ path.split( "?" )[ 0 ] } answered ${ response.status }: ${ errorText(
          body,
          response.statusText
        ) }`
      );
    }

    return body;
  }

  async function probe(
    path: string, cache: Check | null, describe: ( detail: string ) => string
  ): Promise<Check> {
    if ( cache && deps.now() - cache.at < CHECK_TTL_MS ) {
      return cache;
    }

    let result: true | string;

    try {
      const response = await deps.fetch( `${ deps.baseUrl }${ path }` );
      const body = await response.json().catch( () => null );

      result = response.ok ? true : describe( errorText(
        body,
        response.status
      ) );
    } catch( error ) {
      result = describe( error instanceof Error ? error.message : String( error ) );
    }

    return {
      at: deps.now(),
      result
    };
  }

  async function serverUp(): Promise<true | string> {
    serverCheck = await probe(
      "/api/health",
      serverCheck,
      ( detail ) => `Sketchbook is not reachable at ${ deps.baseUrl } (${ detail }) — start it (npm run dev) or point SKETCHBOOK_URL at a running one`
    );

    return serverCheck.result;
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
    queueCheck = await probe(
      "/api/recordings/health",
      queueCheck,
      ( detail ) => `the recording queue at ${ deps.baseUrl } is down (${ detail }) — it needs Redis, Postgres and S3 (docker-compose up -d redis minio postgres)`
    );

    return queueCheck.result;
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

  /** The delta, checked against the sketch's own controls (over `current` values, the defaults by default). */
  async function checkedDelta(
    entry: CatalogEntry, options: unknown, current?: Record<string, unknown>
  ): Promise<{ delta: Record<string, unknown>;
    form: Form }> {
    const loaded = await form( entry );
    const delta = isRecord( options ) ? options : {};

    checkSketchOptions(
      loaded.formConfiguration,
      current ?? loaded.formValues,
      delta
    );

    return {
      delta,
      form: loaded
    };
  }

  /**
   * The whole-document check, by the app's own schema
   * (`POST /api/options/validate`). Refuses with every issue by path.
   */
  /**
   * The whole-document check, by the app's own schema
   * (`POST /api/options/validate`): refuses with every issue by path, and
   * answers the document as the schema parses it — defaults filled in — for
   * the keys given, which is what must be stored (a job's options reach the
   * page unparsed; see `agent-commands.md`).
   */
  async function validateDocument( document: Record<string, unknown> ): Promise<Record<string, unknown>> {
    const verdict = await getJson(
      "/api/options/validate",
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify( document )
      }
    ) as { valid?: boolean;
      issues?: { path: string;
        message: string }[];
      normalized?: Record<string, unknown> };

    if ( !verdict.valid ) {
      const issues = verdict.issues ?? [];

      throw new CommandError(
        "invalid",
        `the document does not fit the options schema — ${ issues.slice(
          0,
          12
        ).map( ( issue ) => `document.${ issue.path }: ${ issue.message }` )
          .join( "; " ) }${ issues.length > 12 ? ` (and ${ issues.length - 12 } more)` : "" } (options.schema describes it)`
      );
    }

    const normalized = isRecord( verdict.normalized ) ? verdict.normalized : document;

    return Object.fromEntries( Object.keys( document ).map( ( key ) => [
      key,
      key in normalized ? normalized[ key ] : document[ key ]
    ] ) );
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

  async function getJob( jobId: unknown ): Promise<Record<string, unknown>> {
    return await getJson( `/api/recordings/${ jobPath( jobId ) }` ) as Record<string, unknown>;
  }

  async function jobState( jobId: unknown ): Promise<Record<string, unknown>> {
    const id = jobPath( jobId );
    const job = await getJob( jobId );
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
      const where = isRecord( progression?.currentStep ) ? progression.currentStep.name : null;

      // `Job.error` holds what the worker caught; a server older than that
      // column only has its log.
      state.failure = typeof job.error === "string" && job.error
        ? job.error
        : `failed${ where ? ` during ${ String( where ) }` : "" } — the reason is in the Sketchbook server's log (this server does not store it)`;
      if ( where ) {
        state.failedStep = where;
      }
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

  return {
    deps,
    request,
    getJson,
    serverUp,
    queueUp,
    sketch,
    form,
    checkedDelta,
    validateDocument,
    jobPath,
    getJob,
    jobState
  };
}

export type Context = ReturnType<typeof createContext>;
