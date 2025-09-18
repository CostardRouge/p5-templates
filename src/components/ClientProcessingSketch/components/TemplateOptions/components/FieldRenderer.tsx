import React, {
  Fragment
} from "react";
import {
  useFormContext, get
} from "react-hook-form";
import {
  FieldConfig
} from "./ContentItems/constants/field-config";

import ControlledImagesStackInput from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/components/ControlledImagesStackInput/ControlledImagesStackInput";
import ControlledImageInput from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/components/ControlledImageInput/ControlledImageInput";
import ControlledColorInput from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/components/ControlledColorInput/ControlledColorInput";
import ConditionalGroup from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/components/ConditionalGroup";

type FieldRendererProps = {
  fieldBasePath: string;
  fieldName: string;
  config: FieldConfig;
};

export default function FieldRenderer( {
  fieldBasePath, fieldName, config
}: FieldRendererProps ) {
  const {
    register, formState: {
      errors
    }
  } = useFormContext();

  const registeredName = fieldName ? `${ fieldBasePath }.${ fieldName }` : fieldBasePath;

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
            {...{
              ...commonInputProps,
              className: `${ commonInputProps.className } p-0`
            }}
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
          <select
            {...{
              ...commonInputProps,
              className: `${ commonInputProps.className } p-1`
            }}
            {...register(
              registeredName,
              {
                setValueAs: config.asNumber
                  ? ( value: unknown ) => ( value === "" || value == null ? undefined : Number( value ) )
                  : undefined,
              }
            )}
          >
            {config.noneLabel ? (
              <option value="">{config.noneLabel || "--"}</option>
            ) : null}

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
            <label htmlFor={registeredName} className="text-gray-400">
              {config.label}
            </label>

            <div className="p-1 border border-gray-300 rounded-sm space-y-1">
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
    <div className="text-xs">
      {/* Don't show a label for groups, as they have their own internal labels */}
      {( config.component !== "nested-object" && config.component !== "conditional-group" ) && config.label && (
        <label htmlFor={registeredName} className=" text-gray-400">
          {config.label}
        </label>
      )}

      {/* For conditional groups, the main label is part of the box */}
      {config.component === "conditional-group" && config.label && (
        <h4 className="text-gray-400">{config.label}</h4>
      )}

      {renderInput()}

      {/* Display validation errors */}
      {error && <p className="text-red-500 mt-1">{error.message?.toString()}</p>}
    </div>
  );
}
