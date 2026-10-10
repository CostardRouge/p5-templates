/**
 * Export, as the Export dialog does it: the same per-sketch variant list (a
 * variant an agent adds shows up in the dialog, and the other way round) and
 * the same runner, `runExportBatch` — every variant re-lays the sketch out at
 * its own size and framerate, then the sketch is put back as it was. The files
 * never download in the tab: each one goes to the relay, which writes it on the
 * person's disk (`--out`, by default ~/Movies/Sketchbook).
 */
import {
  CommandError, type CommandSpec, type ParamSpecs
} from "../../../../scripts/mcp/registry.ts";
import type {
  ExportItemState
} from "../../export/runExportBatch";
import type {
  ExportVariant
} from "../../export/variants";
import type {
  StudioHandles
} from "../handles";

/** The fields of a variant an agent may set — the dialog's row editor's. */
const VARIANT_FIELDS: ParamSpecs = {
  name: {
    type: "string",
    description: "Shown in the dialog and used in the file name",
    optional: true
  },
  kind: {
    type: "string",
    description: "video (the loop, encoded), image (one PNG of the current frame) or frames (evenly sampled PNGs, zipped)",
    enum: [
      "video",
      "image",
      "frames"
    ],
    optional: true
  },
  format: {
    type: "string",
    description: "Video container (video only)",
    enum: [
      "mp4",
      "webm",
      "gif"
    ],
    optional: true
  },
  width: {
    type: "number",
    description: "Render width, px — with height; the sketch re-lays itself out at that size",
    min: 16,
    max: 8192,
    integer: true,
    optional: true
  },
  height: {
    type: "number",
    description: "Render height, px — with width",
    min: 16,
    max: 8192,
    integer: true,
    optional: true
  },
  sketchSize: {
    type: "boolean",
    description: "true: follow the sketch's own size (drops width/height)",
    optional: true
  },
  framerate: {
    type: "number",
    description: "Capture fps, at most the sketch's own rate (omit for that rate)",
    min: 1,
    max: 240,
    integer: true,
    optional: true
  },
  frameCount: {
    type: "number",
    description: "Frames to sample (frames only)",
    min: 1,
    max: 10000,
    integer: true,
    optional: true
  },
  allFrames: {
    type: "boolean",
    description: "true: every frame of the loop (frames only; drops frameCount)",
    optional: true
  },
  slides: {
    type: "string",
    description: "Which slides: the one on screen, or all of them",
    enum: [
      "current",
      "all"
    ],
    optional: true
  },
  delivery: {
    type: "string",
    description: "Several slides as a video: one file each (zipped) or one continuous file",
    enum: [
      "separate",
      "combined"
    ],
    optional: true
  },
  sizeStrategy: {
    type: "string",
    description: "Slides of different sizes, no width/height given: which size the run takes",
    enum: [
      "smallest",
      "biggest",
      "root"
    ],
    optional: true
  }
};

/** Params → a variant patch; refuses what the runner would silently bend. */
export function variantPatch(
  h: StudioHandles, params: Record<string, unknown>
): Partial<ExportVariant> {
  const patch: Partial<ExportVariant> = {};

  if ( typeof params.name === "string" ) {
    const name = params.name.trim();

    if ( !name || name.length > 80 ) {
      throw new CommandError(
        "invalid",
        "a variant name is 1 to 80 characters"
      );
    }
    patch.name = name;
  }

  for ( const key of [
    "kind",
    "format",
    "slides",
    "delivery",
    "sizeStrategy"
  ] as const ) {
    if ( params[ key ] !== undefined ) {
      ( patch as Record<string, unknown> )[ key ] = params[ key ];
    }
  }

  if ( ( params.width === undefined ) !== ( params.height === undefined ) ) {
    throw new CommandError(
      "invalid",
      "give width and height together"
    );
  }
  if ( params.sketchSize && params.width !== undefined ) {
    throw new CommandError(
      "invalid",
      "give either width/height or sketchSize, not both"
    );
  }
  if ( params.width !== undefined ) {
    patch.size = {
      width: params.width as number,
      height: params.height as number
    };
  } else if ( params.sketchSize ) {
    patch.size = null;
  }

  if ( params.framerate !== undefined ) {
    const native = h.exports.nativeFramerate();

    // The runner would quietly cap it: a capture is a resample of the loop.
    if ( ( params.framerate as number ) > native ) {
      throw new CommandError(
        "invalid",
        `framerate ${ params.framerate } is above the sketch's own ${ native } fps — a capture cannot add frames the sketch does not draw`
      );
    }
    patch.framerate = params.framerate as number;
  }

  if ( params.allFrames && params.frameCount !== undefined ) {
    throw new CommandError(
      "invalid",
      "give either frameCount or allFrames, not both"
    );
  }
  if ( params.allFrames ) {
    patch.frameCount = "all";
  } else if ( params.frameCount !== undefined ) {
    patch.frameCount = params.frameCount as number;
  }

  return patch;
}

