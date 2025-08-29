import React, {
  Fragment
} from "react";
import {
  useFormContext, useWatch, get
} from "react-hook-form";
import {
  FieldConfig
} from "../constants/field-config"; // Import the specific type

import ControlledImagesStackInput from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentLayerListForm/components/ControlledImagesStackInput/ControlledImagesStackInput";
import ControlledImageInput from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentLayerListForm/components/ControlledImageInput/ControlledImageInput";
import ControlledColorInput from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentLayerListForm/components/ControlledColorInput/ControlledColorInput";
import ConditionalGroup from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentLayerListForm/components/ConditionalGroup";

// Define the shape of our props
type FieldRendererProps = {
  // The 'base' path to this specific item in the form array (e.g., 'content.0')
  // We make this more generic to handle any potential nesting structure
  fieldBasePath: string;
  // The local name of the field within its parent object (e.g., 'pattern', 'columns')
  fieldName: string;
  config: FieldConfig;
};

// This recursive component is the core of our form generator
export default function FieldRenderer( {
  fieldBasePath, fieldName, config
}: FieldRendererProps ) {
  const {
    register, formState: {
      errors
    }
  } = useFormContext();

  // Construct the full, unique path for react-hook-form (e.g., 'content.0.pattern.columns')
  const registeredName = fieldName ? `${ fieldBasePath }.${ fieldName }` : fieldBasePath;

  // --- Crucial for nested error handling ---
  // Use 'get' to safely access a deeply nested error object
  const error = get(
    errors,
    registeredName
  );

  const renderInput = () => {
    // A helper for common props to keep the JSX clean
    const commonInputProps = {
      id: registeredName,
      placeholder: config.placeholder,
      className: "w-full p-1 border border-gray-300 rounded-sm",
      "aria-invalid": !!error
    };

    switch ( config.component ) {
      case "checkbox":
        return (
          <input
            type="checkbox"
            {...commonInputProps}
            {...register( registeredName )}
            className={`${ commonInputProps.className } block w-fit`}
          />
        );

      case "number":
        return (
          <input
            type="number"
            {...commonInputProps}
            {...register(
              registeredName,
              {
                valueAsNumber: true
              }
            )}
            step={config.step}
            min={config.min}
            max={config.max}
          />
        );

      case "slider":
        return (
          <input
            type="range"
            {...commonInputProps}
            {...register(
              registeredName,
              {
                valueAsNumber: true
              }
            )}
            step={config.step}
            min={config.min}
            max={config.max}
          />
        );

      case "textarea":
        return (
          <textarea
            {...commonInputProps}
            {...register( registeredName )}
            rows={2}
          />
        );

      case "select":
        return (
          <select {...commonInputProps} {...register( registeredName )}>
            {config.options.map( ( option ) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ) )}
          </select>
        );

      case "nested-object":
        return (
          <Fragment>
            <label htmlFor={registeredName} className="text-xs text-gray-400">
              {config.label}
            </label>

            <div className="p-1 mt-1 border border-gray-300 space-y-1 rounded-sm">
              {Object.entries( config.fields ).map( ( [
                subFieldName,
                subConfig
              ] ) => (
                <FieldRenderer
                  key={subFieldName}
                  fieldBasePath={registeredName}
                  fieldName={subFieldName}
                  config={subConfig}
                />
              ) )}
            </div>
          </Fragment>
        );

      case "conditional-group": {
        return (
          <ConditionalGroup
            basePath={registeredName}
            selectClassName={commonInputProps.className}
            config={config}
          />
        );
      }

      case "color":
        return <ControlledColorInput name={registeredName} />;

      case "image":
        return <ControlledImageInput name={registeredName} />;

      case "images-stack":
        return <ControlledImagesStackInput name={registeredName} />;

      case "text":
      default:
        return (
          <input
            type="text"
            {...commonInputProps}
            {...register( registeredName )}
          />
        );
    }
  };

  return (
    <div>
      {/* Don't show a label for groups, as they have their own internal labels */}
      {( config.component !== "nested-object" && config.component !== "conditional-group" ) && config.label && (
        <label htmlFor={registeredName} className="text-xs text-gray-400">
          {config.label}
        </label>
      )}

      {/* For conditional groups, the main label is part of the box */}
      {config.component === "conditional-group" && config.label && (
        <h4 className="text-xs text-gray-400">{config.label}</h4>
      )}

      {renderInput()}

      {/* Display validation errors */}
      {error && <p className="text-xs text-red-500 mt-1">{error.message?.toString()}</p>}
    </div>
  );
}
