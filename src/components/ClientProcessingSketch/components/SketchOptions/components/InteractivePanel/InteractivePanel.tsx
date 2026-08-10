"use client";

import React, {
  useState
} from "react";
import {
  useFormContext, useWatch
} from "react-hook-form";
import {
  Activity, ChevronDown, Trash2
} from "lucide-react";
import clsx from "clsx";

import {
  interactionBindingsEnabled
} from "@/lib/interactionBindings";
import {
  bindingSignalVarName
} from "@/lib/channelBridge";
import ControlledSliderInput
  from "../ContentItems/components/ControlledSliderInput/ControlledSliderInput";
import {
  needsInteractionBlock
} from "@/p5/utils/interaction/bindings.js";
import {
  type Binding,
  bindingSourceLabel,
  humanizeTarget,
  interactiveScopeFor
} from "../ContentItems/components/BindingAffordance/bindingUtils";

type Props = {
  /** The sketch-settings scope whose bindings this manages ("sketch" or
   *  "slides.N.sketch") — mirrors the SketchSettings form's base path. */
  basePath: string;
};

/**
 * The central "Interactive" mixer — a single overview of every binding driving
 * the active scope, grouped by parameter (each parameter can be driven by
 * several layered bindings). Each row is a mixer channel: a live meter, the
 * source, mute (the binding's `enabled`) and solo, a weight fader, and remove.
 * Solo follows the standard mixer rule (handled in the resolver): when any
 * binding is soloed, only soloed ones play.
 *
 * Read/written through the shared form context, so edits round-trip and persist
 * exactly like every other control. Gated by the interaction-bindings plugin and
 * hidden entirely when the scope has no bindings.
 */
