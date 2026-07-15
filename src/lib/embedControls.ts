import type {
  FieldConfig
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";

/**
 * Resolves the `#c=` control whitelist against a sketch's `formConfiguration`
 * so the embed can render just those fields with the existing `FieldRenderer`.
 *
 * Path syntax mirrors the options tree: dotted paths walk `nested-object`
 * groups via their `.fields`, e.g. `noise.seed` → formConfiguration.noise.fields
 * .seed. A path may also point at a group itself (`noise`), in which case the
 * whole group renders (FieldRenderer recurses). The special token `*` expands
 * to every top-level field.
 *
 * Field names are resolved under the `sketch` base path — the sketch params
 * live at `options.sketch.*`, the same scope the studio's SketchSettings panel
 * uses — so the produced (fieldBasePath, fieldName) register as `sketch.<path>`.
 */

export const EMBED_CONTROLS_ALL = "*";

export type ResolvedEmbedControl = {
  /** The original whitelist path (stable React key). */
  path: string;
  /** Base path passed to FieldRenderer, e.g. "sketch.noise". */
  fieldBasePath: string;
  /** Leaf field name, e.g. "seed". */
  fieldName: string;
  /** The resolved field config (leaf control or a nested-object group). */
  config: FieldConfig;
};

export function resolveEmbedControls(
  formConfiguration: Record<string, FieldConfig> | undefined,
  controls: string[] | null | undefined
): ResolvedEmbedControl[] {
  if ( !formConfiguration || !controls || controls.length === 0 ) {
    return [];
  }

  const paths = controls.includes( EMBED_CONTROLS_ALL )
    ? Object.keys( formConfiguration )
    : controls;

  const resolved: ResolvedEmbedControl[] = [];
  const seen = new Set<string>();

  for ( const rawPath of paths ) {
    const segments = rawPath
      .split( "." )
      .map( ( segment ) => segment.trim() )
      .filter( Boolean );

    if ( segments.length === 0 || seen.has( segments.join( "." ) ) ) {
      continue;
    }

    let config: FieldConfig | undefined = formConfiguration[ segments[ 0 ] ];

    for ( let i = 1; i < segments.length && config; i++ ) {
      config = ( config as { fields?: Record<string, FieldConfig> } ).fields?.[ segments[ i ] ];
    }

    if ( !config ) {
      continue;
    }

    const fieldName = segments[ segments.length - 1 ];
    const parentSegments = segments.slice(
      0,
      -1
    );

    seen.add( segments.join( "." ) );
    resolved.push( {
      path: segments.join( "." ),
      fieldName,
      fieldBasePath: [
        "sketch",
        ...parentSegments
      ].join( "." ),
      config
    } );
  }

  return resolved;
}
