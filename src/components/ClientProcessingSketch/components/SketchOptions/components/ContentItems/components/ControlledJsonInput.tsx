import React, {
  useMemo, useRef, useState
} from "react";
import {
  Controller, useFormContext
} from "react-hook-form";
import {
  RotateCcw, Upload
} from "lucide-react";
import clsx from "clsx";
import {
  CONTROL_CARD_CLASS,
  CONTROL_CARD_HEADER_CLASS,
  CONTROL_RESET_BUTTON_CLASS
} from "../constants/control-bar";
import {
  HIDDEN_FILE_INPUT_CLASS
} from "@/components/hiddenFileInput";

type ControlledJsonInputProps = {
  name: string;
  textareaClassName: string;
  label?: string;
  isModified?: boolean;
  onReset?: ( event: React.MouseEvent ) => void;
  config: {
    component: "json";
    rows?: number;
    /** `accept` attribute for the upload input. Defaults to `.json`. */
    accept?: string;
  };
};

/**
 * The official "json" field type: a small file-picker that loads a `.json`
 * file from disk plus a text editor for pasting / hand-editing. Mirrors the
 * standardized asset kinds (images, videos, audios) so a sketch declares
 * `component: "json"` and gets both affordances for free.
 *
 * The stored value is the parsed JSON (object/array/primitive) once it is
 * valid, or the raw string while the user is mid-edit — consumers should
 * accept both (see `parseWavetable`, which takes a string or an object).
 */
export default function ControlledJsonInput( {
  name,
  textareaClassName,
  label,
  isModified = false,
  onReset,
  config
}: ControlledJsonInputProps ) {
  const {
    control,
    setError,
    clearErrors
  } = useFormContext();

  const fileInputRef = useRef<HTMLInputElement>( null );
  const [
    fileName,
    setFileName
  ] = useState<string | null>( null );

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
      } ) => {
        // Read a picked file into the field: parse it when valid, otherwise
        // keep the raw text so the user can fix it in the editor below.
        const loadFile = async( file: File ) => {
          const text = await file.text();

          setFileName( file.name );

          try {
            const parsed = parseValue( text );

            field.onChange( parsed );
            clearErrors( name );
          } catch {
            field.onChange( text );
            setError(
              name,
              {
                type: "validate",
                message: "Invalid JSON in the uploaded file"
              }
            );
          }
        };

        return (
          <div className={ CONTROL_CARD_CLASS }>
            <div className={ CONTROL_CARD_HEADER_CLASS }>
              <span className="flex min-w-0 items-center gap-1">
                {label && (
                  <span
                    className={ clsx(
                      "truncate",
                      isModified ? "font-medium text-foreground" : "text-label"
                    ) }
                  >
                    {label}
                  </span>
                )}
              </span>

              <span className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={ () => fileInputRef.current?.click() }
                  title="Load a .json file from your computer"
                  className={ clsx(
                    CONTROL_RESET_BUTTON_CLASS,
                    "inline-flex items-center gap-1"
                  ) }
                >
                  <Upload className="h-3.5 w-3.5 md:h-3 md:w-3" />
                  <span>Upload .json</span>
                </button>

                {isModified && onReset && (
                  <button
                    type="button"
                    tabIndex={ -1 }
                    title="Reset to saved value"
                    onClick={ onReset }
                    className={ CONTROL_RESET_BUTTON_CLASS }
                  >
                    <RotateCcw className="h-3.5 w-3.5 md:h-3 md:w-3" />
                  </button>
                )}

                <input
                  ref={ fileInputRef }
                  type="file"
                  accept={ config.accept ?? "application/json,.json" }
                  className={ HIDDEN_FILE_INPUT_CLASS }
                  onChange={ ( e ) => {
                    const file = e.target.files?.[ 0 ];

                    if ( file ) {
                      void loadFile( file );
                    }

                    // Clear so re-picking the same file still fires onChange.
                    e.target.value = "";
                  } }
                />
              </span>
            </div>

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
          </div>
        );
      } }
    />
  );
}
