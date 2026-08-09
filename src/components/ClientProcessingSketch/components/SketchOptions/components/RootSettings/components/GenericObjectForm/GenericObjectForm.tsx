import dynamic from "next/dynamic";
import {
  useWatch
} from "react-hook-form";
import {
  FieldConfig
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";
import {
  needsInteractionBlock
} from "@/p5/utils/interaction/bindings.js";

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
};

// The shared Interaction block's field descriptor is present in `config`
// unconditionally (it's a static, cheap schema — see getSketchMeta), but the
// block itself — and this panel — should only show up once a live binding
// actually reads from it. Otherwise every sketch with the plugin on would
// show a giant "Interaction" settings group despite having zero bindings.
// Watching `bindings` (rather than `interaction` itself) means the panel
// disappears the instant the last qualifying binding is removed, matching
// BindingAffordance/InteractivePanel's pruning of the value block.
function InteractionField( {
  fieldBasePath, fieldName, config
}: {
  fieldBasePath: string;
  fieldName: string;
  config: FieldConfig;
} ) {
  const bindings = useWatch( {
    name: `${ fieldBasePath }.bindings`
  } );

  if ( !needsInteractionBlock( bindings ) ) {
    return null;
  }

  return (
    <FieldRenderer
      fieldBasePath={ fieldBasePath }
      fieldName={ fieldName }
      config={ config }
    />
  );
}

export default function GenericObjectForm( {
  basePath = "",
  config
}: GenericObjectFormProps ) {
  const keys = Object.keys( config );

  return (
    <div className="flex flex-col gap-2">
      {keys.map( ( fieldName ) => {
        const fieldConfig = config[ fieldName ];

        if ( !fieldConfig ) {
          console.warn( `No form config found for field "${ fieldName }".` );
          return null;
        }

        if ( fieldName === "interaction" ) {
          return (
            <InteractionField
              key={ fieldName }
              fieldBasePath={ basePath }
              fieldName={ fieldName }
              config={ fieldConfig }
            />
          );
        }

        return (
          <FieldRenderer
            key={ fieldName }
            fieldBasePath={ basePath }
            fieldName={ fieldName }
            config={ fieldConfig }
          />
        );
      } )}
    </div>
  );
}
