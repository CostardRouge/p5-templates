import {
  ChevronDown,
} from "lucide-react";
import {
  get, useFormContext, useWatch
} from "react-hook-form";
import ConditionalGroup
  from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/components/ConditionalGroup";
import ControlledColorInput
  from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/components/ControlledColorInput/ControlledColorInput";
import ControlledJsonInput
  from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/components/ControlledJsonInput";
import ControlledImageInput
  from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/components/ControlledImageInput/ControlledImageInput";
import ControlledImagesStackInput
  from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/components/ControlledImagesStackInput/ControlledImagesStackInput";
import ControlledSizePresetSelect
  from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/components/ControlledSizePresetSelect/ControlledSizePresetSelect";
import ControlledEasingInput
  from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/components/ControlledEasingInput/ControlledEasingInput";
import CollapsibleItem from "@/components/CollapsibleItem";
import type {
  FieldConfig
} from "./ContentItems/constants/field-config";
import ItemListRenderer from "./ItemListRenderer";

type FieldRendererProps = {
  fieldBasePath: string;
  fieldName: string;
  config: FieldConfig;
  hideLabel?: boolean;
};

export default function FieldRenderer( {
  fieldBasePath,
  fieldName,
  config,
  hideLabel = false,
}: FieldRendererProps ) {
  const {
    register,
    setValue,
    resetField,
    formState: {
      errors,
      defaultValues,
    },
    control,
  } = useFormContext();

  const registeredName = fieldName
    ? `${ fieldBasePath }.${ fieldName }`
    : fieldBasePath;

  const error = get(
    errors,
    registeredName
  );

  // Watch current value for display (slider) and modified detection
  const currentValue = useWatch( {
    control,
    name: registeredName,
  } );

  const defaultValue = get(
    defaultValues ?? {
    },
    registeredName
  );
  const isModified =
    JSON.stringify( currentValue ) !== JSON.stringify( defaultValue );

  const handleReset = ( e: React.MouseEvent ) => {
    e.preventDefault();
    resetField( registeredName );
  };

  const renderInput = () => {
    const commonInputProps = {
      id: registeredName,
      placeholder: config.placeholder,
      className: "w-full p-1 border border-theme rounded-lg bg-background text-foreground",
      "aria-invalid": !!error,
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
                valueAsNumber: true,
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
              {...commonInputProps}
              {...register(
                registeredName,
                {
                  valueAsNumber: true,
                }
              )}
              step={config.step}
              min={config.min}
              max={config.max}
            />
            <input
              type="number"
              aria-label={`${ config.label ?? registeredName } value`}
              className="text-xs font-mono bg-theme/20 px-1 py-0.5 rounded w-14 text-center border border-theme/30 focus:outline-none focus:ring-1 focus:ring-theme"
              value={currentValue != null ? Number( currentValue ).toFixed( config.step && config.step < 1 ? 2 : 0 ) : ( config.min ?? 0 )}
              step={config.step}
              min={config.min}
              max={config.max}
              onChange={( e ) => {
                const parsed = config.step && config.step < 1
                  ? parseFloat( e.target.value )
                  : parseInt(
                    e.target.value,
                    10
                  );

                if ( !isNaN( parsed ) ) {
                  const clamped =
                    config.min !== undefined && config.max !== undefined
                      ? Math.min(
                        config.max,
                        Math.max(
                          config.min,
                          parsed
                        )
                      )
                      : parsed;

                  setValue(
                    registeredName,
                    clamped,
                    {
                      shouldDirty: true
                    }
                  );
                }
              }}
            />
          </div>
        );

      case "textarea":
        return (
          <textarea
            rows={4}
            {...commonInputProps}
            {...register( registeredName )}
          />
        );

      case "select":
        return (
          <select
            {...commonInputProps}
            {...register(
              registeredName,
              {
                setValueAs: config.asNumber
                  ? ( value: unknown ) =>
                    value === "" || value == null ? undefined : Number( value )
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
            className="p-1"
            id={registeredName}
            options={config.options}
          />
        );

      case "nested-object":
        return (
          <CollapsibleItem
            initialExpandedValue={false}
            header={( expanded ) => (
              <div
                className="text-gray-500 cursor-pointer select-none flex items-center gap-1"
                title="Click to expand/collapse"
              >
                <ChevronDown
                  className="w-3 h-3 transition-transform"
                  style={{
                    transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
                  }}
                />
                <span>
                  {config.label} ({Object.keys( config.fields ).length} fields)
                </span>
              </div>
            )}
          >
            <div className="p-1 border border-theme rounded-xl space-y-1 bg-background/50 ml-2">
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
          </CollapsibleItem>
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

      case "hidden":
        return <input type="hidden" {...register( registeredName )} />;

      case "json":
        return (
          <ControlledJsonInput
            config={config}
            name={registeredName}
            textareaClassName={commonInputProps.className}
          />
        );

      case "item-list":
        return <ItemListRenderer name={registeredName} config={config} />;

      case "easing":
        return <ControlledEasingInput name={registeredName} />;

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
      {config.component !== "nested-object" &&
        config.component !== "conditional-group" &&
        config.component !== "item-list" &&
        config.component !== "hidden" &&
        config.label &&
        !hideLabel && (
        <div className="flex items-center gap-1">
          <label
            htmlFor={registeredName}
            className={`select-none ${
              isModified
                ? "font-medium"
                : "text-gray-400"
            }`}
          >
            {config.label}
          </label>
          {isModified && (
            <button
              type="button"
              onClick={handleReset}
              tabIndex={-1}
              title="Reset to saved value"
              className="text-gray-400 hover:text-foreground transition-colors"
            >
              · reset
            </button>
          )}
        </div>
      )}

      {renderInput()}

      {/* Display validation errors */}
      {error && (
        <p className="text-red-500 mt-1">{error.message?.toString()}</p>
      )}
    </div>
  );
}
