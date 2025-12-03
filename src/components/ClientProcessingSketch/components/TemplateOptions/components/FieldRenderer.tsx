import React, {
  Fragment, useCallback
} from "react";
import {
  get, useFormContext, useWatch
} from "react-hook-form";
import {
  FieldConfig
} from "./ContentItems/constants/field-config";

import ControlledImagesStackInput
  from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/components/ControlledImagesStackInput/ControlledImagesStackInput";
import ControlledSizePresetSelect
  from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/components/ControlledSizePresetSelect/ControlledSizePresetSelect";
import ControlledImageInput
  from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/components/ControlledImageInput/ControlledImageInput";
import ControlledColorInput
  from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/components/ControlledColorInput/ControlledColorInput";
import ConditionalGroup
  from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/components/ConditionalGroup";
import useSketch from "@/components/ClientProcessingSketch/components/SketchProvider/hooks/useSketch";

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
    }, control, setValue
  } = useFormContext();
  
  const { sketchFormValues } = useSketch();

  const registeredName = fieldName ? `${ fieldBasePath }.${ fieldName }` : fieldBasePath;

  const error = get(
    errors,
    registeredName
  );

  // Watch current value
  const currentValue = useWatch( {
    control,
    name: registeredName,
  } );

  // Watch slider value for display
  const sliderValue = useWatch( {
    control,
    name: registeredName,
    defaultValue: config.component === "slider" ? ( config.min ?? 0 ) : undefined
  } );

  // Get default value from sketch form values
  const getDefaultValue = useCallback(() => {
    if (!sketchFormValues) return undefined;
    
    // Parse the path to get nested value
    const pathParts = registeredName.split('.');
    let defaultValue: any = sketchFormValues;
    
    for (const part of pathParts) {
      if (defaultValue && typeof defaultValue === 'object' && part in defaultValue) {
        defaultValue = defaultValue[part];
      } else {
        return undefined;
      }
    }
    
    return defaultValue;
  }, [registeredName, sketchFormValues]);

  // Check if value has changed from default
  const isChanged = useCallback(() => {
    const defaultValue = getDefaultValue();
    if (defaultValue === undefined) return false;
    
    // Deep comparison for arrays and objects
    if (Array.isArray(currentValue) && Array.isArray(defaultValue)) {
      return JSON.stringify(currentValue) !== JSON.stringify(defaultValue);
    }
    
    return currentValue !== defaultValue;
  }, [currentValue, getDefaultValue]);

  // Handle double-click to reset to default
  const handleLabelDoubleClick = useCallback(() => {
    const defaultValue = getDefaultValue();
    if (defaultValue !== undefined) {
      setValue(registeredName, defaultValue, { shouldDirty: true, shouldValidate: true });
    }
  }, [getDefaultValue, registeredName, setValue]);

  const renderInput = () => {
    // A helper for common props to keep the JSX clean
    const commonInputProps = {
      id: registeredName,
      placeholder: config.placeholder,
      className: "w-full p-1 border border-theme rounded-lg bg-background text-foreground",
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
          <div className="flex items-center gap-2">
            <input
              type="range"
              {...{
                ...commonInputProps,
                className: `${ commonInputProps.className } flex-1`
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
            <span className="text-xs font-mono bg-theme/20 px-2 py-0.5 rounded min-w-[3rem] text-center border border-theme/30">
              {sliderValue !== undefined && sliderValue !== null ? Number( sliderValue ).toFixed( config.step && config.step < 1 ? 2 : 0 ) : config.min ?? 0}
            </span>
          </div>
        );

      case "textarea":
        return (
          <textarea
            {...commonInputProps}
            {...register( registeredName )}
            rows={4}
          />
        );

      case "select":
        return (
          <select
            {...{
              ...commonInputProps,
              className: `${ commonInputProps.className }`
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

      case "size-preset":
        return (
          <ControlledSizePresetSelect
            id={registeredName}
            className="p-1"
            options={config.options}
          />
        );

      case "nested-object":
        return (
          <Fragment>
            <label 
              htmlFor={registeredName} 
              className={`text-gray-400 cursor-pointer select-none ${valueChanged ? 'italic' : ''}`}
              onDoubleClick={handleLabelDoubleClick}
              title="Double-click to reset to default"
            >
              {config.label}{valueChanged && ' *'}
            </label>

            <div className="p-1 border border-theme rounded-xl space-y-1 bg-background/50">
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
            selectClassName={`${ commonInputProps.className }`}
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

  const valueChanged = isChanged();

  return (
    <div className="text-xs">
      {/* Don't show a label for groups, as they have their own internal labels */}
      {( config.component !== "nested-object" && config.component !== "conditional-group" ) && config.label && (
        <label 
          htmlFor={registeredName} 
          className={`text-gray-400 cursor-pointer select-none ${valueChanged ? 'italic' : ''}`}
          onDoubleClick={handleLabelDoubleClick}
          title="Double-click to reset to default"
        >
          {config.label}{valueChanged && ' *'}
        </label>
      )}

      {/* For conditional groups, the main label is part of the box */}
      {config.component === "conditional-group" && config.label && (
        <h4 
          className={`text-gray-400 cursor-pointer select-none ${valueChanged ? 'italic' : ''}`}
          onDoubleClick={handleLabelDoubleClick}
          title="Double-click to reset to default"
        >
          {config.label}{valueChanged && ' *'}
        </h4>
      )}

      {renderInput()}

      {/* Display validation errors */}
      {error && <p className="text-red-500 mt-1">{error.message?.toString()}</p>}
    </div>
  );
}
