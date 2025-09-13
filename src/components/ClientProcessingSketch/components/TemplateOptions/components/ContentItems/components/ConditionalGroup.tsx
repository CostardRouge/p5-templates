import React, {
  Fragment
} from "react";
import {
  useFormContext, useWatch
} from "react-hook-form";
import {
  ConditionalGroupConfig
} from "../constants/field-config";
import FieldRenderer from "./FieldRenderer";

type ConditionalGroupProps = {
  basePath: string;
  selectClassName: string;
  config: ConditionalGroupConfig;
};

export default function ConditionalGroup( {
  basePath, config, selectClassName
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
      // None selected -> remove whole object
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

    // Build a fresh default object for the selected variant
    const defaultObject = schema.parse( {
      [ conditionalOn ]: newType
    } );

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
    <Fragment>
      <div className="p-1 mt-1 border border-gray-300 space-y-1 rounded-sm">
        <label htmlFor={conditionalFieldName} className="text-xs text-gray-400">
          {config.typeSelector.label || "Type"}
        </label>
        <select
          id={conditionalFieldName}
          value={watchedValue ?? ""} // "" shows None when undefined
          onChange={handleTypeChange}
          className={selectClassName}
        >
          <option value="">{config.typeSelector.noneLabel || "None"}</option>
          {config.typeSelector.options.map( ( option ) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ) )}
        </select>

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
    </Fragment>
  );
}
