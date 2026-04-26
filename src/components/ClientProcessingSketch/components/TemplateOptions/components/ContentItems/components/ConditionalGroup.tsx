import React from "react";
import {
  useFormContext, useWatch
} from "react-hook-form";
import {
  ConditionalGroupConfig
} from "../constants/field-config";
import FieldRenderer from "../../FieldRenderer";
import {
  ChevronDown
} from "lucide-react";
import CollapsibleItem from "@/components/CollapsibleItem";

function getDefaultValueForFieldConfig( config: any ): any {
  switch ( config?.component ) {
    case "text":
    case "textarea":
      return "";
    case "number":
    case "slider":
      return config.min ?? 0;
    case "checkbox":
      return false;
    case "color":
      return [
        255,
        255,
        255
      ];
    case "select":
      return config.options?.[ 0 ]?.value ?? "";
    case "nested-object": {
      const result: Record<string, any> = {
      };

      for ( const [
        key,
        subConfig
      ] of Object.entries( config.fields ?? {
        } ) ) {
        result[ key ] = getDefaultValueForFieldConfig( subConfig );
      }
      return result;
    }
    case "item-list":
      return config.defaultItems ?? [
      ];
    default:
      return "";
  }
}

type ConditionalGroupProps = {
  basePath: string;
  selectClassName: string;
  config: ConditionalGroupConfig;
};

export default function ConditionalGroup( {
  basePath,
  config,
  selectClassName,
}: ConditionalGroupProps ) {
  const {
    control, setValue, unregister, clearErrors
  } = useFormContext();
  const {
    conditionalOn, typeSelector, configs, schema
  } = config;

  const watchedValue = useWatch( {
    control,
    name: `${ basePath }.${ conditionalOn }`,
  } );

  const handleTypeChange = ( e: React.ChangeEvent<HTMLSelectElement> ) => {
    const newType = e.target.value;

    if ( newType === "" ) {
      setValue(
        basePath,
        undefined,
        {
          shouldValidate: true,
          shouldDirty: true,
        }
      );
      unregister( basePath );
      clearErrors( basePath );
      return;
    }

    const nextConfig = configs[ newType as keyof typeof configs ];

    // Build a fresh default object for the selected variant
    const defaultObject =
      schema && typeof ( schema as any ).parse === "function"
        ? schema.parse( {
          [ conditionalOn ]: newType,
        } )
        : {
          [ conditionalOn ]: newType,
          ...( nextConfig
            ? Object.fromEntries( Object.entries( nextConfig ).map( ( [
              key,
              fieldConfig
            ] ) => [
              key,
              getDefaultValueForFieldConfig( fieldConfig ),
            ] ) )
            : {
            } ),
        };

    setValue(
      basePath,
      defaultObject,
      {
        shouldValidate: true,
      }
    );
  };

  const conditionalFieldName = `${ basePath }.${ conditionalOn }`;
  const activeConfig = configs[ watchedValue as keyof typeof configs ];

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
            {config.label}
          </span>
        </div>
      )}
    >

      <div className="p-1 border border-theme space-y-2 rounded-xl">
        <div>
          <label
            htmlFor={conditionalFieldName}
            className="text-xs text-gray-400"
          >
            {config.typeSelector.label || "Type"}
          </label>

          <select
            id={conditionalFieldName}
            value={watchedValue ?? ""} // "" shows None when undefined
            onChange={handleTypeChange}
            className={selectClassName}
          >
            <option value="">{config.typeSelector.noneLabel || "--"}</option>

            {config.typeSelector.options.map( ( option ) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ) )}
          </select>
        </div>

        {activeConfig &&
          Object.entries( activeConfig ).map( ( [
            subFieldName,
            subConfig
          ] ) => (
            <FieldRenderer
              key={subFieldName}
              fieldBasePath={basePath}
              fieldName={subFieldName}
              config={subConfig}
            />
          ) )}
      </div>
    </CollapsibleItem>
  );
}
