/**
 * `render.*` — look at a piece and record it.
 *
 * A frame or a series of stills is rendered in headless Chromium by the
 * recorder's own capture protocol (`frameRenderer.ts`), on one of two pages:
 * the public `/embed` route for a sketch plus a parameter delta, or a draft's
 * studio page — the page the recorder itself loads for a job, so a draft's
 * content items, slides and uploaded media are all there. A video is the
 * server's recording pipeline, unchanged.
 */
import {
  sketchId
} from "./catalog.ts";
import {
  refuseWith, safeName, SIZE, sizeOf, type Context
} from "./context.ts";
import {
  draftUrl, embedUrl, isPlacementRefusal, type FramePlacement, type FrameResult
} from "./frameRenderer.ts";
import {
  CommandError, isRecord, type CommandSpec, type ImageResult, type ParamSpecs
} from "./registry.ts";
import {
  mergeOptions
} from "./sketchForm.ts";

const DEFAULT_VIEWPORT = {
  width: 1080,
  height: 1350
};

const TARGET_PARAMS: ParamSpecs = {
  sketch: {
    type: "string",
    description: "Sketch id from sketches.list — or give draft instead",
    optional: true
  },
  draft: {
    type: "string",
    description: "A draft (drafts.create) to render as it is stored: its document, content, slides and media",
    optional: true
  },
  options: {
    type: "object",
    description: "With sketch: a parameter delta over its defaults (sketches.describe), checked against its controls",
    optional: true
  },
  width: {
    type: "number",
    description: "With sketch: canvas width in px (with height); default the sketch's own size",
    ...SIZE,
    integer: true,
    optional: true
  },
  height: {
    type: "number",
    description: "With sketch: canvas height in px (with width)",
    ...SIZE,
    integer: true,
    optional: true
  }
};

const PICTURE_PARAMS: ParamSpecs = {
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
    description: "Longest edge of the picture handed back, px (default 1024); saved files stay full size",
    min: 64,
    max: 4096,
    integer: true,
    optional: true
  },
  settleMs: {
    type: "number",
    description: "Live time before the clock is pinned, for shaders to compile and media to decode (default 1000; more for heavy media)",
    min: 0,
    max: 30000,
    integer: true,
    optional: true
  }
};

type Target = { url: string;
  viewport: { width: number;
    height: number };
  label: string };

/**
 * The server encodes H.264 in yuv420p, which takes even dimensions only: a
 * 540 × 675 canvas records nothing and the job fails in FFmpeg. Refused here,
 * before a job exists, naming every size at fault.
 */
export function checkVideoSizes( options: Record<string, unknown> ): void {
  const sizes: [ string, unknown ][] = [
    [
      "size",
      options.size
    ],
    ...( Array.isArray( options.slides ) ? options.slides : [] ).map( (
      slide, i
    ): [ string, unknown ] => [
      `slides.${ i }.size`,
      isRecord( slide ) ? slide.size : undefined
    ] )
  ];
  const odd = sizes.filter( ( [
    , size
  ] ) => isRecord( size ) && [
    size.width,
    size.height
  ].some( ( side ) => typeof side === "number" && side % 2 !== 0 ) );

  if ( odd.length ) {
    throw new CommandError(
      "invalid",
      `a video needs even dimensions (H.264, yuv420p) — ${ odd.map( ( [
        where,
        size
      ] ) => `${ where } is ${ ( size as Record<string, unknown> ).width }×${ ( size as Record<string, unknown> ).height }` ).join( ", " ) }`
    );
  }
}

