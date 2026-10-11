/**
 * Interactive bindings from the tab: list what drives a sketch parameter, bind
 * one to a generator or a live channel, edit or remove a layer — through the
 * binding affordance's own write path (`bindingWrites.ts`), so an agent's
 * binding is stored, enabled and pruned exactly as a click's.
 *
 * A binding is data in the `interactive` namespace beside the sketch scope
 * (`interactive.bindings`, `slides.N.interactive.bindings`), resolved by the
 * engine at read time (`interaction-bindings.md`); the sketch's own parameters
 * never see the modulated value, so `sketch.describe` keeps showing the base.
 */
import {
  CommandError, isRecord, type CommandSpec
} from "../../../../scripts/mcp/registry.ts";
import {
  sketchBase, type StudioHandles
} from "../handles";
import {
  targetSlide
} from "./sketchCommands";

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

/** The keys an agent may give or change on a binding; the rest is derived. */
const EDITABLE_KEYS = [
  "source",
  "project",
  "enabled",
  "weight",
  "blend",
  "solo",
  "smoothing",
  "mapping",
  "oscillator",
  "ramp",
  "sequence",
  "noise",
  "random"
] as const;

const BLENDS = [
  "replace",
  "add",
  "multiply",
  "max",
  "min",
  "average"
];

function scopeLabel( slide: number | undefined ): string {
  return slide === undefined ? "the root" : `slide ${ slide }`;
}

/** The scope's binding list as stored (a copy), or an empty one. */
export function bindingsOf(
  h: StudioHandles, slide: number | undefined
): Record<string, unknown>[] {
  const stored = h.getValues( `${ h.bindings.scope( slide ) }.bindings` );

  return Array.isArray( stored ) ? stored.filter( isRecord ).map( ( binding ) => ( {
    ...binding
  } ) ) : [];
}

function existing(
  h: StudioHandles, slide: number | undefined, index: unknown
): number {
  const count = bindingsOf(
    h,
    slide
  ).length;

  if ( ( index as number ) >= count ) {
    throw new CommandError(
      "invalid",
      count ? `no binding ${ String( index ) } on ${ scopeLabel( slide ) } — bindings 0 to ${ count - 1 } (bindings.list)` : `${ scopeLabel( slide ) } has no bindings — bindings.add makes one`
    );
  }

  return index as number;
}

/**
 * Walk the sketch's controls for the ones a binding can drive, as the field
 * renderer decides it (`bindingKindFor` on the control's component).
 */
export function bindableTargets( h: StudioHandles ): { target: string;
  kind: string;
  component: string;
  label?: string }[] {
  const out: { target: string;
    kind: string;
    component: string;
    label?: string }[] = [];
  const walk = (
    fields: Record<string, unknown>, prefix: string
  ) => {
    for ( const [
      key,
      value
    ] of Object.entries( fields ) ) {
      if ( !isRecord( value ) ) {
        continue;
      }
      const target = prefix ? `${ prefix }.${ key }` : key;
      const nested = value.fields;

      if ( isRecord( nested ) ) {
        walk(
          nested,
          target
        );
        continue;
      }
      const component = typeof value.component === "string" ? value.component : "";
      const kind = h.bindings.kindFor( component );

      if ( kind ) {
        out.push( {
          target,
          kind,
          component,
          ...( typeof value.label === "string" ? {
            label: value.label
          } : {} )
        } );
      }
    }
  };

  walk(
    h.formConfiguration,
    ""
  );

  return out;
}

/** `fields` checked: known keys only, a blend from the list, numbers where numbers go. */
function checkFields( fields: Record<string, unknown> ): void {
  for ( const key of Object.keys( fields ) ) {
    if ( !( EDITABLE_KEYS as readonly string[] ).includes( key ) ) {
      throw new CommandError(
        "invalid",
        `unknown binding field "${ key }" — a binding takes ${ EDITABLE_KEYS.join( ", " ) } (target and kind come from the control)`
      );
    }
  }
  if ( fields.blend !== undefined && !BLENDS.includes( String( fields.blend ) ) ) {
    throw new CommandError(
      "invalid",
      `blend "${ String( fields.blend ) }" — one of ${ BLENDS.join( ", " ) }`
    );
  }
  for ( const key of [
    "weight",
    "smoothing"
  ] ) {
    const value = fields[ key ];

    if ( value !== undefined && ( typeof value !== "number" || value < 0 || value > 1 ) ) {
      throw new CommandError(
        "invalid",
        `${ key } must be a number from 0 to 1`
      );
    }
  }
  for ( const key of [
    "enabled",
    "solo"
  ] ) {
    if ( fields[ key ] !== undefined && typeof fields[ key ] !== "boolean" ) {
      throw new CommandError(
        "invalid",
        `${ key } must be true or false`
      );
    }
  }
  for ( const key of [
    "mapping",
    "oscillator",
    "ramp",
    "sequence",
    "noise",
    "random"
  ] ) {
    if ( fields[ key ] !== undefined && !isRecord( fields[ key ] ) ) {
      throw new CommandError(
        "invalid",
        `${ key } must be an object`
      );
    }
  }
}

