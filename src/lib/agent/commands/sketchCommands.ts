/**
 * The sketch's own parameters, the canvas and its clock, the history, the
 * transport and the snapshot — every one through the control's own funnel
 * (`handles.ts`).
 */
import {
  CommandError, isRecord, type CommandSpec, type ImageResult
} from "../../../../scripts/mcp/registry.ts";
import {
  checkSketchOptions, formSchema
} from "../../../../scripts/mcp/sketchForm.ts";
import {
  leafWrites, sketchBase, type StudioHandles
} from "../handles";
import {
  sketchPathOf
} from "./navigationCommands";

const SLIDE_PARAM = {
  slide: {
    type: "number" as const,
    description: "Slide index (default: the active slide, or the root when there are no slides)",
    min: 0,
    max: 999,
    integer: true,
    optional: true
  }
};

function slideCount( h: StudioHandles ): number {
  const slides = h.getValues( "slides" );

  return Array.isArray( slides ) ? slides.length : 0;
}

/** The slide a command addresses: the one named, or the active one; refused past the deck. */
export function targetSlide(
  h: StudioHandles, given: unknown
): number | undefined {
  if ( given === undefined ) {
    return h.activeSlide();
  }

  const count = slideCount( h );

  if ( ( given as number ) >= count ) {
    throw new CommandError(
      "invalid",
      count ? `slide ${ given } does not exist — slides 0 to ${ count - 1 }` : "this piece has no slides — slides.add makes one"
    );
  }

  return given as number;
}

function scopeLabel( slide: number | undefined ): string {
  return slide === undefined ? "the root" : `slide ${ slide }`;
}

function sketchValues(
  h: StudioHandles, slide: number | undefined
): Record<string, unknown> {
  const values = h.getValues( sketchBase( slide ) );

  return isRecord( values ) ? values : h.formValues;
}

/** One macrotask: what a write set in motion has rendered by then. */
export function settle(): Promise<void> {
  return new Promise( ( resolve ) => setTimeout(
    resolve,
    0
  ) );
}

