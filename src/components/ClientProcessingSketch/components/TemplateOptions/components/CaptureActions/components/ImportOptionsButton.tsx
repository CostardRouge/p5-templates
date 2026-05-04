"use client";

import React, {
  useRef, useState
} from "react";
import {
  FileUp
} from "lucide-react";
import {
  SketchOptionInput
} from "@/types/sketch.types";
import Toast from "@/components/Toast";

type ImportOptionsButtonProps = {
  persistedJobId?: string;
  jobStatus?: string;
  name: string;
  onImportInMemory?: ( options: SketchOptionInput ) => void;
};

export default function ImportOptionsButton( {
  persistedJobId,
  jobStatus,
  name,
  onImportInMemory
}: ImportOptionsButtonProps ) {
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

  // Show for:
  // 1. Non-persisted sketches (no jobId)
  // 2. Persisted jobs with allowed statuses
  const allowedStatuses = [
    "draft",
    "failed",
    "cancelled"
  ];

  const canImport =
    !persistedJobId || ( jobStatus && allowedStatuses.includes( jobStatus ) );

  if ( !canImport ) {
    return null;
  }

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

      // If no persisted job, import in memory
      if ( !persistedJobId ) {
        if ( onImportInMemory ) {
          onImportInMemory( importedOptions );
          setToast( {
            message: "Options imported successfully",
            type: "success"
          } );
        }
      } else {
        // Import into existing persisted job
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
          // Reload after a short delay to show the toast
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
        message:
          error instanceof Error ? error.message : "Failed to import options",
        type: "error"
      } );
    } finally {
      setImporting( false );
      // Reset input so same file can be selected again
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
      <button
        onClick={handleImportClick}
        disabled={importing}
        className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium"
        title={
          persistedJobId
            ? "Import options.json (assets will be ignored)"
            : "Import options.json in memory"
        }
      >
        <FileUp className="h-4 w-4" />
        <span>{importing ? "Importing..." : "Import Options"}</span>
      </button>

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