/** A source an agent named, checked against what the kind's picker offers. */
function checkSource(
  h: StudioHandles, kind: string, source: unknown, project: unknown
): void {
  if ( source === undefined ) {
    return;
  }
  const options = h.bindings.sources( kind );
  const match = options.find( ( option ) => option.source === source && ( option.project ?? undefined ) === ( project ?? undefined ) );

  if ( !match ) {
    const sources = [
      ...new Set( options.map( ( option ) => option.project ? `${ option.source } (project ${ option.project })` : option.source ) )
    ];

    throw new CommandError(
      "invalid",
      `source "${ String( source ) }"${ project ? ` with project "${ String( project ) }"` : "" } cannot drive a ${ kind } target — one of: ${ sources.join( ", " ) }`
    );
  }
}

export function bindingCommands( h: StudioHandles ): CommandSpec[] {
  const available = () => h.bindings.enabled();

  return [
    {
      id: "bindings.targets",
      title: "Bindable parameters",
      description: "Which of the sketch's parameters a binding can drive, as sketch-relative targets (e.g. \"render.hueSpeed\") with the binding kind each takes — continuous (slider, number), boolean (checkbox), enum (select, palette), color, vector2d (pad), vector3d (box) — and the sources a kind accepts: generators (oscillator, ramp, sequence, noise, random — run off the loop clock, so they survive an export) and live channels (mouse, touch, audio.*, midi.cc*, gyroscope, hands… — a vector2d target takes a vector channel, a scalar target projects one with x, y, mag or angle).",
      available,
      run() {
        const targets = bindableTargets( h );
        const kinds = [
          ...new Set( targets.map( ( target ) => target.kind ) )
        ];

        return {
          targets,
          sources: Object.fromEntries( kinds.map( ( kind ) => [
            kind,
            h.bindings.sources( kind ).map( ( option ) => option.project ? {
              source: option.source,
              project: option.project,
              label: option.label
            } : {
              source: option.source,
              label: option.label
            } )
          ] ) )
        };
      }
    },
    {
      id: "bindings.list",
      title: "List bindings",
      description: "The bindings playing on a slide (or the root): index, target, kind, source, enabled, weight, blend, mapping, smoothing and the generator's settings. bindings.update and bindings.remove take the index.",
      params: SLIDE_PARAM,
      available,
      run( params ) {
        const slide = targetSlide(
          h,
          params.slide
        );
        const bindings = bindingsOf(
          h,
          slide
        );

        return {
          scope: scopeLabel( slide ),
          count: bindings.length,
          bindings: bindings.map( (
            binding, index
          ) => ( {
            index,
            ...binding
          } ) )
        };
      }
    },
    {
      id: "bindings.add",
      title: "Bind a parameter",
      description: "Drive a sketch parameter from a source, as the field's binding button does: a new layer on `target` (a sketch-relative path from bindings.targets) with the editor's own defaults for that control — an oscillator over the control's whole range, one cycle per loop — then `source` (and `project` for a vector channel on a scalar target) and `fields` over them: mapping { min, max, curve } (per axis for a pad, { from, to } colours for a colour, { values } for an enum, { threshold, hysteresis, mode } for a boolean), smoothing 0–1, weight 0–1, blend, enabled, and the generator's block (oscillator { wave, cycles, phase }, ramp { easing, count, phase, yoyo }, sequence { stops, cycles, mode }, noise { speed, seed }, random { steps, seed }). A live source switches its input on (camera, mic, MIDI…); the engine publishes the driven value every frame, while sketch.describe keeps showing the base value.",
      params: {
        target: {
          type: "string",
          description: "Sketch-relative parameter path, e.g. \"render.hueSpeed\" (bindings.targets lists them)"
        },
        source: {
          type: "string",
          description: "Generator (oscillator, ramp, sequence, noise, random) or channel id (mouse, audio.bass, midi.cc29…); default: the control's own (oscillator, or the first vector channel for a pad)",
          optional: true
        },
        project: {
          type: "string",
          description: "For a vector channel on a scalar target: x, y, mag or angle",
          enum: [
            "x",
            "y",
            "mag",
            "angle"
          ],
          optional: true
        },
        fields: {
          type: "object",
          description: "Binding fields over the defaults (see above)",
          optional: true
        },
        ...SLIDE_PARAM
      },
      async run( params ) {
        const slide = targetSlide(
          h,
          params.slide
        );
        const target = String( params.target );
        const info = bindableTargets( h ).find( ( candidate ) => candidate.target === target );

        if ( !info ) {
          const near = bindableTargets( h ).map( ( candidate ) => candidate.target )
            .filter( ( candidate ) => candidate.includes( target.split( "." ).pop() ?? target ) )
            .slice(
              0,
              6
            );

          throw new CommandError(
            "invalid",
            `"${ target }" is not a bindable parameter${ near.length ? ` — did you mean ${ near.join( ", " ) }?` : " — bindings.targets lists them" }`
          );
        }

        const fields = isRecord( params.fields ) ? params.fields : {};

        checkFields( fields );
        if ( "source" in fields || "project" in fields ) {
          throw new CommandError(
            "invalid",
            "give source and project as parameters, not in fields"
          );
        }
        checkSource(
          h,
          info.kind,
          params.source,
          params.project
        );

        const binding = {
          ...h.bindings.makeDefault(
            target,
            slide,
            params.source as string | undefined,
            params.project as string | undefined
          ),
          ...fields
        };
        const list = [
          ...bindingsOf(
            h,
            slide
          ),
          binding
        ];

        await h.bindings.write(
          slide,
          list,
          String( binding.source )
        );

        return {
          scope: scopeLabel( slide ),
          index: list.length - 1,
          binding
        };
      }
    },
    {
      id: "bindings.update",
      title: "Change a binding",
      description: "Change fields of a binding layer (bindings.list gives the index): source and project, mapping (replaced whole), smoothing, weight, blend, enabled, solo, or the generator's block. A new live source switches its input on.",
      params: {
        index: {
          type: "number",
          description: "Binding index on that slide (bindings.list)",
          min: 0,
          max: 999,
          integer: true
        },
        fields: {
          type: "object",
          description: "Fields to change"
        },
        ...SLIDE_PARAM
      },
      async run( params ) {
        const slide = targetSlide(
          h,
          params.slide
        );
        const index = existing(
          h,
          slide,
          params.index
        );
        const fields = params.fields as Record<string, unknown>;

        checkFields( fields );

        const list = bindingsOf(
          h,
          slide
        );
        const current = list[ index ];
        const next = {
          ...current,
          ...fields
        };

        if ( fields.source !== undefined || fields.project !== undefined ) {
          checkSource(
            h,
            String( current.kind ),
            next.source,
            next.project
          );
          // The picker's own seed: a generator picked for the first time gets its block.
          Object.assign(
            next,
            h.bindings.generatorSeed(
              String( next.source ),
              next
            )
          );
        }
        list[ index ] = next;

        await h.bindings.write(
          slide,
          list,
          fields.source !== undefined ? String( next.source ) : undefined
        );

        return {
          scope: scopeLabel( slide ),
          index,
          binding: next
        };
      }
    },
    {
      id: "bindings.remove",
      title: "Remove a binding",
      description: "Remove a binding layer (bindings.list gives the index); the parameter goes back to its own value. Later indices shift down.",
      params: {
        index: {
          type: "number",
          description: "Binding index on that slide (bindings.list)",
          min: 0,
          max: 999,
          integer: true
        },
        ...SLIDE_PARAM
      },
      async run( params ) {
        const slide = targetSlide(
          h,
          params.slide
        );
        const index = existing(
          h,
          slide,
          params.index
        );
        const list = bindingsOf(
          h,
          slide
        );
        const [
          removed
        ] = list.splice(
          index,
          1
        );

        await h.bindings.write(
          slide,
          list
        );

        return {
          scope: scopeLabel( slide ),
          removed,
          remaining: list.length
        };
      }
    }
  ];
}

/** Where the scope's parameters live, for the default's current value. */
export function targetValuePath(
  slide: number | undefined, target: string
): string {
  return `${ sketchBase( slide ) }.${ target }`;
}