function describe( variant: ExportVariant ) {
  return {
    id: variant.id,
    name: variant.name,
    kind: variant.kind,
    size: variant.size ?? "the sketch's own",
    framerate: variant.framerate ?? "the sketch's own",
    ...( variant.kind === "video" ? {
      format: variant.format
    } : {} ),
    ...( variant.kind === "frames" ? {
      frameCount: variant.frameCount
    } : {} ),
    slides: variant.slides,
    ...( variant.slides !== "current" && variant.kind === "video" ? {
      delivery: variant.delivery
    } : {} )
  };
}

function presetKeys( h: StudioHandles ): string {
  return h.exports.presets.map( ( preset ) => preset.key ).join( ", " );
}

function knownPreset(
  h: StudioHandles, key: unknown
): string {
  if ( !h.exports.presets.some( ( preset ) => preset.key === key ) ) {
    throw new CommandError(
      "invalid",
      `no preset "${ String( key ) }" — ${ presetKeys( h ) }`
    );
  }

  return key as string;
}

function variantById(
  h: StudioHandles, id: unknown
): ExportVariant {
  const list = h.exports.list();
  const variant = list.find( ( candidate ) => candidate.id === id );

  if ( !variant ) {
    throw new CommandError(
      "invalid",
      `no variant "${ String( id ) }" — ${ list.length ? list.map( ( candidate ) => `${ candidate.id } (${ candidate.name })` ).join( ", " ) : "the list is empty" }`
    );
  }

  return variant;
}

type Saved = { variant: string;
  path: string;
  bytes: number };

/** The one run in flight, so a second is refused and `export.cancel` reaches it. */
let current: { controller: AbortController;
  items: ExportItemState[];
  names: Record<string, string> } | null = null;

