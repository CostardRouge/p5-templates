"use client";

import React from "react";
import {
  Download
} from "lucide-react";
import {
  SketchOptionInput
} from "@/types/sketch.types";

type DownloadOptionsButtonProps = {
  options: SketchOptionInput;
  name: string;
  persistedJobId?: string;
};

export default function DownloadOptionsButton( {
  options,
  name,
  persistedJobId
}: DownloadOptionsButtonProps ) {
  const handleDownload = ( e: React.MouseEvent ) => {
    // Prevent event from bubbling to avoid triggering unsaved changes modal
    e.stopPropagation();

    // Create a clean copy of options without blob URLs or runtime data
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

    // Format: {sketch-name}-options-{jobId or timestamp}.json
    const suffix = persistedJobId
      ? persistedJobId.slice(
        0,
        8
      )
      : Date.now().toString();
    const filename = `${ name }-options-${ suffix }.json`;

    a.href = url;
    a.download = filename;
    // Add a data attribute to mark this as a download link
    a.setAttribute(
      "data-download-link",
      "true"
    );
    document.body.appendChild( a );
    a.click();
    a.remove();
    URL.revokeObjectURL( url );
  };

  return (
    <button
      onClick={handleDownload}
      className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
      title="Download options.json"
    >
      <Download className="h-4 w-4" />
      <span>Download Options</span>
    </button>
  );
}
