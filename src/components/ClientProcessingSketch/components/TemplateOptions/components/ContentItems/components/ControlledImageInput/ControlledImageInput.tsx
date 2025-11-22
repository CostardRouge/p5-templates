// ControlledImageInput.tsx
"use client";
import React, {
  useMemo, useRef, useState
} from "react";
import {
  useController, useFormContext
} from "react-hook-form";
import {
  resolveAssetURL
} from "@/p5-sketches/shared/utils";
import useAssetsBridge from "@/hooks/useAssetsBridge";

import useTemplateAssets
  from "@/components/ClientProcessingSketch/components/TemplateOptions/components/TemplateAssetsProvider/hooks/useTemplateAssets";

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
  const inputRef = useRef<HTMLInputElement>( null );

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
  }

  function clear( event: React.MouseEvent<HTMLButtonElement, MouseEvent> ) {
    event.stopPropagation();
    
    const prev = field.value;

    field.onChange( "" );
    setPreview( null );

    if ( prev ) {
      maybeRemoveFromAssets( prev );
    }
  }

  return (
    <div
      className="relative h-20"
      onClick={() => {
        inputRef.current?.click()
      }}
      onDragOver={( e ) => e.preventDefault()}
      onDrop={async( e ) => {
        e.preventDefault();

        if ( e.dataTransfer.files?.length ) {
          await onFiles( e.dataTransfer.files );
        }
      }}
    >
      <DropZoneButton onFiles={onFiles} ref={inputRef} />

      {field.value && (
        <div className="absolute inset-0 overflow-hidden">
          {resolved ? (
            <img
              src={resolved}
              alt={field.value}
              className="w-full h-full object-cover rounded-lg border border-theme"
            />
          ) : (
            <div className="w-full h-full rounded-xl border border-theme bg-gray-100 animate-pulse" />
          )}

          <button
            type="button"
            onClick={clear}
            className="absolute left-1 top-1 h-5 w-5 text-center text-red-600 bg-background/90 hover:bg-background rounded-md border border-theme p-0.5"
          >
            <Trash2 className="w-3.5 h-3.5"/>
          </button>
        </div>
      )}
    </div>
  );
}