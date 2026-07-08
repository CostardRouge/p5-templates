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
import {
  useCollapsibleContext
} from "@/components/ClientProcessingSketch/components/SketchOptions/hooks/useCollapsibleStates";
import {
  CONTROL_BAR_CLASS,
  CONTROL_CHEVRON_CLASS
} from "../constants/control-bar";
import {
  BarLabelSegment
} from "./ControlChrome";

function getDefaultValueForFieldConfig( config: any ): any {
  // A field config can pin its own default (e.g. a checkbox that should
  // start checked when its branch is selected).
  if ( config?.default !== undefined ) {
    return config.default;
  }

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
    case "select": {
      const value = config.options?.[ 0 ]?.value ?? "";

      return config.asNumber && value !== "" ? Number( value ) : value;
    }
    case "webcam-device-select":
      return "";
    case "asset":
    case "asset-stack":
    case "image":
    case "images-stack":
      return [];
    case "nested-object": {
      const result: Record<string, any> = {};

      for ( const [
        key,
        subConfig
      ] of Object.entries( config.fields ?? {} ) ) {
        result[ key ] = getDefaultValueForFieldConfig( subConfig );
      }
      return result;
    }
    case "item-list":
      return config.defaultItems ?? [];
    default:
      return "";
  }
}

type ConditionalGroupProps = {
  basePath: string;
  config: ConditionalGroupConfig;
};

export default function ConditionalGroup( {
  basePath,
  config
}: ConditionalGroupProps ) {
  const {
    control, setValue, unregister, clearErrors
  } = useFormContext();

  const {
    getExpanded, setExpanded
  } = useCollapsibleContext();
  const collapsibleKey = `conditional-${ basePath }`;
  const expanded = getExpanded(
    collapsibleKey,
    false
  );
  const {
    conditionalOn, typeSelector, configs, schema
  } = config;

  const watchedValue = useWatch( {
    control,
    name: `${ basePath }.${ conditionalOn }`
  } );

  const handleTypeChange = ( e: React.ChangeEvent<HTMLSelectElement> ) => {
    const newType = e.target.value;

    if ( newType === "" ) {
      setValue(
        basePath,
        undefined,
        {
          shouldValidate: true,
          shouldDirty: true
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
          [ conditionalOn ]: newType
        } )
        : {
          [ conditionalOn ]: newType,
          ...( nextConfig
            ? Object.fromEntries( Object.entries( nextConfig ).map( ( [
              key,
              fieldConfig
            ] ) => [
              key,
              getDefaultValueForFieldConfig( fieldConfig )
            ] ) )
            : {} )
        };

    setValue(
      basePath,
      defaultObject,
      {
        shouldValidate: true
      }
    );
  };

  const conditionalFieldName = `${ basePath }.${ conditionalOn }`;
  const activeConfig = configs[ watchedValue as keyof typeof configs ];

  return (
    <CollapsibleItem
      expanded={ expanded }
      onToggle={ ( isExpanded ) => setExpanded(
        collapsibleKey,
        isExpanded
      ) }
      header={ ( expanded ) => (
        <div
          className="text-gray-500 cursor-pointer select-none flex min-w-0 items-center gap-1"
          title="Click to expand/collapse"
        >
          <ChevronDown
            className="w-3 h-3 shrink-0 transition-transform"
            style={ {
              transform: expanded ? "rotate(0deg)" : "rotate(-90deg)"
            } }
          />
          <span className="truncate">
            {config.label}
          </span>
        </div>
      ) }
    >

      <div className="p-1 border border-theme space-y-2 rounded-xl">
        {/* Type selector: segmented bar [ label | current type ], the
            invisible native select covers the whole bar. */}
        <div className={ CONTROL_BAR_CLASS }>
          <BarLabelSegment label={ config.typeSelector.label || "Type" } />

          <span className="pointer-events-none flex min-w-0 flex-1 items-center justify-between gap-1 px-2.5">
            <span className="truncate">
              {config.typeSelector.options.find( ( option ) => option.value === watchedValue )?.label ?? ( config.typeSelector.noneLabel || "--" )}
            </span>
            <ChevronDown className={ CONTROL_CHEVRON_CLASS } />
          </span>

          <select
            id={ conditionalFieldName }
            aria-label={ config.typeSelector.label || "Type" }
            value={ watchedValue ?? "" } // "" shows None when undefined
            onChange={ handleTypeChange }
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          >
            {!config.hideNone && (
              <option value="">{config.typeSelector.noneLabel || "--"}</option>
            )}

            {config.typeSelector.options.map( ( option ) => (
              <option key={ option.value } value={ option.value }>
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
              key={ subFieldName }
              fieldBasePath={ basePath }
              fieldName={ subFieldName }
              config={ subConfig }
            />
          ) )}
      </div>
    </CollapsibleItem>
  );
}