export function renderCommands( ctx: Context ): CommandSpec[] {
  const {
    deps
  } = ctx;

  /** The page to render: a sketch on /embed, or a draft's own capture page. */
  async function target( params: Record<string, unknown> ): Promise<Target> {
    if ( ( params.sketch === undefined ) === ( params.draft === undefined ) ) {
      throw new CommandError(
        "invalid",
        "give sketch or draft (one of them)"
      );
    }
    refuseWith(
      params,
      "draft",
      [
        "options",
        "width",
        "height"
      ],
      "a draft renders as stored; change it with drafts.update"
    );

    if ( params.draft !== undefined ) {
      const job = await ctx.getJob( params.draft );
      const stored = isRecord( job.options ) ? job.options : {};
      const size = isRecord( stored.size ) && typeof stored.size.width === "number" && typeof stored.size.height === "number"
        ? {
          width: stored.size.width,
          height: stored.size.height
        }
        : DEFAULT_VIEWPORT;

      return {
        url: draftUrl(
          deps.baseUrl,
          String( job.sketch ),
          String( job.id )
        ),
        viewport: size,
        label: `draft ${ String( job.id ) } (${ String( job.sketch ).replace(
          /^sketches\//,
          ""
        ) })`
      };
    }

    const entry = await ctx.sketch( params.sketch );
    const {
      delta
    } = await ctx.checkedDelta(
      entry,
      params.options
    );
    const size = sizeOf( params );

    return {
      url: embedUrl(
        deps.baseUrl,
        sketchId( entry ),
        delta,
        size
      ),
      viewport: size ?? DEFAULT_VIEWPORT,
      label: sketchId( entry )
    };
  }

  async function render(
    where: Target, placements: FramePlacement[], params: Record<string, unknown>, savePaths?: string[]
  ): Promise<FrameResult> {
    try {
      return await deps.renderFrame( {
        url: where.url,
        viewport: where.viewport,
        placements,
        format: ( params.format as "jpeg" | "png" | undefined ) ?? "jpeg",
        maxEdge: ( params.maxEdge as number | undefined ) ?? 1024,
        savePaths,
        settleMs: ( params.settleMs as number | undefined ) ?? 1000,
        timeoutMs: 120000
      } );
    } catch( error ) {
      if ( error instanceof CommandError ) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String( error );

      throw new CommandError(
        isPlacementRefusal( message ) ? "invalid" : "failed",
        message
      );
    }
  }

  function clockOf(
    result: FrameResult, frame: number
  ): string {
    return result.timing
      ? `frame ${ frame } of ${ result.timing.totalFrames } (${ ( frame / result.timing.frameRate ).toFixed( 2 ) } s of a ${ result.timing.duration } s loop at ${ result.timing.frameRate } fps)`
      : `frame ${ frame }`;
  }

  function picture(
    result: FrameResult, notes: string[]
  ): ImageResult {
    return {
      kind: "image",
      mimeType: result.mimeType,
      data: result.data,
      width: result.width,
      height: result.height,
      note: [
        ...notes,
        result.problems.length ? `The page reported: ${ result.problems.slice(
          0,
          5
        ).join( " | " ) }` : "",
        `Open it: ${ result.url }`
      ].filter( Boolean ).join( " " )
    };
  }

  function savePath(
    label: string, suffix: string
  ): string {
    return `${ deps.outputDir }/${ safeName( label ) }-${ deps.now() }${ suffix }.png`;
  }

  return [
    {
      id: "render.frame",
      title: "Render one frame",
      description: "Render one frame of a sketch (with a parameter delta) or of a draft (as stored) and LOOK at it: answers the picture. Place it with ONE of time (seconds), progress (0–1 through the loop) or frame (index); none = the first frame. It is the recorder's deterministic path, so this is the frame a video would contain. save=true also writes the full-size PNG — a finished still — to outputDir.",
      params: {
        ...TARGET_PARAMS,
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
        save: {
          type: "boolean",
          description: "Also write the full-size PNG to outputDir and answer its path",
          optional: true
        },
        ...PICTURE_PARAMS
      },
      available: ctx.serverUp,
      async run( params ): Promise<ImageResult> {
        const where = await target( params );
        const file = params.save ? savePath(
          where.label,
          ""
        ) : undefined;
        const result = await render(
          where,
          [
            {
              frame: params.frame as number | undefined,
              time: params.time as number | undefined,
              progress: params.progress as number | undefined
            }
          ],
          params,
          file ? [
            file
          ] : undefined
        );

        return picture(
          result,
          [
            `${ where.label } — ${ clockOf(
              result,
              result.frames[ 0 ]
            ) }, canvas ${ result.sourceWidth }×${ result.sourceHeight }${ result.width !== result.sourceWidth ? `, shown at ${ result.width }×${ result.height }` : "" }.`,
            file ? `Full-size PNG saved to ${ file }.` : ""
          ]
        );
      }
    },
    {
      id: "render.stills",
      title: "Render a series of stills",
      description: "Render `count` frames evenly spaced through the loop (from `from` to `to`, as loop positions 0–1; the end is excluded so a closed loop does not repeat its first frame) in ONE page load, save each as a full-size PNG in outputDir, and answer a contact sheet of all of them in order to look at — finished stills, or a quick read of the whole animation.",
      params: {
        ...TARGET_PARAMS,
        count: {
          type: "number",
          description: "How many frames (default 6)",
          min: 1,
          max: 36,
          integer: true,
          optional: true
        },
        from: {
          type: "number",
          description: "First position in the loop (default 0)",
          min: 0,
          max: 1,
          optional: true
        },
        to: {
          type: "number",
          description: "Last position, excluded (default 1)",
          min: 0,
          max: 1,
          optional: true
        },
        ...PICTURE_PARAMS
      },
      available: ctx.serverUp,
      async run( params ): Promise<ImageResult> {
        const count = ( params.count as number | undefined ) ?? 6;
        const from = ( params.from as number | undefined ) ?? 0;
        const to = ( params.to as number | undefined ) ?? 1;

        if ( to <= from ) {
          throw new CommandError(
            "invalid",
            `"to" (${ to }) must be after "from" (${ from })`
          );
        }

        const where = await target( params );
        const placements = Array.from(
          {
            length: count
          },
          (
            _, i
          ) => ( {
            progress: from + ( to - from ) * i / count
          } )
        );
        const stamp = savePath(
          where.label,
          ""
        ).replace(
          /\.png$/,
          ""
        );
        const files = placements.map( (
          _, i
        ) => `${ stamp }-${ String( i + 1 ).padStart(
          2,
          "0"
        ) }.png` );
        const result = await render(
          where,
          placements,
          params,
          files
        );

        return picture(
          result,
          [
            `${ where.label } — ${ count } stills, canvas ${ result.sourceWidth }×${ result.sourceHeight }, left to right then down: ${ result.frames.map( ( frame ) => clockOf(
              result,
              frame
            ).replace(
              / of a .*$/,
              ")"
            ) ).join( "; " ) }.`,
            `Saved: ${ files.join( ", " ) }.`
          ]
        );
      }
    },
    {
      id: "render.video",
      title: "Render a video",
      description: "Queue an MP4 on the server's recording pipeline (headless Chromium + FFmpeg; a sketch's synthesised sound is mixed in; one MP4 per slide for a multi-slide draft). With sketch: parameters, size and clock given here. With draft: the draft as stored — it is recorded from a copy, so the draft stays editable. Answers the job id at once — follow with jobs.wait, fetch with jobs.result.",
      params: {
        ...TARGET_PARAMS,
        framerate: {
          type: "number",
          description: "With sketch: frames per second; default the sketch's own (60 unless it says otherwise)",
          min: 1,
          max: 240,
          integer: true,
          optional: true
        },
        duration: {
          type: "number",
          description: "With sketch: loop length in seconds; default the sketch's own (12 unless it says otherwise)",
          min: 1,
          max: 60,
          optional: true
        }
      },
      available: ctx.queueUp,
      async run( params ) {
        if ( ( params.sketch === undefined ) === ( params.draft === undefined ) ) {
          throw new CommandError(
            "invalid",
            "give sketch or draft (one of them)"
          );
        }
        refuseWith(
          params,
          "draft",
          [
            "options",
            "width",
            "height",
            "framerate",
            "duration"
          ],
          "a draft records as stored; change it with drafts.update"
        );

        if ( params.draft !== undefined ) {
          const job = await ctx.getJob( params.draft );

          checkVideoSizes( isRecord( job.options ) ? job.options : {} );

          // A job is recorded once: start a copy, keep the draft to edit.
          const copy = await ctx.getJson(
            `/api/recordings/${ ctx.jobPath( params.draft ) }/clone`,
            {
              method: "POST"
            }
          ) as Record<string, unknown>;

          if ( typeof copy.jobId !== "string" ) {
            throw new CommandError(
              "failed",
              `the server did not copy the draft: ${ String( copy.error ?? "no job id" ) }`
            );
          }
          await ctx.getJson(
            `/api/recordings/${ ctx.jobPath( copy.jobId ) }/start`,
            {
              method: "POST"
            }
          );

          return {
            jobId: copy.jobId,
            fromDraft: params.draft,
            status: "queued",
            next: "jobs.wait { jobId } until completed, then jobs.result { jobId }"
          };
        }

        const entry = await ctx.sketch( params.sketch );
        const {
          delta, form
        } = await ctx.checkedDelta(
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
        // The page assigns these keys over its own defaults (`?id=` in the
        // sketch route), so `sketch` must be the WHOLE parameter object.
        const options: Record<string, unknown> = {
          ...own,
          sketch: mergeOptions(
            form.formValues,
            delta
          ),
          ...( size ? {
            size
          } : {} ),
          ...( animation ? {
            animation
          } : {} )
        };

        checkVideoSizes( options );

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

        const answer = await ctx.getJson(
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
    }
  ];
}
