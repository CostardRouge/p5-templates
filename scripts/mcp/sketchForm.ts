/**
 * A sketch's parameter form, read for an agent: its `formConfiguration` (the
 * controls the studio draws) turned into a JSON Schema, and a parameter delta
 * checked against those same controls before it reaches a render.
 *
 * The rule is the registry's: what the form would not let a person enter is
 * REFUSED, naming the dotted path and the bound — a slider's range, a select's
 * values, a checkbox's boolean, a colour's 0–255 channels, a pad's axes. A key
 * the sketch does not have is refused naming the ones it does. Kinds the agent
 * cannot meaningfully write (images, assets, item lists, device pickers…) are
 * described and passed through unchecked rather than guessed at.
 *
 * Pure. `formConfiguration` is plain data (see `/api/sketches/form`).
 */
import {
  CommandError, isRecord
} from "./registry.ts";

type Field = Record<string, unknown> & { component?: string;
  label?: string };
type Fields = Record<string, Field>;
type Range = { min: number;
  max: number };

const COLOR_CHANNELS = {
  min: 0,
  max: 255
};

function fieldsOf( value: unknown ): Fields {
  return isRecord( value ) ? value as Fields : {};
}

function num( value: unknown ): number | undefined {
  return typeof value === "number" && Number.isFinite( value ) ? value : undefined;
}

/** A pad's per-axis bounds, with the defaults the pad itself applies (`field-config.ts`). */
function axisRanges( field: Field ): Record<string, Range> {
  const axes = field.component === "vector3d" ? [
    "x",
    "y",
    "z"
  ] : [
    "x",
    "y"
  ];
  const max = num( field.max ) ?? 1;
  const min = num( field.min ) ?? ( field.allowNegative === false ? 0 : -1 );
  const out: Record<string, Range> = {};

  for ( const axis of axes ) {
    const own = isRecord( field[ `${ axis }Axis` ] ) ? field[ `${ axis }Axis` ] as Record<string, unknown> : {};

    out[ axis ] = {
      min: num( own.min ) ?? min,
      max: num( own.max ) ?? max
    };
  }

  return out;
}

function optionValues( selector: unknown ): unknown[] | null {
  const options = isRecord( selector ) ? selector.options : null;

  if ( !Array.isArray( options ) ) {
    return null;
  }

  return options.map( ( option ) => isRecord( option ) && "value" in option ? option.value : option );
}

function describe( field: Field ): Record<string, unknown> {
  return {
    ...( typeof field.label === "string" ? {
      description: field.label
    } : {} )
  };
}

function withDefault(
  schema: Record<string, unknown>, value: unknown
): Record<string, unknown> {
  return value === undefined ? schema : {
    ...schema,
    default: value
  };
}

