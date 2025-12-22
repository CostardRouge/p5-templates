import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Controller, get, useFormContext, useWatch } from "react-hook-form";
import ConditionalGroup from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/components/ConditionalGroup";
import ControlledColorInput from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/components/ControlledColorInput/ControlledColorInput";
import ControlledImageInput from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/components/ControlledImageInput/ControlledImageInput";
import ControlledImagesStackInput from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/components/ControlledImagesStackInput/ControlledImagesStackInput";
import ControlledSizePresetSelect from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/components/ControlledSizePresetSelect/ControlledSizePresetSelect";
import CollapsibleItem from "@/components/CollapsibleItem";
import type { FieldConfig } from "./ContentItems/constants/field-config";
import ItemListRenderer from "./ItemListRenderer";

type FieldRendererProps = {
  fieldBasePath: string;
  fieldName: string;
  config: FieldConfig;
  hideLabel?: boolean;
};

export default function FieldRenderer({
  fieldBasePath,
  fieldName,
  config,
  hideLabel = false,
}: FieldRendererProps) {
  const {
    register,
    formState: { errors },
    control,
    clearErrors,
    setError,
  } = useFormContext();

  const registeredName = fieldName
    ? `${fieldBasePath}.${fieldName}`
    : fieldBasePath;

  const error = get(errors, registeredName);

  // Watch slider value for display
  const sliderValue = useWatch({
    control,
    name: registeredName,
    defaultValue: config.component === "slider" ? (config.min ?? 0) : undefined,
  });

  const watchedJsonValue = useWatch({
    control,
    name: registeredName,
  });

  const jsonDirtyRef = useRef(false);
  const [jsonDraft, setJsonDraft] = useState<string>("");

  useEffect(() => {
    if (config.component !== "json") return;

    const pretty = JSON.stringify(watchedJsonValue ?? {}, null, 2);

    if (!jsonDirtyRef.current) {
      setJsonDraft(pretty);
    }
  }, [config.component, watchedJsonValue]);

  const renderInput = () => {
    // A helper for common props to keep the JSX clean
    const commonInputProps = {
      id: registeredName,
      placeholder: config.placeholder,
      className:
        "w-full p-1 border border-theme rounded-lg bg-background text-foreground",
      "aria-invalid": !!error,
    };

    switch (config.component) {
      case "checkbox":
        return (
          <input
            type="checkbox"
            {...commonInputProps}
            {...register(registeredName)}
            className={`${commonInputProps.className} block w-fit`}
          />
        );

      case "number":
        return (
          <input
            type="number"
            {...commonInputProps}
            {...register(registeredName, {
              valueAsNumber: true,
            })}
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
                className: `${commonInputProps.className} flex-1`,
              }}
              {...register(registeredName, {
                valueAsNumber: true,
              })}
              step={config.step}
              min={config.min}
              max={config.max}
            />
            <span className="text-xs font-mono bg-theme/20 px-2 py-0.5 rounded min-w-[3rem] text-center border border-theme/30">
              {sliderValue !== undefined && sliderValue !== null
                ? Number(sliderValue).toFixed(
                    config.step && config.step < 1 ? 2 : 0
                  )
                : (config.min ?? 0)}
            </span>
          </div>
        );

      case "textarea":
        return (
          <textarea
            {...commonInputProps}
            {...register(registeredName)}
            rows={4}
          />
        );

      case "select":
        return (
          <select
            {...{
              ...commonInputProps,
              className: `${commonInputProps.className}`,
            }}
            {...register(registeredName, {
              setValueAs: config.asNumber
                ? (value: unknown) =>
                    value === "" || value == null ? undefined : Number(value)
                : undefined,
            })}
          >
            {config.noneLabel ? (
              <option value="">{config.noneLabel || "--"}</option>
            ) : null}

            {config.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
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
          <CollapsibleItem
            initialExpandedValue={false}
            header={(expanded) => (
              <div
                className="text-gray-400 cursor-pointer select-none flex items-center gap-1"
                title="Click to expand/collapse"
              >
                <ChevronDown
                  className="w-3 h-3 transition-transform"
                  style={{
                    transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
                  }}
                />
                <span>
                  {config.label} ({Object.keys(config.fields).length} fields)
                </span>
              </div>
            )}
          >
            <div className="p-1 border border-theme rounded-xl space-y-1 bg-background/50 ml-4">
              {Object.entries(config.fields).map(
                ([subFieldName, subConfig]) => (
                  <FieldRenderer
                    key={subFieldName}
                    fieldBasePath={registeredName}
                    fieldName={subFieldName}
                    config={subConfig}
                  />
                )
              )}
            </div>
          </CollapsibleItem>
        );

      case "conditional-group": {
        return (
          <ConditionalGroup
            basePath={registeredName}
            selectClassName={`${commonInputProps.className}`}
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
        return <input type="hidden" {...register(registeredName)} />;

      case "json":
        return (
          <Controller
            name={registeredName}
            control={control}
            render={({ field }) => (
              <textarea
                {...commonInputProps}
                rows={config.rows ?? 6}
                value={jsonDraft}
                onChange={(e) => {
                  jsonDirtyRef.current = true;
                  setJsonDraft(e.target.value);
                }}
                onBlur={() => {
                  field.onBlur();

                  const trimmed = jsonDraft.trim();

                  try {
                    const parsed = trimmed ? JSON.parse(trimmed) : {};

                    jsonDirtyRef.current = false;
                    field.onChange(parsed);
                    clearErrors(registeredName);
                    setJsonDraft(JSON.stringify(parsed ?? {}, null, 2));
                  } catch {
                    setError(registeredName, {
                      type: "validate",
                      message: "Invalid JSON",
                    });
                  }
                }}
              />
            )}
          />
        );

      case "item-list":
        return <ItemListRenderer name={registeredName} config={config} />;

      default:
        return (
          <input
            type="text"
            {...commonInputProps}
            {...register(registeredName)}
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
          <label htmlFor={registeredName} className="text-gray-400 select-none">
            {config.label}
          </label>
        )}

      {/* For conditional groups, the main label is part of the box */}
      {config.component === "conditional-group" && config.label && (
        <h4 className="text-gray-400 select-none">{config.label}</h4>
      )}

      {renderInput()}

      {/* Display validation errors */}
      {error && (
        <p className="text-red-500 mt-1">{error.message?.toString()}</p>
      )}
    </div>
  );
}