export default function InteractivePanel( {
  basePath
}: Props ) {
  const {
    setValue, getValues
  } = useFormContext();
  const [
    expanded,
    setExpanded
  ] = useState( false );
  // Binding data lives in the `interactive` namespace paired with the scope's
  // sketch settings ("sketch" → "interactive", "slides.N.sketch" →
  // "slides.N.interactive") — never inside the sketch parameters.
  const interactiveScope = interactiveScopeFor( basePath );
  const bindingsPath = `${ interactiveScope }.bindings`;
  const bindings = useWatch( {
    name: bindingsPath
  } ) as Binding[] | undefined;

  if ( !interactionBindingsEnabled() ) {
    return null;
  }

  const list: Binding[] = Array.isArray( bindings )
    ? bindings.filter( Boolean )
    : [];

  if ( list.length === 0 ) {
    return null;
  }

  const anySolo = list.some( ( b ) => b.solo );
  const activeCount = list.filter( ( b ) => b.enabled !== false && ( !anySolo || b.solo ) ).length;

  // Group bindings by target (parameter), preserving first-seen order.
  const groups: Array<{
    target: string;
    items: Array<{ binding: Binding;
      index: number }>;
  }> = [];
  const groupIndex = new Map<string, number>();

  list.forEach( (
    binding, index
  ) => {
    const target = binding.target ?? "";
    let gi = groupIndex.get( target );

    if ( gi === undefined ) {
      gi = groups.length;
      groupIndex.set(
        target,
        gi
      );
      groups.push( {
        target,
        items: []
      } );
    }

    groups[ gi ].items.push( {
      binding,
      index
    } );
  } );

  const writeAt = (
    index: number, patch: Partial<Binding>
  ) => {
    setValue(
      bindingsPath,
      list.map( (
        b, j
      ) => ( j === index ? {
        ...b,
        ...patch
      } : b ) ),
      {
        shouldDirty: true
      }
    );
  };

  const removeAt = ( index: number ) => {
    const next = list.filter( (
      _, j
    ) => j !== index );

    setValue(
      bindingsPath,
      next,
      {
        shouldDirty: true
      }
    );

    // Mirrors BindingAffordance.pruneInteractionIfUnused: the mixer can also
    // remove the scope's last binding that needed the interaction block. Only
    // the plugin-managed block in the `interactive` namespace is pruned — a
    // sketch-declared `sketch.interaction` is a real parameter and stays.
    if (
      !needsInteractionBlock( next ) &&
      getValues( `${ interactiveScope }.interaction` ) !== undefined
    ) {
      setValue(
        `${ interactiveScope }.interaction`,
        undefined,
        {
          shouldDirty: true
        }
      );
    }
  };

  const clearSolos = () => {
    setValue(
      bindingsPath,
      list.map( ( b ) => ( b.solo ? {
        ...b,
        solo: false
      } : b ) ),
      {
        shouldDirty: true
      }
    );
  };

  return (
    <div
      className={ clsx(
        "absolute bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col glass border border-theme shadow-lg overflow-hidden",
        expanded
          ? "w-80 max-w-[calc(100vw-1rem)] rounded-2xl"
          : "rounded-full"
      ) }
    >
      <button
        type="button"
        onClick={ () => setExpanded( ( v ) => !v ) }
        className="flex items-center gap-2 px-3 py-2 text-xs text-foreground"
        aria-label={ expanded ? "Collapse interactive mixer" : "Expand interactive mixer" }
      >
        <Activity className="h-3.5 w-3.5" />
        <span>
          Interactive · {list.length} layer{list.length === 1 ? "" : "s"}
          {anySolo && ` · ${ activeCount } soloed`}
        </span>
        <ChevronDown
          className="h-3.5 w-3.5 transition-transform"
          style={ {
            transform: expanded ? "rotate(0deg)" : "rotate(180deg)"
          } }
        />
      </button>

      {expanded && (
        <div className="flex max-h-[60svh] flex-col gap-3 overflow-y-auto px-3 pb-3">
          {anySolo && (
            <button
              type="button"
              onClick={ clearSolos }
              className="self-start text-label transition-colors hover:text-foreground"
            >
              Clear solos
            </button>
          )}

          {groups.map( ( group ) => (
            <div key={ group.target } className="flex flex-col gap-1">
              <span className="text-label">
                {humanizeTarget( group.target )}
              </span>

              {group.items.map( ( {
                binding, index
              } ) => {
                const meterVar = bindingSignalVarName( binding.id ?? group.target );
                const muted = binding.enabled === false;
                const dimmed = muted || ( anySolo && !binding.solo );

                return (
                  <div
                    key={ binding.id ?? index }
                    className={ clsx(
                      "flex items-center gap-1.5 rounded-md border border-theme px-2 py-1.5",
                      dimmed && "opacity-50"
                    ) }
                  >
                    <span className="relative grid h-6 w-6 shrink-0 place-items-center rounded">
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0 rounded bg-focus/30"
                        style={ {
                          opacity: `var(${ meterVar }, 0)`
                        } }
                      />
                      <Activity className="relative h-3 w-3 text-focus" />
                    </span>

                    <span className="min-w-0 flex-1 truncate">
                      {bindingSourceLabel( binding )}
                    </span>

                    <button
                      type="button"
                      title="Mute"
                      onClick={ () => writeAt(
                        index,
                        {
                          enabled: muted
                        }
                      ) }
                      className={ clsx(
                        "grid h-6 w-6 shrink-0 place-items-center rounded text-[0.65rem] font-bold transition-colors",
                        muted
                          ? "bg-hover text-foreground"
                          : "text-label hover:text-foreground"
                      ) }
                    >
                      M
                    </button>

                    <button
                      type="button"
                      title="Solo"
                      onClick={ () => writeAt(
                        index,
                        {
                          solo: !binding.solo
                        }
                      ) }
                      className={ clsx(
                        "grid h-6 w-6 shrink-0 place-items-center rounded text-[0.65rem] font-bold transition-colors",
                        binding.solo
                          ? "bg-amber-400/20 text-amber-400"
                          : "text-label hover:text-foreground"
                      ) }
                    >
                      S
                    </button>

                    <div className="w-16 shrink-0">
                      <ControlledSliderInput
                        name={ `${ bindingsPath }.${ index }.weight` }
                        label=""
                        min={ 0 }
                        max={ 1 }
                        step={ 0.05 }
                      />
                    </div>

                    <button
                      type="button"
                      title="Remove"
                      onClick={ () => removeAt( index ) }
                      className="grid h-6 w-6 shrink-0 place-items-center rounded text-label transition-colors hover:text-foreground"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              } )}
            </div>
          ) )}
        </div>
      )}
    </div>
  );
}
