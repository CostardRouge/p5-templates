// Adjust this import to where your FieldConfig types live
import {
  FieldConfig,
  NestedObjectConfig
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";

// ———————————————————————————————————————————————————————————
// Public API
// ———————————————————————————————————————————————————————————

/**
 * Optional per-path overrides. Keys are dot-paths relative to the "sketch" object
 * (e.g. "margin", "layout.padding.x"). Values can override label, component, min/max/step, etc.
 *
 * Example:
 * {
 *   "margin": { label: "Image margin", component: "slider", min: 0, max: 0.45, step: 0.005 },
 *   "center": { label: "Center image" }
 * }
 */
export type FieldHints = Record<string, Partial<FieldConfig>>;

/**
 * Build a GenericObjectForm config (Record<string, FieldConfig>) from a plain
 * defaults object (number/boolean/string/nested objects).
 *
 * Use with: <GenericObjectForm basepath="sketch" config={createSketchFormConfigFromDefaults(defaults)} />
 */
export default function createSketchFormConfigFromDefaults(
  defaults: unknown,
  hints: FieldHints = {}
): Record<string, FieldConfig> {
  if ( !isPlainObject( defaults ) ) {
    return {};
  }

  return objectToConfig(
    defaults as Record<string, any>,
    "",
    hints
  );
}

// ———————————————————————————————————————————————————————————
// Internal helpers
// ———————————————————————————————————————————————————————————

function objectToConfig(
  obj: Record<string, any>,
  basePath: string,
  hints: FieldHints
): Record<string, FieldConfig> {
  const config: Record<string, FieldConfig> = {};

  for ( const key of Object.keys( obj ) ) {
    const value = obj[ key ];
    const path = basePath ? `${ basePath }.${ key }` : key;
    const override = pickOverride(
      hints,
      path,
      key
    );

    if ( override?.component ) {
      config[ key ] = mergeConfig(
        defaultConfigForValue(
          key,
          value,
          hints,
          path
        ), // ← Add hints and path
        override
      );
      continue;
    }

    if ( isPlainObject( value ) ) {
      const group: NestedObjectConfig = {
        component: "nested-object",
        label: override?.label ?? toLabel( key ),
        fields: objectToConfig(
          value,
          path,
          hints
        ) // ← hints already passed, good
      };

      config[ key ] = mergeConfig(
        group as FieldConfig,
        override
      );
      continue;
    }

    if ( Array.isArray( value ) ) {
      const arrayFields: Record<string, FieldConfig> = {};

      value.forEach( (
        v, i
      ) => {
        arrayFields[ String( i ) ] = defaultConfigForValue(
          String( i ),
          v,
          hints,
          `${ path }[${ i }]` // Better path for array items
        );
      } );

      const group: NestedObjectConfig = {
        component: "nested-object",
        label: override?.label ?? toLabel( key ),
        fields: arrayFields
      };

      config[ key ] = mergeConfig(
        group as FieldConfig,
        override
      );
      continue;
    }

    // Primitives - ADD hints and path here
    config[ key ] = mergeConfig(
      defaultConfigForValue(
        key,
        value,
        hints,
        path
      ),
      override
    );
  }

  return config;
}

function defaultConfigForValue(
  key: string,
  value: any,
  hints?: FieldHints,
  parentPath?: string
): FieldConfig {
  const label = toLabel( key );

  if ( typeof value === "number" ) {
    const kind = pickNumberKind(
      key,
      value
    );

    if ( kind === "ratio" ) {
      return {
        component: "slider",
        label,
        min: 0,
        max: 1,
        step: pickStep(
          value,
          0.01
        )
      };
    }
    if ( kind === "angleDeg" ) {
      return {
        component: "slider",
        label,
        min: 0,
        max: 360,
        step: 1
      };
    }
    return {
      component: "number",
      label,
      step: pickStep(
        value,
        1
      )
    };
  }

  if ( typeof value === "boolean" ) {
    return {
      component: "checkbox",
      label
    };
  }

  if ( typeof value === "string" ) {
    return {
      component: "text",
      label,
      placeholder: ""
    };
  }

  if ( isPlainObject( value ) ) {
    // When called directly (e.g., from arrays)
    const fields = objectToConfig(
      value as Record<string, any>,
      parentPath ? `${ parentPath }.${ key }` : key,
      hints ?? {}
    );

    return {
      component: "nested-object",
      label,
      fields
    } as NestedObjectConfig;
  }

  // Fallback for null/undefined/unsupported types → text
  return {
    component: "text",
    label,
    placeholder: ""
  };
}

function pickOverride(
  hints: FieldHints,
  fullPath: string,
  keyOnly: string
): Partial<FieldConfig> | undefined {
  // Try exact path first, then fallback to simple key
  return hints[ fullPath ] ?? hints[ keyOnly ];
}

function mergeConfig<T extends FieldConfig>(
  baseCfg: T,
  override?: Partial<FieldConfig>
): T {
  if ( !override ) {
    return baseCfg;
  }

  // If override has a different component, replace component and shallow-merge common fields.
  if ( override.component && override.component !== baseCfg.component ) {
    return {
      ...( baseCfg as any ),
      ...( override as any )
    } as T;
  }

  // Same component: shallow-merge
  const merged = {
    ...( baseCfg as any ),
    ...( override as any )
  } as T;

  // If nested-object with fields override, merge nested fields too
  if ( merged.component === "nested-object" && ( override as any )?.fields ) {
    merged.fields = {
      ...( baseCfg as any ).fields,
      ...( override as any ).fields
    };
  }

  return merged;
}

function isPlainObject( x: unknown ): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray( x );
}

function toLabel( key: string ): string {
  return key
    .replace(
      /([A-Z])/g,
      " $1"
    )
    .replace(
      /[_-]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim()
    .replace(
      /^./,
      ( c ) => c.toUpperCase()
    );
}

function pickNumberKind(
  key: string,
  value: number
): "ratio" | "angleDeg" | "number" {
  const k = key.toLowerCase();

  const looksLikeRatio =
    value >= 0 &&
    value <= 1 &&
    [
      "ratio",
      "opacity",
      "alpha",
      "progress",
      "margin",
      "scale"
    ].some( ( s ) =>
      k.includes( s ) );

  if ( looksLikeRatio ) {
    return "ratio";
  }

  if ( [
    "angle",
    "rotation",
    "rotate",
    "hue"
  ].some( ( s ) => k.includes( s ) ) ) {
    return "angleDeg";
  }

  return "number";
}

function pickStep(
  value: number, intDefault: number
): number {
  return Number.isInteger( value )
    ? intDefault
    : Math.min(
      0.01,
      roundToMagnitude( value ) / 10
    );
}

function roundToMagnitude( x: number ): number {
  const abs = Math.abs( x );

  if ( abs === 0 ) {
    return 1;
  }
  const pow = Math.pow(
    10,
    Math.floor( Math.log10( abs ) )
  );

  return pow;
}