export function exportCommands( h: StudioHandles ): CommandSpec[] {
  const supported = () => h.exports.supported();

  return [
    {
      id: "export.variants",
      title: "Export variants",
      description: "The Export dialog's list for this sketch (what export.run runs by default) and the presets a variant starts from.",
      run: () => ( {
        variants: h.exports.list().map( describe ),
        presets: h.exports.presets.map( ( preset ) => ( {
          key: preset.key,
          label: preset.label,
          size: preset.size ?? "the sketch's own",
          kind: preset.kind ?? "video"
        } ) )
      } )
    },
    {
      id: "export.add",
      title: "Add an export variant",
      description: "Add a variant to the Export dialog's list from a preset (export.variants lists them), with any field changed on the way.",
      params: {
        preset: {
          type: "string",
          description: "Preset key: reel, post, square, landscape, current, still"
        },
        ...VARIANT_FIELDS
      },
      run( params ) {
        const preset = knownPreset(
          h,
          params.preset
        );
        const patch = variantPatch(
          h,
          params
        );
        const variant = h.exports.add( preset );

        h.exports.patch(
          variant.id,
          patch
        );

        return describe( {
          ...variant,
          ...patch
        } );
      }
    },
    {
      id: "export.update",
      title: "Change an export variant",
      description: "Change a variant in the list: size, framerate, kind, format, frame count, slides…",
      params: {
        id: {
          type: "string",
          description: "Variant id (export.variants)"
        },
        ...VARIANT_FIELDS
      },
      run( params ) {
        const variant = variantById(
          h,
          params.id
        );
        const patch = variantPatch(
          h,
          params
        );

        h.exports.patch(
          variant.id,
          patch
        );

        return describe( {
          ...variant,
          ...patch
        } );
      }
    },
    {
      id: "export.remove",
      title: "Remove an export variant",
      description: "Take a variant out of the Export dialog's list.",
      params: {
        id: {
          type: "string",
          description: "Variant id (export.variants)"
        }
      },
      run( params ) {
        const variant = variantById(
          h,
          params.id
        );

        h.exports.remove( variant.id );

        return {
          removed: variant.id,
          variants: h.exports.list().map( describe )
        };
      }
    },
    {
      id: "export.run",
      title: "Export",
      description: "Render and save files, as the Export button does: the variants named by id, or one one-off variant from a preset (with fields), or the whole list. Each file is written by the relay on the person's disk; the answer lists the paths. Long videos take minutes — the tab must stay open and visible.",
      available: () => {
        const ok = supported();

        if ( ok !== true ) {
          return ok;
        }
        if ( !h.relayConnected() ) {
          return "the relay is not connected — files would have nowhere to go";
        }

        return current ? "an export is already running — export.status follows it, export.cancel stops it" : true;
      },
      params: {
        ids: {
          type: "strings",
          description: "Variant ids to run (default: every variant in the list)",
          optional: true
        },
        preset: {
          type: "string",
          description: "Run ONE variant from this preset instead, without adding it to the list",
          optional: true
        },
        folder: {
          type: "string",
          description: "Sub-folder of the relay's output folder",
          optional: true
        },
        ...VARIANT_FIELDS
      },
      async run( params ) {
        const fields = Object.keys( VARIANT_FIELDS ).filter( ( key ) => params[ key ] !== undefined );
        let variants: ExportVariant[];

        if ( params.preset !== undefined ) {
          if ( params.ids !== undefined ) {
            throw new CommandError(
              "invalid",
              "give ids or preset, not both"
            );
          }
          variants = [
            {
              ...h.exports.make( knownPreset(
                h,
                params.preset
              ) ),
              ...variantPatch(
                h,
                params
              )
            }
          ];
        } else {
          if ( fields.length ) {
            throw new CommandError(
              "invalid",
              `${ fields.join( ", " ) } shape a one-off variant: give a preset with them, or change a listed one with export.update`
            );
          }
          variants = params.ids === undefined
            ? h.exports.list()
            : ( params.ids as string[] ).map( ( id ) => variantById(
              h,
              id
            ) );
        }
        if ( !variants.length ) {
          throw new CommandError(
            "invalid",
            "the Export list is empty — export.add a variant, or give a preset"
          );
        }

        const controller = new AbortController();
        const saved: Saved[] = [];
        const writes: Promise<void>[] = [];
        const names = Object.fromEntries( variants.map( ( variant ) => [
          variant.id,
          variant.name
        ] ) );

        current = {
          controller,
          items: [],
          names
        };

        try {
          const items = await h.exports.run(
            variants,
            (
              variantId, artifacts
            ) => {
              // Sent as each variant lands, so a cancel later keeps these.
              for ( const artifact of artifacts ) {
                writes.push( h.saveFile(
                  artifact.blob,
                  artifact.fileName,
                  params.folder as string | undefined
                ).then( ( file ) => {
                  saved.push( {
                    variant: names[ variantId ],
                    ...file
                  } );
                } ) );
              }
            },
            ( progress ) => {
              if ( current ) {
                current.items = progress;
              }
            },
            controller.signal
          );

          await Promise.all( writes );

          return {
            variants: items.map( ( item ) => ( {
              variant: names[ item.variantId ],
              status: item.status,
              ...( item.error ? {
                error: item.error
              } : {} )
            } ) ),
            files: saved
          };
        } catch( error ) {
          await Promise.allSettled( writes );
          if ( error instanceof DOMException && error.name === "AbortError" ) {
            throw new CommandError(
              "failed",
              `export cancelled${ saved.length ? ` — kept ${ saved.map( ( file ) => file.path ).join( ", " ) }` : "" }`
            );
          }
          throw error;
        } finally {
          current = null;
        }
      }
    },
    {
      id: "export.status",
      title: "Export progress",
      description: "Where the running export is: each variant's status, phase and percentage.",
      available: () => current ? true : "no export is running",
      run: () => ( current?.items ?? [] ).map( ( item ) => ( {
        variant: current?.names[ item.variantId ],
        status: item.status,
        phase: item.phase,
        percentage: Math.round( item.percentage ),
        ...( item.frame !== undefined ? {
          frame: item.frame,
          totalFrames: item.totalFrames
        } : {} )
      } ) )
    },
    {
      id: "export.cancel",
      title: "Cancel the export",
      description: "Stop the running export; files already written stay, the sketch goes back as it was.",
      available: () => current ? true : "no export is running",
      run() {
        current?.controller.abort();

        return {
          cancelled: true
        };
      }
    }
  ];
}
