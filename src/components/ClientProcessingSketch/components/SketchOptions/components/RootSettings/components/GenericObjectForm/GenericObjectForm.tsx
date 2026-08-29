import dynamic from "next/dynamic";
import {
  useWatch
} from "react-hook-form";
import {
  FieldConfig
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";
import {
  interactiveScopeFor
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/components/BindingAffordance/bindingUtils";

// FieldRenderer is the heavy hub of the option form: it statically pulls in all
// nine Controlled* inputs and recurses through ItemListRenderer (a large
// subtree). Every always-mounted panel — RootSettings (general settings),
// SketchSettings, and the mobile drawer — reaches it through this single
// import, so a *static* import here drags the whole subtree into the sketch
// page's initial compile even though all three panels gate their forms behind a
// collapsed-by-default CollapsibleItem. Loading it as a separate chunk lets the
// dev server skip compiling it until a settings section is actually expanded —
// the same code-split rationale as OptionsPanel's collapsed sections. The
// CollapsibleItem chrome stays static, so there is no loading flash on open.
const FieldRenderer = dynamic( () => import( "@/components/ClientProcessingSketch/components/SketchOptions/components/FieldRenderer" ) );

type GenericObjectFormProps = {
  basePath?: string;
  config: Record<string, FieldConfig>;
  /** Nesting level handed to each field: 0 renders top-level groups as banded
   *  sub-sections (see FieldRenderer's nested-object case). */
  depth?: number;
  /** Horizontal padding applied to LEAF fields only. Groups stay unpadded so
   *  their header band spans the panel edge to edge — the padding lives on the
   *  leaves precisely so the bands don't have to claw it back with negative
   *  margins, which never lined up with the panel's real content box. */
  leafPaddingClassName?: string;
};

// The plugin-INJECTED Interaction panel (config.managed — see getSketchMeta).
// Its field descriptor is present in `config` unconditionally (a static,
// cheap schema), but the panel only shows while the plugin-managed block
// actually exists in the scope's `interactive` namespace — seeded the first
// time a binding picks a live input source, pruned when the last such binding
// goes (see BindingAffordance) — so its lifecycle exactly tracks the value
// block it edits, and a sketch with zero bindings never shows a giant
// "Interaction" settings group. It edits the `interactive` namespace, never
// the sketch parameters.
//
// A sketch-DECLARED interaction config (no `managed` flag — hand-tracking,
// audio, …) never routes through here: it is a real sketch parameter, edited
// at the sketch scope and rendered unconditionally like any other field.
function ManagedInteractionField( {
  sketchBasePath, fieldName, config
}: {
  sketchBasePath: string;
  fieldName: string;
  config: FieldConfig;
} ) {
  const interactiveScope = interactiveScopeFor( sketchBasePath );
  const interaction = useWatch( {
    name: `${ interactiveScope }.interaction`
  } );

  if ( interaction === undefined ) {
    return null;
  }

  return (
    <FieldRenderer
      fieldBasePath={ interactiveScope }
      fieldName={ fieldName }
      config={ config }
    />
  );
}

export default function GenericObjectForm( {
  basePath = "",
  config,
  depth = 0,
  leafPaddingClassName = "px-3"
}: GenericObjectFormProps ) {
  const keys = Object.keys( config );

  return (
    <div className="flex flex-col gap-1.5">
      {keys.map( (
        fieldName, index
      ) => {
        const fieldConfig = config[ fieldName ];

        if ( !fieldConfig ) {
          console.warn( `No form config found for field "${ fieldName }".` );
          return null;
        }

        if ( fieldName === "interaction" && fieldConfig.managed ) {
          return (
            <ManagedInteractionField
              key={ fieldName }
              sketchBasePath={ basePath }
              fieldName={ fieldName }
              config={ fieldConfig }
            />
          );
        }

        const isBand =
          depth === 0 && fieldConfig.component === "nested-object";

        const field = (
          <FieldRenderer
            fieldBasePath={ basePath }
            fieldName={ fieldName }
            config={ fieldConfig }
            depth={ depth }
            leafPaddingClassName={ leafPaddingClassName }
            showTopRule={ isBand && index > 0 }
          />
        );

        // A band is full-bleed; a leaf carries the panel's padding.
        return (
          <div
            key={ fieldName }
            className={ isBand ? undefined : leafPaddingClassName }
          >
            {field}
          </div>
        );
      } )}
    </div>
  );
}
