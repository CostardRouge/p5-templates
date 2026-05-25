"use client";
import React, {
  useRef, useState
} from "react";
import {
  Trash2
} from "lucide-react";

import useAssetsBridge from "@/hooks/useAssetsBridge";
import useTemplateAssets from "@/components/ClientProcessingSketch/components/TemplateOptions/components/TemplateAssetsProvider/hooks/useTemplateAssets";

import DropZoneButton from "@/components/DropZoneButton";
import {
  resolveAssetURL
} from "@/lib/assets";

import useAssetField from "../hooks/useAssetField";

type Props = {
  name: string;
  /** Asset kind id (e.g. "images", "videos"). Defaults to "images". */
  kind?: string;
};

export default function ControlledAssetInput( {
  name, kind: kindId = "images"
}: Props ) {
  const inputRef = useRef<HTMLInputElement>( null );

  const {
    uploadFiles, maybeRemoveFromAssets
  } = useAssetsBridge();
  const {
    jobId
  } = useTemplateAssets();

  const {
    kind, instances, setSinglePath
  } = useAssetField<unknown>( {
    name,
    kindId
  } );

  const head = instances[ 0 ];
  const [
    previewURL,
    setPreviewURL
  ] = useState<string | null>( null );

  const resolved =
    previewURL ?? ( head?.path ? resolveAssetURL(
      head.path,
      jobId
    ) : null );

  async function onFiles( files: FileList ) {
    if ( !files?.length ) {
      return;
    }

    setPreviewURL( URL.createObjectURL( files[ 0 ] ) );

    const paths = await uploadFiles(
      files,
      kindId as any
    );

    if ( paths.length ) {
      setSinglePath( paths[ 0 ] );
    }
  }

  function clear( event: React.MouseEvent<HTMLButtonElement, MouseEvent> ) {
    event.stopPropagation();

    const prevPath = head?.path;

    setSinglePath( "" );
    setPreviewURL( null );

    if ( prevPath ) {
      maybeRemoveFromAssets(
        prevPath,
        kindId as any
      );
    }
  }

  const Preview = kind.PreviewComponent;

  return (
    <div
      className="relative h-20"
      onClick={ ( e ) => {
        e.stopPropagation();
        inputRef.current?.click();
      } }
      onDragOver={ ( e ) => e.preventDefault() }
      onDrop={ async( e ) => {
        e.preventDefault();
        if ( e.dataTransfer.files?.length ) {
          await onFiles( e.dataTransfer.files );
        }
      } }
    >
      <DropZoneButton onFiles={ onFiles } ref={ inputRef } accept={ kind.accept } />

      {head?.path && (
        <div className="absolute inset-0 overflow-hidden rounded-lg border border-theme">
          {resolved ? (
            <Preview url={ resolved } path={ head.path } />
          ) : (
            <div className="w-full h-full bg-gray-100 animate-pulse" />
          )}

          <button
            type="button"
            onClick={ clear }
            className="absolute left-1 top-1 h-5 w-5 text-center text-red-600 bg-background/90 hover:bg-background rounded-md border border-theme p-0.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
