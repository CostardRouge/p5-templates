/**
 * How a binding list reaches the form — the ONE write path, shared by the
 * affordance (a click) and the agent commands (`bindings.*`), so an agent's
 * binding is stored, enabled and pruned exactly as a person's.
 *
 * A binding list lives at `<interactiveScope>.bindings` (`interactive` beside
 * the root `sketch`, `slides.N.interactive` beside a slide's). Two side
 * effects travel with a write: picking a live input source flips the matching
 * `interaction.*` enable flags on (seeding an inert interaction block in the
 * `interactive` namespace when the sketch declares none), and the block is
 * pruned again once no binding needs it.
 */
import {
  needsInteractionBlock
} from "@/p5/utils/interaction/bindings.js";
import {
  type Binding, interactionEnablePaths
} from "./bindingUtils";

/** The form, as the write path needs it: react-hook-form's pair, or a fake. */
export type BindingFormIO = {
  getValues: ( path: string ) => unknown;
  setValue: ( path: string, value: unknown ) => void;
};

/**
 * Strip the plugin-managed `interaction` block once no binding needs it any
 * more — the inverse of `enableSourceInputs`' on-demand seed. Only the
 * `interactive` namespace is pruned: a sketch-DECLARED block at
 * `<sketchScope>.interaction` is a real sketch parameter and is never touched.
 */
export function pruneInteractionIfUnused(
  io: BindingFormIO, interactiveScope: string, list: Binding[]
): void {
  if ( needsInteractionBlock( list ) ) {
    return;
  }
  if ( io.getValues( `${ interactiveScope }.interaction` ) !== undefined ) {
    io.setValue(
      `${ interactiveScope }.interaction`,
      undefined
    );
  }
}

/** Store `list` as the scope's bindings, then prune the interaction block if nothing needs it. */
export function writeBindingList(
  io: BindingFormIO, interactiveScope: string, list: Binding[]
): void {
  io.setValue(
    `${ interactiveScope }.bindings`,
    list
  );
  pruneInteractionIfUnused(
    io,
    interactiveScope,
    list
  );
}

/**
 * Make a picked input source actually produce a channel: flip the matching
 * `interaction.*` enable flags on so the camera / mic / sensor boots at once.
 * The flags land wherever the interaction block lives — a sketch-DECLARED
 * block at the sketch scope is written in place; otherwise the plugin-managed
 * block in the `interactive` namespace is seeded from an inert clone of the
 * shared defaults on first use (lazily imported: an editor session that never
 * binds a live source never loads the ~1000-line defaults module), then
 * flipped. Generators have nothing to enable.
 */
export async function enableSourceInputs(
  io: BindingFormIO, sketchScope: string, interactiveScope: string, source: string
): Promise<void> {
  const paths = interactionEnablePaths( source );

  if ( paths.length === 0 ) {
    return;
  }

  let interactionScope = sketchScope;

  if ( io.getValues( `${ sketchScope }.interaction` ) === undefined ) {
    interactionScope = interactiveScope;

    if ( io.getValues( `${ interactiveScope }.interaction` ) === undefined ) {
      const {
        inertInteractionFormValues
      } = await import( "@/p5/utils/interaction/defaults.js" );

      io.setValue(
        `${ interactiveScope }.interaction`,
        inertInteractionFormValues()
      );
    }
  }

  for ( const path of paths ) {
    io.setValue(
      `${ interactionScope }.interaction.${ path }`,
      true
    );
  }
}
