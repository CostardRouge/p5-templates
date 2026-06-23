import dynamic from "next/dynamic";
import {
  FieldConfig
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

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
const FieldRenderer = dynamic( () => import( "@/components/ClientProcessingSketch/components/TemplateOptions/components/FieldRenderer" ) );

type GenericObjectFormProps = {
  basePath?: string;
  config: Record<string, FieldConfig>;
};

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
