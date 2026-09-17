import type {
  FieldConfig
} from "../components/ContentItems/constants/field-config";
import {
  bindingKindFor, makeDefaultBinding
} from
  "../components/ContentItems/components/BindingAffordance/bindingUtils";
import type {
  DeclaredBinding
} from "@/lib/declaredBindings";

/**
 * Collects the fields a sketch declared a default control on
 * (`binding: { control: "knob.1" }`) and turns each into a binding descriptor
 * the engine can resolve.
 *
 * Deliberately a separate walk from `randomizeFields`, which is the only other
 * recursive pass over a form config: that one assigns values and picks a RANDOM
 * conditional branch, this one reads declarations and must follow the branch
 * that is actually live. Folding them into one visitor would entangle the two.
 *
 * `readValue` is only consulted for `conditional-group` discriminants — a
 * branch that is not selected declares nothing, and walking every branch would
 * let two of them claim the same control.
 */
export type ReadValue = ( path: string ) => unknown;

function collectField(
  field: FieldConfig,
  path: string,
  readValue: ReadValue,
  out: DeclaredBinding[]
): void {
  if ( field.binding?.control ) {
    const kind = bindingKindFor( field.component );

    // A kind of null means nothing knows how to modulate this component (text,
    // an asset picker, …). Silently skipping is right: the declaration is a
    // hint, and a field that cannot be driven simply is not.
    if ( kind ) {
      // makeDefaultBinding is the one place that knows how to derive a mapping
      // from a field's own config — the slider's min/max, the select's option
      // list, the colour ramp. Its `source` (an oscillator) and its random
      // `id` are discarded: the engine supplies the source, and a per-frame
      // uuid would break the smoothing and trigger state keyed on it.
      const template = makeDefaultBinding(
        path,
        kind,
        field
      );

      out.push( {
        target: path,
        control: field.binding.control,
        kind,
        mapping: template.mapping,
        smoothing: template.smoothing
      } );
    }
  }

  if ( field.component === "nested-object" ) {
    collectConfig(
      field.fields,
      path,
      readValue,
      out
    );

    return;
  }

  if ( field.component === "conditional-group" ) {
    const active = readValue( `${ path }.${ field.conditionalOn }` );
    const branch = typeof active === "string" || typeof active === "number"
      ? field.configs[ String( active ) ]
      : undefined;

    if ( branch ) {
      collectConfig(
        branch,
        path,
        readValue,
        out
      );
    }
  }
}

function collectConfig(
  config: Record<string, FieldConfig>,
  basePath: string,
  readValue: ReadValue,
  out: DeclaredBinding[]
): void {
  for ( const [
    key,
    field
  ] of Object.entries( config ) ) {
    collectField(
      field,
      basePath ? `${ basePath }.${ key }` : key,
      readValue,
      out
    );
  }
}

/**
 * Walk a sketch's form configuration and return one descriptor per declared
 * control. Paths come back SKETCH-RELATIVE (`"noise.speed"`), which is what a
 * binding `target` is, so the caller mounts the walk at the sketch's own
 * config and passes no base path.
 */
export function collectDeclaredBindings(
  config: Record<string, FieldConfig> | null | undefined,
  readValue: ReadValue
): DeclaredBinding[] {
  const out: DeclaredBinding[] = [];

  if ( !config ) {
    return out;
  }

  collectConfig(
    config,
    "",
    readValue,
    out
  );

  return out;
}
