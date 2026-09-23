import type {
  FieldConfig, FieldEffect
} from "../components/ContentItems/constants/field-config";
import {
  randomizeField
} from "./randomizeFields";

/**
 * The form access an effect needs. `getDefault` answers what a field would
 * reset to — the value the form was loaded with, when the form knows it.
 */
export interface EffectFormAccess {
  getValues: ( path: string ) => unknown;
  setValue: ( path: string, value: unknown, options?: Record<string, unknown> ) => void;
  getDefault?: ( path: string ) => unknown;
}

const WRITE = {
  shouldDirty: true,
  shouldTouch: true
};

/**
 * Perform a button's effect: ONE ordinary write to the field it targets.
 *
 * This is the generalisation of what `RandomizeFieldButton` and the reset
 * arrow already do — a click, one `setValue`, nothing registered — so a
 * button reaches the document the way any hand edit does, and a pad pressing
 * the same button goes through the same function. It never touches
 * `interactive.bindings` and never runs in the engine: pressing is an edit,
 * not a signal, which is what keeps a headless capture (no hands, no pads)
 * out of the question.
 *
 * `target` is sketch-relative; `scope` is the form path of the sketch
 * (`"sketch"` or `"slides.2.sketch"`), and `findConfig` resolves the target's
 * own config — needed by `randomize` (it draws from the field's range) and by
 * `reset` (it honours a declared `default` first).
 */
export function applyFieldEffect(
  effect: FieldEffect,
  form: EffectFormAccess,
  scope: string,
  findConfig: ( target: string ) => FieldConfig | null
): void {
  if ( !effect || typeof effect.target !== "string" || effect.target === "" ) {
    return;
  }

  const path = `${ scope }.${ effect.target }`;

  switch ( effect.kind ) {
    case "set":
      form.setValue(
        path,
        effect.value,
        WRITE
      );
      return;

    case "toggle":
      form.setValue(
        path,
        !form.getValues( path ),
        WRITE
      );
      return;

    case "cycle": {
      const values = Array.isArray( effect.values ) ? effect.values : [];

      if ( values.length === 0 ) {
        return;
      }

      // A current value outside the list lands on the first entry, so a
      // cycle button always makes progress rather than doing nothing.
      const at = values.findIndex( ( value ) => Object.is(
        value,
        form.getValues( path )
      ) );

      form.setValue(
        path,
        values[ ( at + 1 ) % values.length ],
        WRITE
      );
      return;
    }

    case "randomize": {
      const config = findConfig( effect.target );

      if ( !config ) {
        return;
      }

      randomizeField(
        config,
        path,
        {
          getValues: form.getValues,
          setValue: (
            target, value
          ) => form.setValue(
            target,
            value,
            WRITE
          )
        }
      );
      return;
    }

    case "reset": {
      const config = findConfig( effect.target );
      const declared = config?.default;
      const fallback = declared === undefined ? form.getDefault?.( path ) : declared;

      // No declared default and nothing loaded: leave the field alone rather
      // than write `undefined` into it.
      if ( fallback === undefined ) {
        return;
      }

      form.setValue(
        path,
        fallback,
        WRITE
      );
      return;
    }

    default:
      return;
  }
}
