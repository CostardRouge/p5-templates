import type {
  FieldConfig
} from "../components/ContentItems/constants/field-config";

/**
 * Find the config of the field at a sketch-relative dotted path
 * (`"rack.effect"`), following `nested-object` groups and the branch of a
 * `conditional-group` that is currently LIVE — the same rule
 * `declaredBindingFields` walks by, because a field on a branch that is not
 * selected does not exist for the form either.
 *
 * `readValue` is only consulted for conditional discriminants. Null when any
 * segment is missing, which a caller treats as "nothing to act on".
 */
export type ReadValue = ( path: string ) => unknown;

export function findFieldConfig(
  config: Record<string, FieldConfig> | null | undefined,
  path: string,
  readValue: ReadValue
): FieldConfig | null {
  if ( !config || typeof path !== "string" || path === "" ) {
    return null;
  }

  const segments = path.split( "." );
  let fields: Record<string, FieldConfig> | undefined = config;
  let walked = "";

  for ( let index = 0; index < segments.length; index++ ) {
    const key = segments[ index ];
    const field: FieldConfig | undefined = fields?.[ key ];

    if ( !field ) {
      return null;
    }

    walked = walked ? `${ walked }.${ key }` : key;

    if ( index === segments.length - 1 ) {
      return field;
    }

    if ( field.component === "nested-object" ) {
      fields = field.fields;
      continue;
    }

    if ( field.component === "conditional-group" ) {
      const active = readValue( `${ walked }.${ field.conditionalOn }` );

      fields = typeof active === "string" || typeof active === "number"
        ? field.configs[ String( active ) ]
        : undefined;
      continue;
    }

    // A leaf with segments left over: the path names something the form does
    // not describe (a key inside a json field, say).
    return null;
  }

  return null;
}
