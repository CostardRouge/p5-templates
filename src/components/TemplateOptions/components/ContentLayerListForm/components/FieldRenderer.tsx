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

type FieldRendererProps = {
  fieldBasePath: `content.${ number }` | `slides.${ number }.content.${ number }`;
  fieldName: string;
  config: FieldConfig;
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
        // Color inputs don't look good with padding
        return <input type="color" {...commonInputProps} />;
      case "textarea":
        return <textarea {...commonInputProps} rows={2} />;
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
