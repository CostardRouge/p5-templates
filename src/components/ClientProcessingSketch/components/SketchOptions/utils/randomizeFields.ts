import {
  FieldConfig
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";
import {
  randomVector2D
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/components/ControlledVector2DInput/utils/vector2dMath";

/**
 * The slice of react-hook-form the randomizer needs. Structural on purpose: it
 * keeps the walk a plain function — testable without mounting a form, and
 * callable from a whole-panel button or a single field's own one alike.
 */
export interface RandomizeFormAccess {
  getValues: ( path: string ) => unknown;
  setValue: ( path: string, value: unknown ) => void;
}

/**
 * Assigns a random value to one field. A component kind with no case here is
 * left untouched on purpose — text, images and assets have nothing to draw
 * from, and `color` is deliberately not randomized (see the note below).
 */
export function randomizeField(
  field: FieldConfig, path: string, form: RandomizeFormAccess
): void {
  switch ( field.component ) {
    case "number":
    case "slider":
      if ( field.min !== undefined && field.max !== undefined ) {
        const randomValue =
          Math.random() * ( field.max - field.min ) + field.min;

        form.setValue(
          path,
          field.step
            ? Math.round( randomValue / field.step ) * field.step
            : randomValue
        );
      }
      break;
    case "checkbox":
      form.setValue(
        path,
        Math.random() > 0.5
      );
      break;
    // A vector2d is one field holding a pair, so it is randomized as a pair:
    // a uniform point inside the pad's own bounds, snapped to its step.
    // Sibling keys are preserved for the same reason the pad preserves them —
    // the { x, y } can live inside a larger value object.
    case "vector2d": {
      const current = form.getValues( path );

      form.setValue(
        path,
        {
          ...( current && typeof current === "object" ? current : {} ),
          ...randomVector2D( field )
        }
      );
      break;
    }
    case "color":
      // Deliberately left alone: a random RGB triplet wrecks a palette, and
      // the whole-panel button is usually pressed to explore geometry.
      break;
    case "select":
      if ( field.options && field.options.length > 0 ) {
        const randomOption =
          field.options[ Math.floor( Math.random() * field.options.length ) ];

        form.setValue(
          path,
          randomOption.value
        );
      }
      break;
    case "nested-object":
      randomizeFields(
        field.fields,
        path,
        form
      );
      break;
    case "conditional-group": {
      const types = field.typeSelector.options;

      if ( types && types.length > 0 ) {
        const randomType = types[ Math.floor( Math.random() * types.length ) ];

        form.setValue(
          `${ path }.${ field.conditionalOn }`,
          randomType.value
        );

        const specificConfig = field.configs[ randomType.value ];

        if ( specificConfig ) {
          randomizeFields(
            specificConfig,
            path,
            form
          );
        }
      }
      break;
    }
  }
}

/**
 * Walks a whole form config, randomizing every field it knows how to draw.
 * `basePath` is the path the config is mounted at ("" for a root form).
 */
export function randomizeFields(
  config: Record<string, FieldConfig>, basePath: string, form: RandomizeFormAccess
): void {
  for ( const [
    key,
    field
  ] of Object.entries( config ) ) {
    randomizeField(
      field,
      basePath ? `${ basePath }.${ key }` : key,
      form
    );
  }
}