/** One field as JSON Schema, its current default attached. */
export function fieldSchema(
  field: Field, value: unknown
): Record<string, unknown> {
  const base = describe( field );

  switch ( field.component ) {
    case "slider":
    case "number":
      return withDefault(
        {
          ...base,
          type: "number",
          ...( num( field.min ) !== undefined ? {
            minimum: field.min
          } : {} ),
          ...( num( field.max ) !== undefined ? {
            maximum: field.max
          } : {} ),
          ...( num( field.step ) !== undefined ? {
            step: field.step
          } : {} )
        },
        value
      );
    case "checkbox":
      return withDefault(
        {
          ...base,
          type: "boolean"
        },
        value
      );
    case "text":
    case "textarea":
      return withDefault(
        {
          ...base,
          type: "string"
        },
        value
      );
    case "select": {
      const values = optionValues( field );

      return withDefault(
        {
          ...base,
          ...( values ? {
            enum: values
          } : {} )
        },
        value
      );
    }
    case "multi-select": {
      const values = optionValues( field );

      return withDefault(
        {
          ...base,
          type: "array",
          items: values ? {
            enum: values
          } : {}
        },
        value
      );
    }
    case "color":
      return withDefault(
        {
          ...base,
          type: "array",
          description: `${ field.label ?? "colour" } — [r, g, b] or [r, g, b, a], each 0–255`,
          items: {
            type: "number",
            minimum: 0,
            maximum: 255
          },
          minItems: 3,
          maxItems: 4
        },
        value
      );
    case "vector2d":
    case "vector3d": {
      const ranges = axisRanges( field );
      const properties: Record<string, unknown> = {};

      for ( const [
        axis,
        range
      ] of Object.entries( ranges ) ) {
        properties[ axis ] = {
          type: "number",
          minimum: range.min,
          maximum: range.max
        };
      }

      return withDefault(
        {
          ...base,
          type: "object",
          properties,
          additionalProperties: false
        },
        value
      );
    }
    case "nested-object":
      return {
        ...base,
        ...formSchema(
          fieldsOf( field.fields ),
          isRecord( value ) ? value : {}
        )
      };
    case "conditional-group": {
      const key = typeof field.conditionalOn === "string" ? field.conditionalOn : "type";
      const configs = isRecord( field.configs ) ? field.configs : {};
      const branches = Object.entries( configs ).map( ( [
        branch,
        fields
      ] ) => {
        const branchSchema = formSchema(
          fieldsOf( fields ),
          {}
        );
        const properties = branchSchema.properties as Record<string, unknown>;

        return {
          ...branchSchema,
          properties: {
            [ key ]: {
              const: branch
            },
            ...properties
          },
          required: [
            key
          ]
        };
      } );

      return withDefault(
        {
          ...base,
          type: "object",
          description: `${ field.label ?? "group" } — "${ key }" picks the branch, the other keys are that branch's fields`,
          oneOf: branches
        },
        value
      );
    }
    default:
      return withDefault(
        {
          ...base,
          description: `${ field.label ?? "field" } (${ field.component ?? "value" } control — not checked here)`
        },
        value
      );
  }
}

/** The whole form as one JSON Schema object, every default attached. */
export function formSchema(
  configuration: Record<string, unknown>, values: Record<string, unknown>
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};

  for ( const [
    key,
    field
  ] of Object.entries( fieldsOf( configuration ) ) ) {
    if ( field.component === "hidden" ) {
      continue;
    }
    properties[ key ] = fieldSchema(
      field,
      values[ key ]
    );
  }

  return {
    type: "object",
    properties,
    additionalProperties: false
  };
}

function refuse(
  path: string, message: string
): never {
  throw new CommandError(
    "invalid",
    `options.${ path } ${ message }`
  );
}

function checkNumber(
  path: string, value: unknown, range: Partial<Range>
): void {
  if ( typeof value !== "number" || !Number.isFinite( value ) ) {
    refuse(
      path,
      "must be a finite number"
    );
  }
  if ( range.min !== undefined && value < range.min ) {
    refuse(
      path,
      `is ${ value }, below its minimum ${ range.min }`
    );
  }
  if ( range.max !== undefined && value > range.max ) {
    refuse(
      path,
      `is ${ value }, above its maximum ${ range.max }`
    );
  }
}

function checkEnum(
  path: string, value: unknown, values: unknown[]
): void {
  if ( !values.some( ( v ) => v === value ) ) {
    refuse(
      path,
      `is ${ JSON.stringify( value ) } — one of ${ values.map( ( v ) => JSON.stringify( v ) ).join( ", " ) }`
    );
  }
}

