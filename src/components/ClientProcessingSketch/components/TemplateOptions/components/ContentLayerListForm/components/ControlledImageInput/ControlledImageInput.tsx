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

import useTemplateAssets from "@/components/ClientProcessingSketch/components/TemplateOptions/components/TemplateAssetsProvider/hooks/useTemplateAssets";

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
    if ( !files?.length ) {
      return;
    }

    setPreview( URL.createObjectURL( files[ 0 ] ) );

    const paths = await uploadFiles( files );

    if ( paths.length ) {
      field.onChange( paths[ 0 ] );
    }
    setPreview( null );
  }

  function clear() {
    const prev = field.value;

    field.onChange( undefined );
    setPreview( null );

    if ( prev ) {
      maybeRemoveFromAssets( prev );
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {!field.value ? (
        <div className="grid grid-cols-3 gap-1 h-20">
          <DropZoneButton onFiles={onFiles}/>
        </div>
      ) : (
        <div className="relative">
          {resolved ? (
            <img src={resolved} alt={field.value}
              className="aspect-square w-20 object-cover rounded-sm border border-gray-300"/>
          ) : (
            <div className="aspect-square w-20 h-20 rounded-sm border border-gray-200 bg-gray-100 animate-pulse"/>
          )}

          <div
            className="absolute inset-0 rounded-md"
            onDragOver={( e ) => e.preventDefault()}
            onDrop={async( e ) => {
              e.preventDefault();

              if ( e.dataTransfer.files?.length ) {
                await onFiles( e.dataTransfer.files );
              }
            }}
          />

          <button
            type="button"
            onClick={clear}
            className="absolute left-1 top-1 h-5 w-5 text-center text-red-600 bg-white/90 hover:bg-white rounded border border-gray-200 p-0.5"
          >
            <Trash2 className="w-3.5 h-3.5"/>
          </button>
        </div>
      )}
    </div>
  );
}
