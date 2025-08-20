// ControlledImageInput.tsx
"use client";
import React, {
  useMemo, useState
} from "react";
import {
  useController, useFormContext
} from "react-hook-form";
import {
  resolveAssetURL
} from "@/shared/utils";
import useAssetsBridge from "@/hooks/useAssetsBridge";

import {
  useTemplateAssets
} from "@/components/TemplateAssetsContext";

import DropZoneButton from "@/components/DropZoneButton";
import {
  Trash2
} from "lucide-react";

type Props = {
 name: string
};

export default function ControlledImageInput( {
  name
}: Props ) {
  const {
    control
  } = useFormContext();
  const {
    field, fieldState
  } = useController( {
    name,
    control
  } );
  const {
    uploadFiles, maybeRemoveFromAssets
  } = useAssetsBridge();
  const {
    jobId
  } = useTemplateAssets();

  const [
    preview,
    setPreview
  ] = useState<string | null>( null );
  const resolved = useMemo(
    () => preview || ( field.value ? resolveAssetURL(
      field.value,
      jobId
    ) : null ),
    [
      preview,
      field.value,
      jobId
    ]
  );

  async function onFiles( files: FileList ) {
    if ( !files?.length ) return;
    setPreview( URL.createObjectURL( files[ 0 ] ) );
    const paths = await uploadFiles( files );

    if ( paths.length ) field.onChange( paths[ 0 ] );
    setPreview( null );
  }

  function clear() {
    const prev = field.value;

    field.onChange( undefined );
    if ( prev ) maybeRemoveFromAssets( prev );
  }

  return (
    <div className="flex flex-col gap-2">
      {!field.value ? (
        <DropZoneButton onFiles={onFiles} />
      ) : (
        <div className="relative">
          {resolved ? (
            <img src={resolved} alt={field.value} className="w-full h-40 object-cover rounded-md border border-gray-200 bg-white" />
          ) : (
            <div className="w-full h-40 rounded-md border border-gray-200 bg-gray-100 animate-pulse" />
          )}

          <button
            type="button"
            onClick={clear}
            className="absolute top-2 right-2 inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-white/90 hover:bg-white border border-gray-200 text-red-600"
          >
            <Trash2 className="w-3.5 h-3.5" /> Remove
          </button>

          <div
            className="absolute inset-0 rounded-md"
            onDragOver={( e ) => e.preventDefault()}
            onDrop={async( e ) => {
              e.preventDefault();
              if ( e.dataTransfer.files?.length ) await onFiles( e.dataTransfer.files );
            }}
          />
        </div>
      )}
      {fieldState.error && <p className="text-xs text-red-500">{fieldState.error.message?.toString()}</p>}
    </div>
  );
}
