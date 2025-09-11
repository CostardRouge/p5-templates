import React, {
  Fragment
} from "react";
import {
  useFormContext, useWatch
} from "react-hook-form";
import {
  ConditionalGroupConfig
} from "../constants/field-config";
import FieldRenderer from "./FieldRenderer"; // We'll need this for recursion

type ConditionalGroupProps = {
  // The full path to the group object itself (e.g., 'content.0.pattern')
  basePath: string;
  selectClassName: string;
  config: ConditionalGroupConfig;
};

export default function ConditionalGroup( {
  basePath, config, selectClassName
}: ConditionalGroupProps ) {
  const {
    register, control, setValue
  } = useFormContext();
  const {
    conditionalOn, typeSelector, configs, schema, label
  } = config;

  // --- HOOK CALLED UNCONDITIONALLY ---
  // This is now safe because this component only renders for conditional groups.
  const watchedValue = useWatch( {
    control,
    name: `${ basePath }.${ conditionalOn }`, // e.g., 'content.0.pattern.type'
  } );

  const handleTypeChange = ( e: React.ChangeEvent<HTMLSelectElement> ) => {
    const newType = e.target.value;

    // Use the Zod schema to get a clean, default object for the new type.
    // This is crucial for resetting the state correctly.
    const defaultObject = schema.parse( {
      type: newType
    } );

    // Replace the entire object in the form state (e.g., the 'pattern' object).
    // This removes old fields ('columns') and adds the new default ones.
    setValue(
      basePath,
      defaultObject,
      {
        shouldValidate: true
      }
    );
  };

  const conditionalFieldName = `${ basePath }.${ conditionalOn }`;
  const activeConfig = configs[ watchedValue ]; // Get the fields for the currently selected type

  return (
    <Fragment>
      {/* Recursively Render the fields for the ACTIVE type */}
      <div className="p-1 mt-1 border border-gray-300 space-y-1 rounded-sm">
        {/* Render the Type Selector Dropdown */}
        <label htmlFor={conditionalFieldName} className="text-xs text-gray-400">{config.typeSelector.label || "Type"}</label>
        <select
          id={conditionalFieldName}
          {...register( conditionalFieldName )}
          onChange={handleTypeChange}
          className={selectClassName}
        >
          <option key="null" value="">
            --
          </option>
          {config.typeSelector.options.map( ( option ) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ) )}
        </select>

        {activeConfig && Object.entries( activeConfig ).map( ( [
          subFieldName,
          subConfig
        ] ) => (
          <FieldRenderer
            key={subFieldName}
            fieldBasePath={basePath} // Base path is the parent group (e.g., 'content.0.pattern')
            fieldName={subFieldName} // Field name is the child (e.g., 'columns')
            config={subConfig}
          />
        ) )}
      </div>
    </Fragment>
  );
}