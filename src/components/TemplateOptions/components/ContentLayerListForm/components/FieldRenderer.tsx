import React from "react";
import {
  useFormContext
} from "react-hook-form";
import {
  SketchOption
} from "@/types/sketch.types";
import {
  FieldConfig
} from "../constants/field-config";

import ControlledColorInput
  from "@/components/TemplateOptions/components/ContentLayerListForm/components/ControlledColorInput/ControlledColorInput";

type FieldRendererProps = {
  fieldBasePath: `content.${ number }` | `slides.${ number }.content.${ number }`;
  fieldName: string;
  config: FieldConfig;
};

// Helper to construct the full name for the select input
const getConditionalFieldName = (
  baseFieldName: string, conditionalOn: string
) => {
  return baseFieldName ? `${ baseFieldName }.${ conditionalOn }` : conditionalOn;
};

export default function FieldRenderer( {
  fieldBasePath, fieldName, config
}: FieldRendererProps ) {
  const {
    register
  } = useFormContext<SketchOption>();

  // Construct the final, full name for react-hook-form
  const registeredName = `${ fieldBasePath }.${ fieldName }` as const;

  const commonInputProps = {
    id: registeredName,
    ...register( registeredName ),
    className: "w-full p-1 border border-gray-300 rounded-sm",
    placeholder: config.placeholder,
  };

  const renderInput = () => {
    switch ( config.component ) {
      case "number":
        return <input type="number" {...commonInputProps} step={config.step} />;
      case "color":
        return <ControlledColorInput name={registeredName} />;
      case "textarea":
        return <textarea {...commonInputProps} rows={2} />;
      case "select":
        if ( !config.options ) {
          return <div className="text-red-500 text-xs">No options configured for this select field.</div>;
        }

        return (
          <select {...commonInputProps}>
            {config.options.map( ( option ) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ) )}
          </select>
        );
      case "text":
      default:
        return <input type="text" {...commonInputProps} />;
    }
  };

  return (
    <div>
      <label htmlFor={registeredName} className="text-xs text-gray-700">{config.label}</label>
      {renderInput()}
    </div>
  );
}
