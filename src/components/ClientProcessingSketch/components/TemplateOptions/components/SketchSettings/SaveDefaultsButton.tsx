"use client";

import React, {
  useState
} from "react";
import {
  Save, Loader2
} from "lucide-react";
import clsx from "clsx";
import {
  useFormContext
} from "react-hook-form";
import useSketch from "@/components/ClientProcessingSketch/components/SketchProvider/hooks/useSketch";

type SaveState = "idle" | "saving" | "saved" | "error";

export default function SaveDefaultsButton() {
  const [
    {
      name, sketchFormValues, engineId
    }
  ] = useSketch();
  const {
    getValues, reset, formState: {
      defaultValues
    }
  } = useFormContext();
  const [
    saveState,
    setSaveState
  ] = useState<SaveState>( "idle" );
  const [
    errorMessage,
    setErrorMessage
  ] = useState<string | null>( null );

  if ( process.env.NODE_ENV !== "development" ) {
    return null;
  }

  const handleSave = async( e: React.MouseEvent ) => {
    e.stopPropagation();

    if ( saveState === "saving" ) {
      return;
    }

    const formValues = getValues( "sketch" );

    setSaveState( "saving" );
    setErrorMessage( null );

    try {
      const res = await fetch(
        "/api/dev/save-defaults",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify( {
            sketch: name,
            engineId,
            formValues,
            originalFormValues: sketchFormValues ?? {}
          } )
        }
      );

      if ( !res.ok ) {
        const text = await res.text();

        throw new Error( text || `HTTP ${ res.status }` );
      }

      // Update RHF defaultValues so fields are no longer considered modified
      reset(
        {
          ...defaultValues,
          sketch: formValues
        },
        {
          keepValues: true
        }
      );

      setSaveState( "saved" );
      setTimeout(
        () => setSaveState( "idle" ),
        1500
      );
    } catch( err ) {
      setErrorMessage( err instanceof Error ? err.message : String( err ) );
      setSaveState( "error" );
      setTimeout(
        () => setSaveState( "idle" ),
        3000
      );
    }
  };

  const title =
    saveState === "error"
      ? ( errorMessage ?? "Error" )
      : "Save current values as defaults in options.ts";

  return (
    <button
      type="button"
      onClick={ handleSave }
      disabled={ saveState === "saving" }
      title={ title }
      aria-label={ title }
      className={ clsx(
        "flex items-center rounded  transition-colors",
        {
          "hover:text-yellow-400 cursor-pointer":
            saveState === "idle",
          "text-yellow-400/50 cursor-wait":
            saveState === "saving",
          "text-green-400":
            saveState === "saved",
          "text-red-400":
            saveState === "error"
        }
      ) }
    >
      {saveState === "saving" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Save className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
