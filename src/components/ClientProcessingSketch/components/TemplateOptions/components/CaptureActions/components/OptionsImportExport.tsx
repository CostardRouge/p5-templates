"use client";

import React, {
  useRef, useState
} from "react";
import {
  Download, FileUp
} from "lucide-react";
import {
  SketchOptionInput
} from "@/types/sketch.types";
import Toast from "@/components/Toast";
import clsx from "clsx";

type OptionsMenuProps = {
  options: SketchOptionInput;
  name: string;
  persistedJobId?: string;
  jobStatus?: string;
  onImportInMemory?: ( options: SketchOptionInput ) => void;
};

export default function OptionsImportExport( {
  options,
  name,
  persistedJobId,
  jobStatus,
  onImportInMemory
}: OptionsMenuProps ) {
  const fileInputRef = useRef<HTMLInputElement>( null );
  const [
    importing,
    setImporting
  ] = useState( false );
  const [
    toast,
    setToast
  ] = useState<{
    message: string;
    type: "success" | "error";
  } | null>( null );

  const allowedStatuses = [
    "draft",
    "failed",
    "cancelled"
  ];
  const canImport =
    !persistedJobId || ( jobStatus && allowedStatuses.includes( jobStatus ) );

  const handleDownload = ( e: React.MouseEvent ) => {
    e.stopPropagation();

    const cleanOptions = JSON.parse( JSON.stringify( options ) );
    const blob = new Blob(
      [
        JSON.stringify(
          cleanOptions,
          null,
          2
        )
      ],
      {
        type: "application/json"
      }
    );

    const url = URL.createObjectURL( blob );
    const a = document.createElement( "a" );
    const suffix = persistedJobId
      ? persistedJobId.slice(
        0,
        8
      )
      : Date.now().toString();
    const filename = `${ name }-options-${ suffix }.json`;

    a.href = url;
    a.download = filename;
    a.setAttribute(
      "data-download-link",
      "true"
    );
    document.body.appendChild( a );
    a.click();
    a.remove();
    URL.revokeObjectURL( url );
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async( event: React.ChangeEvent<HTMLInputElement> ) => {
    const file = event.target.files?.[ 0 ];

    if ( !file ) {
      return;
    }

    setImporting( true );

    try {
      const fileContent = await file.text();
      let importedOptions: SketchOptionInput;

      try {
        importedOptions = JSON.parse( fileContent );
      } catch( error ) {
        throw new Error( "Invalid JSON file" );
      }

      if ( !persistedJobId ) {
        if ( onImportInMemory ) {
          onImportInMemory( importedOptions );
          setToast( {
            message: "Options imported successfully",
            type: "success"
          } );
        }
      } else {
        const formData = new FormData();

        formData.append(
          "file",
          file
        );

        const response = await fetch(
          `/api/options/import/${ persistedJobId }`,
          {
            method: "POST",
            body: formData
          }
        );

        if ( !response.ok ) {
          const error = await response.json();

          throw new Error( error.error || "Import failed" );
        }

        const result = await response.json();

        if ( result.success ) {
          setToast( {
            message: "Options imported successfully",
            type: "success"
          } );
          setTimeout(
            () => {
              window.location.reload();
            },
            1000
          );
        } else {
          throw new Error( "Failed to import options" );
        }
      }
    } catch( error ) {
      setToast( {
        message:
          error instanceof Error ? error.message : "Failed to import options",
        type: "error"
      } );
    } finally {
      setImporting( false );
      event.target.value = "";
    }
  };

  return (
    <>
      <input
        ref={ fileInputRef }
        type="file"
        accept=".json"
        onChange={ handleFileChange }
        className="hidden"
      />

      <div className="flex gap-1">
        <button onClick={ handleDownload } className="text-xs flex items-center">
          <Download className="h-3.5" />
          <span>Export</span>
        </button>

        <button
          onClick={ handleImportClick }
          disabled={ importing }
          className={ clsx(
            "disabled:opacity-50 text-xs flex items-center",
            {
              "animate-pulse": importing
            }
          ) }
        >
          <FileUp className="h-3.5" />
          <span>{importing ? "Importing..." : "Import"}</span>
        </button>
      </div>

      {toast && (
        <Toast
          message={ toast.message }
          type={ toast.type }
          onClose={ () => setToast( null ) }
        />
      )}
    </>
  );
}