function checkField(
  path: string, field: Field, value: unknown, current: unknown
): void {
  switch ( field.component ) {
    case "slider":
    case "number":
      checkNumber(
        path,
        value,
        {
          min: num( field.min ),
          max: num( field.max )
        }
      );
      return;
    case "checkbox":
      if ( typeof value !== "boolean" ) {
        refuse(
          path,
          "must be true or false"
        );
      }
      return;
    case "text":
    case "textarea":
      if ( typeof value !== "string" ) {
        refuse(
          path,
          "must be a string"
        );
      }
      return;
    case "select": {
      const values = optionValues( field );

      if ( values ) {
        checkEnum(
          path,
          value,
          values
        );
      }
      return;
    }
    case "multi-select": {
      const values = optionValues( field );

      if ( !Array.isArray( value ) ) {
        refuse(
          path,
          "must be a list"
        );
      }
      if ( values ) {
        value.forEach( (
          item, i
        ) => checkEnum(
          `${ path }[${ i }]`,
          item,
          values
        ) );
      }
      return;
    }
    case "color":
      if ( !Array.isArray( value ) || value.length < 3 || value.length > 4 ) {
        refuse(
          path,
          "must be [r, g, b] or [r, g, b, a]"
        );
      }
      value.forEach( (
        channel, i
      ) => checkNumber(
        `${ path }[${ i }]`,
        channel,
        COLOR_CHANNELS
      ) );
      return;
    case "vector2d":
    case "vector3d": {
      const ranges = axisRanges( field );

      if ( !isRecord( value ) ) {
        refuse(
          path,
          `must be an object with ${ Object.keys( ranges ).join( ", " ) }`
        );
      }
      for ( const key of Object.keys( value ) ) {
        if ( !( key in ranges ) ) {
          refuse(
            `${ path }.${ key }`,
            `is not an axis — ${ Object.keys( ranges ).join( ", " ) }`
          );
        }
        checkNumber(
          `${ path }.${ key }`,
          value[ key ],
          ranges[ key ]
        );
      }
      return;
    }
    case "nested-object":
      if ( !isRecord( value ) ) {
        refuse(
          path,
          "must be an object"
        );
      }
      checkLevel(
        path,
        fieldsOf( field.fields ),
        isRecord( current ) ? current : {},
        value
      );
      return;
    case "conditional-group": {
      if ( !isRecord( value ) ) {
        refuse(
          path,
          "must be an object"
        );
      }

      const key = typeof field.conditionalOn === "string" ? field.conditionalOn : "type";
      const configs = isRecord( field.configs ) ? field.configs : {};
      const branch = key in value ? value[ key ] : isRecord( current ) ? current[ key ] : undefined;

      if ( typeof branch !== "string" || !( branch in configs ) ) {
        refuse(
          `${ path }.${ key }`,
          `is ${ JSON.stringify( branch ) } — one of ${ Object.keys( configs ).map( ( b ) => JSON.stringify( b ) )
            .join( ", " ) }`
        );
      }

      const rest = Object.fromEntries( Object.entries( value ).filter( ( [
        k
      ] ) => k !== key ) );

      checkLevel(
        path,
        fieldsOf( configs[ branch ] ),
        isRecord( current ) ? current : {},
        rest
      );
      return;
    }
    default:
      // Images, assets, item lists, device pickers, JSON blobs: described in
      // the schema, not modelled here — a person edits those with a picker.
      return;
  }
}

function checkLevel(
  prefix: string, fields: Fields, current: Record<string, unknown>, delta: Record<string, unknown>
): void {
  for ( const [
    key,
    value
  ] of Object.entries( delta ) ) {
    const path = prefix ? `${ prefix }.${ key }` : key;
    const field = fields[ key ];

    if ( !field ) {
      if ( key in current ) {
        // A value the sketch stores without drawing a control for it.
        continue;
      }

      const known = [
        ...new Set( [
          ...Object.keys( fields ),
          ...Object.keys( current )
        ] )
      ];

      refuse(
        path,
        `is not a parameter of this sketch — ${ known.length ? `known here: ${ known.join( ", " ) }` : "none here" }`
      );
    }
    checkField(
      path,
      field,
      value,
      current[ key ]
    );
  }
}

/**
 * Check a parameter delta (any subset of the form, nested as the form is)
 * against the sketch's controls. Throws `CommandError( "invalid" )`.
 */
export function checkSketchOptions(
  configuration: Record<string, unknown>,
  values: Record<string, unknown>,
  delta: Record<string, unknown>
): void {
  checkLevel(
    "",
    fieldsOf( configuration ),
    values,
    delta
  );
}

/**
 * `delta` over `base`, as the option store merges: objects merge key by key,
 * arrays and scalars replace (`mergeChangedInPlace` treats arrays as leaves).
 */
export function mergeOptions(
  base: Record<string, unknown>, delta: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    ...base
  };

  for ( const [
    key,
    value
  ] of Object.entries( delta ) ) {
    out[ key ] = isRecord( value ) && isRecord( base[ key ] )
      ? mergeOptions(
        base[ key ] as Record<string, unknown>,
        value
      )
      : value;
  }

  return out;
}
