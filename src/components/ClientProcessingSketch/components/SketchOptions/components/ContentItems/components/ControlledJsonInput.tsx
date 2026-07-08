import React, {
  useMemo
} from "react";
import {
  Controller, useFormContext
} from "react-hook-form";

type ControlledJsonInputProps = {
  name: string;
  textareaClassName: string;
  config: {
    component: "json";
    rows?: number;
  };
};

export default function ControlledJsonInput( {
  name, textareaClassName, config
}: ControlledJsonInputProps ) {
  const {
    control,
    setError,
    clearErrors
  } = useFormContext();

  // Memoize the helper functions to avoid recreating them on every render
  const {
    formatValue, parseValue
  } = useMemo(
    () => ( {
      formatValue: ( value: any ): string => {
        if ( value === null || value === undefined ) {
          return "";
        }

        if ( typeof value === "string" ) {
        // If it's already a string, it might be user input during editing
          return value;
        }

        return JSON.stringify(
          value,
          null,
          2
        );
      },

      parseValue: ( text: string ): any => {
        const trimmed = text.trim();

        if ( !trimmed ) {
          return null;
        }

        return JSON.parse( trimmed );
      }
    } ),
    []
  );

  return (
    <Controller
      name={ name }
      control={ control }
      render={ ( {
        field
      } ) => (
        <textarea
          className={ textareaClassName }
          rows={ config.rows ?? 4 }
          value={ formatValue( field.value ) }
          onChange={ ( e ) => {
            // Store the raw text during editing to allow invalid JSON temporarily
            field.onChange( e.target.value );
          } }
          onBlur={ ( e ) => {
            field.onBlur();

            const trimmed = e.target.value.trim();

            try {
              const parsed = parseValue( trimmed );

              field.onChange( parsed );
              clearErrors( name );
            } catch {
              setError(
                name,
                {
                  type: "validate",
                  message: "Invalid JSON"
                }
              );
            }
          } }
        />
      ) }
    />
  );
}