export function sketchCommands( h: StudioHandles ): CommandSpec[] {
  return [
    {
      id: "studio.status",
      title: "Status",
      description: "What the tab shows: the sketch, its slides and the active one, canvas size and clock, playback, the number of content items, undo/redo, whether exports can reach the relay. Call first.",
      run() {
        const slides = h.getValues( "slides" );
        const active = h.activeSlide();
        const scope = active === undefined ? "" : `slides.${ active }.`;
        const content = h.getValues( "content" );
        const slideContent = active === undefined ? null : h.getValues( `slides.${ active }.content` );

        return {
          sketch: h.sketchId,
          engine: h.engineId,
          slides: Array.isArray( slides ) ? slides.length : 0,
          activeSlide: active ?? null,
          size: h.getValues( `${ scope }size` ) ?? h.getValues( "size" ),
          animation: h.getValues( `${ scope }animation` ) ?? h.getValues( "animation" ),
          playing: h.playback.isPlaying(),
          progress: h.playback.progress(),
          contentItems: {
            global: Array.isArray( content ) ? content.length : 0,
            ...( slideContent !== null ? {
              activeSlide: Array.isArray( slideContent ) ? slideContent.length : 0
            } : {} )
          },
          canUndo: h.history.canUndo(),
          canRedo: h.history.canRedo(),
          relay: h.relayConnected() ? "connected — exports and saved snapshots are written by the relay" : "not connected"
        };
      }
    },
    {
      id: "sketch.describe",
      title: "Describe the sketch",
      description: "What the sketch is (its description and tags, when someone has written them) and its parameters as JSON Schema (ranges, choices, labels, defaults) with their CURRENT values on a slide (or the root). sketch.set takes any nested subset of these.",
      params: SLIDE_PARAM,
      run( params ) {
        const slide = targetSlide(
          h,
          params.slide
        );
        const entry = h.navigation.catalogue().find( ( candidate ) => sketchPathOf( candidate ) === h.sketchId );

        return {
          sketch: h.sketchId,
          description: entry?.description ?? null,
          tags: entry?.tags ?? [],
          scope: scopeLabel( slide ),
          values: sketchValues(
            h,
            slide
          ),
          schema: formSchema(
            h.formConfiguration,
            sketchValues(
              h,
              slide
            )
          )
        };
      }
    },
    {
      id: "sketch.set",
      title: "Set parameters",
      description: "Change the sketch's parameters — a nested subset of sketch.describe — on the active slide (or the one named, or the root). Each value goes through its control's own range: out of range is refused, never clamped. Undoable like a click.",
      params: {
        values: {
          type: "object",
          description: "Nested parameter delta, e.g. { \"render\": { \"palette\": \"sunset\" } }"
        },
        ...SLIDE_PARAM
      },
      run( params ) {
        const slide = targetSlide(
          h,
          params.slide
        );
        const values = params.values as Record<string, unknown>;

        checkSketchOptions(
          h.formConfiguration,
          sketchValues(
            h,
            slide
          ),
          values
        );

        const writes = leafWrites(
          sketchBase( slide ),
          values
        );

        for ( const [
          path,
          value
        ] of writes ) {
          h.setValue(
            path,
            value
          );
        }

        return {
          scope: scopeLabel( slide ),
          written: writes.map( ( [
            path
          ] ) => path )
        };
      }
    },
    {
      id: "sketch.reset",
      title: "Reset parameters",
      description: "Put the sketch's parameters back to their stock defaults on a slide (or the root), as the reset button does.",
      params: SLIDE_PARAM,
      run( params ) {
        const slide = targetSlide(
          h,
          params.slide
        );

        h.setValue(
          sketchBase( slide ),
          structuredClone( h.formValues )
        );

        return {
          scope: scopeLabel( slide ),
          reset: true
        };
      }
    },
    {
      id: "sketch.randomize",
      title: "Randomize parameters",
      description: "Draw every parameter at random within its control's range, as the dice button does (sketch.describe shows what came out).",
      params: SLIDE_PARAM,
      run( params ) {
        const slide = targetSlide(
          h,
          params.slide
        );

        h.randomize( sketchBase( slide ) );

        return {
          scope: scopeLabel( slide ),
          values: sketchValues(
            h,
            slide
          )
        };
      }
    },
    {
      id: "canvas.set",
      title: "Canvas size and clock",
      description: "Set the canvas size (px) and the loop's framerate (fps) and duration (s), on the active slide (or the one named, or the root) — the Format and Animation controls. A slide's own size wins over the root's.",
      params: {
        width: {
          type: "number",
          description: "Canvas width, px",
          min: 50,
          max: 8192,
          integer: true,
          optional: true
        },
        height: {
          type: "number",
          description: "Canvas height, px",
          min: 50,
          max: 8192,
          integer: true,
          optional: true
        },
        framerate: {
          type: "number",
          description: "Frames per second",
          min: 1,
          max: 240,
          integer: true,
          optional: true
        },
        duration: {
          type: "number",
          description: "Loop length, seconds",
          min: 1,
          max: 60,
          optional: true
        },
        ...SLIDE_PARAM
      },
      run( params ) {
        const slide = targetSlide(
          h,
          params.slide
        );
        const prefix = slide === undefined ? "" : `slides.${ slide }.`;
        const written: string[] = [];

        for ( const [
          key,
          path
        ] of [
            [
              "width",
              "size.width"
            ],
            [
              "height",
              "size.height"
            ],
            [
              "framerate",
              "animation.framerate"
            ],
            [
              "duration",
              "animation.duration"
            ]
          ] ) {
          if ( params[ key ] !== undefined ) {
            h.setValue(
              `${ prefix }${ path }`,
              params[ key ]
            );
            written.push( `${ prefix }${ path }` );
          }
        }
        if ( !written.length ) {
          throw new CommandError(
            "invalid",
            "give at least one of width, height, framerate, duration"
          );
        }

        return {
          scope: scopeLabel( slide ),
          written
        };
      }
    },
    {
      id: "document.get",
      title: "Read the document",
      description: "The whole piece as the studio holds it (size, animation, content, slides, sketch parameters…), or one dotted path of it (e.g. \"slides.0.content\").",
      params: {
        path: {
          type: "string",
          description: "Dotted path; omit for the whole document",
          optional: true
        }
      },
      run( params ) {
        return h.getValues( params.path as string | undefined ) ?? null;
      }
    },
    {
      id: "history.undo",
      title: "Undo",
      description: "Undo the last change, as Cmd/Ctrl+Z does — an agent's change included.",
      available: () => h.history.canUndo() || "nothing to undo",
      async run() {
        h.history.undo();
        // The history's flags update on the next render.
        await settle();

        return {
          canUndo: h.history.canUndo(),
          canRedo: h.history.canRedo()
        };
      }
    },
    {
      id: "history.redo",
      title: "Redo",
      description: "Redo the last undone change.",
      available: () => h.history.canRedo() || "nothing to redo",
      async run() {
        h.history.redo();
        // The history's flags update on the next render.
        await settle();

        return {
          canUndo: h.history.canUndo(),
          canRedo: h.history.canRedo()
        };
      }
    },
    {
      id: "playback.play",
      title: "Play",
      description: "Start the animation, as the play button does.",
      run() {
        h.playback.play();

        return {
          playing: true
        };
      }
    },
    {
      id: "playback.pause",
      title: "Pause",
      description: "Pause the animation on the current frame.",
      run() {
        h.playback.pause();

        return {
          playing: false,
          progress: h.playback.progress()
        };
      }
    },
    {
      id: "playback.seek",
      title: "Seek",
      description: "Move to a position in the loop — ONE of progress (0–1) or time (seconds) — and pause there, as scrubbing does. Then studio.snapshot shows that frame.",
      params: {
        progress: {
          type: "number",
          description: "Loop position, 0 = start, 1 = end",
          min: 0,
          max: 1,
          optional: true
        },
        time: {
          type: "number",
          description: "Seconds into the loop",
          min: 0,
          max: 600,
          optional: true
        }
      },
      run( params ) {
        if ( ( params.progress === undefined ) === ( params.time === undefined ) ) {
          throw new CommandError(
            "invalid",
            "give one of progress or time"
          );
        }

        let progress = params.progress as number | undefined;

        if ( progress === undefined ) {
          const timing = h.timing();

          if ( !timing ) {
            throw new CommandError(
              "unavailable",
              "this sketch does not report its clock — give progress instead"
            );
          }
          if ( ( params.time as number ) > timing.duration ) {
            throw new CommandError(
              "invalid",
              `time ${ params.time } s is past the end — the loop is ${ timing.duration } s`
            );
          }
          progress = ( params.time as number ) / timing.duration;
        }
        h.playback.pause();
        h.playback.seek( progress );

        return {
          playing: false,
          progress
        };
      }
    },
    {
      id: "studio.snapshot",
      title: "Snapshot",
      description: "The frame on screen, as a picture you can LOOK at (the camera button's own capture). save=true also writes the full-size PNG through the relay.",
      params: {
        maxEdge: {
          type: "number",
          description: "Longest edge of the picture handed back, px (default 1024)",
          min: 64,
          max: 4096,
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
        save: {
          type: "boolean",
          description: "Also write the full-size PNG through the relay",
          optional: true
        }
      },
      async run( params ): Promise<ImageResult> {
        const blob = await h.snapshot();

        if ( !blob ) {
          throw new CommandError(
            "unavailable",
            "the sketch has no frame to read yet"
          );
        }

        let saved = "";

        if ( params.save ) {
          const file = await h.saveFile(
            blob,
            `${ h.sketchId.split( "/" ).pop() }-${ new Date().toISOString()
              .replace(
                /[:.]/g,
                "-"
              ) }.png`
          );

          saved = ` Saved full size to ${ file.path }.`;
        }

        const progress = h.playback.progress();

        return h.imageResult(
          blob,
          ( params.maxEdge as number | undefined ) ?? 1024,
          ( params.format as "png" | "jpeg" | undefined ) ?? "jpeg",
          `${ h.sketchId }${ h.activeSlide() !== undefined ? `, slide ${ h.activeSlide() }` : "" }${ progress !== null ? `, at ${ ( progress * 100 ).toFixed( 1 ) } % of the loop` : "" }.${ saved }`
        );
      }
    },
    {
      id: "studio.contactSheet",
      title: "Contact sheet of the loop",
      description: "The whole animation in ONE picture: `count` frames evenly spaced through the loop (from `from` to `to`, loop positions 0–1, the end excluded so a closed loop does not repeat its first frame), each labelled with its position, tiled left to right then down — judge the motion in one call instead of many seek + snapshot. The tab is paused, scrubbed, then put back where it was (position and play/pause), even if a frame fails.",
      params: {
        count: {
          type: "number",
          description: "How many frames (default 6)",
          min: 1,
          max: 12,
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
        maxEdge: {
          type: "number",
          description: "Longest edge of the whole sheet handed back, px (default 1024)",
          min: 64,
          max: 4096,
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
        }
      },
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

        const positions = Array.from(
          {
            length: count
          },
          (
            _, i
          ) => from + ( to - from ) * i / count
        );
        const wasPlaying = h.playback.isPlaying();
        const wasAt = h.playback.progress();
        const frames: { blob: Blob;
          label: string }[] = [];

        try {
          h.playback.pause();
          for ( const progress of positions ) {
            h.playback.seek( progress );
            // The seek draws synchronously on a canvas engine; a DOM engine
            // re-rasterises on the next task.
            await settle();

            const blob = await h.snapshot();

            if ( !blob ) {
              throw new CommandError(
                "unavailable",
                `the sketch had no frame to read at ${ ( progress * 100 ).toFixed( 1 ) } % of the loop`
              );
            }
            frames.push( {
              blob,
              label: `${ Math.round( progress * 100 ) } %`
            } );
          }
        } finally {
          // Back where the person left it, whatever happened above.
          if ( wasAt !== null ) {
            h.playback.seek( wasAt );
          }
          if ( wasPlaying ) {
            h.playback.play();
          }
        }

        const timing = h.timing();

        return h.contactSheet(
          frames,
          ( params.maxEdge as number | undefined ) ?? 1024,
          ( params.format as "png" | "jpeg" | undefined ) ?? "jpeg",
          `${ h.sketchId }${ h.activeSlide() !== undefined ? `, slide ${ h.activeSlide() }` : "" } — ${ count } frames at ${ positions.map( ( progress ) => `${ Math.round( progress * 100 ) } %` ).join( ", " ) } of the loop${ timing ? ` (${ timing.duration } s at ${ timing.frameRate } fps)` : "" }; the tab is back at ${ wasAt === null ? "where it was" : `${ ( wasAt * 100 ).toFixed( 1 ) } %` }, ${ wasPlaying ? "playing" : "paused" }.`
        );
      }
    }
  ];
}
