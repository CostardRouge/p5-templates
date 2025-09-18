import {
  FieldConfig
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

import FieldRenderer from "@/components/ClientProcessingSketch/components/TemplateOptions/components/FieldRenderer";

type GenericObjectFormProps = {
  basePath?: string;
  config: Record<string, FieldConfig>;
};

export default function GenericObjectForm( {
  basePath = "", config
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
            key={fieldName}
            fieldBasePath={basePath}
            fieldName={fieldName}
            config={fieldConfig}
          />
        );
      } )}
    </div>
  );
}
