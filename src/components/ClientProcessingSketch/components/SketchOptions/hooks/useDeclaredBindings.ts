import {
  useEffect
} from "react";
import type {
  UseFormReturn
} from "react-hook-form";
import {
  publishDeclaredBindings
} from "@/lib/declaredBindings";
import type {
  FieldConfig
} from "../components/ContentItems/constants/field-config";
import {
  collectDeclaredBindings
} from "../utils/declaredBindingFields";

/**
 * Publishes the controls a sketch declared on its own fields, so the engine can
 * wire them to whichever controller is plugged in.
 *
 * The walk lives here, on the React side, because the form CONFIGURATION is
 * only available here — the engine sees values, never the `binding` keys that
 * describe them (the same reason an enum binding has to carry its option list).
 * What crosses over is a list of descriptors with an abstract `control`; the
 * engine resolves it against the port map and drops whatever does not match.
 *
 * Nothing here touches the form. These bindings are read at resolve time and
 * never persisted: a declaration is not an edit, and writing it would put one
 * machine's CC numbers into the saved document.
 */
export default function useDeclaredBindings(
  sketchFormConfiguration: Record<string, FieldConfig> | undefined,
  methods: UseFormReturn<Record<string, unknown>>,
  basePath: string
): void {
  useEffect(
    () => {
      const readValue = ( path: string ) =>
        methods.getValues( `${ basePath }.${ path }` );

      let published = "";

      const republish = () => {
        const bindings = collectDeclaredBindings(
          sketchFormConfiguration,
          readValue
        );
        // Re-walking is cheap, re-publishing is not free for the engine's
        // per-frame read, so only a real change crosses over. The list only
        // moves when the sketch changes or a conditional branch is switched.
        const signature = JSON.stringify( bindings );

        if ( signature === published ) {
          return;
        }

        published = signature;
        publishDeclaredBindings( {
          bindings
        } );
      };

      republish();

      // Conditional groups decide which fields exist from a value, so the set
      // of declarations can move without the config changing.
      const subscription = methods.watch( republish );

      return () => {
        subscription.unsubscribe();
        publishDeclaredBindings( null );
      };
    },
    [
      sketchFormConfiguration,
      methods,
      basePath
    ]
  );
}
