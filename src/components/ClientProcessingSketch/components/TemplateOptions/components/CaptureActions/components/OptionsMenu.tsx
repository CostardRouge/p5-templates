"use client";

import React, {
  useRef, useState
} from "react";
import {
  Menu, MenuButton, MenuItem, MenuItems
} from "@headlessui/react";
import {
  Download, FileUp, MoreVertical
} from "lucide-react";
import {
  SketchOptionInput
} from "@/types/sketch.types";
import Toast from "@/components/Toast";

type OptionsMenuProps = {
  options: SketchOptionInput;
  name: string;
  persistedJobId?: string;
  jobStatus?: string;
  onImportInMemory?: ( options: SketchOptionInput ) => void;
};

export default function OptionsMenu( {
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
    message: string; type: "success" | "error"
  } | null>( null );

  const allowedStatuses = [
    "draft",
    "failed",
    "cancelled"
  ];
  const canImport = !persistedJobId || ( jobStatus && allowedStatuses.includes( jobStatus ) );

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
      ? persistedJobId.slice( 0, 8 )
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
    if ( !file ) return;

    setImporting( true );

    try {
      const fileContent = await file.text();
      let importedOptions: SketchOptionInput;

      try {
        importedOptions = JSON.parse( fileContent );
      } catch ( error ) {
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
            body: formData,
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
    } catch ( error ) {
      setToast( {
        message: error instanceof Error ? error.message : "Failed to import options",
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
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      <Menu as="div" className="relative">
        <MenuButton className="flex items-center justify-center gap-2 px-4 py-2 bg-foreground/10 hover:bg-foreground/20 text-foreground rounded-lg transition-colors text-sm font-medium w-full">
          <MoreVertical className="h-4 w-4" />
          <span>Options</span>
        </MenuButton>

        <MenuItems
          anchor="top"
          className="z-50 w-56 border border-border rounded-xl bg-background shadow-xl overflow-hidden mb-2 focus:outline-none [--anchor-gap:0.5rem]"
        >
          <MenuItem>
            {( {
              focus
            } ) => (
              <button
                onClick={handleDownload}
                className={`${ focus ? "bg-hover" : "" } flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors`}
              >
                <Download className="h-4 w-4 text-blue-600" />
                <span className="font-medium">Download Options</span>
              </button>
            )}
          </MenuItem>

          {canImport && (
            <MenuItem>
              {( {
                focus
              } ) => (
                <button
                  onClick={handleImportClick}
                  disabled={importing}
                  className={`${ focus ? "bg-hover" : "" } flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors disabled:opacity-50`}
                >
                  <FileUp className="h-4 w-4 text-purple-600" />
                  <span className="font-medium">{importing ? "Importing..." : "Import Options"}</span>
                </button>
              )}
            </MenuItem>
          )}
        </MenuItems>
      </Menu>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast( null )}
        />
      )}
    </>
  );
}
