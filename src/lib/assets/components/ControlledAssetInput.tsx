"use client";
import React, {
  useRef, useState
} from "react";
import {
  Trash2
} from "lucide-react";

import useAssetsBridge from "@/hooks/useAssetsBridge";
import useSketchAssets from "@/components/ClientProcessingSketch/components/SketchOptions/components/SketchAssetsProvider/hooks/useSketchAssets";

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
  } = useSketchAssets();

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

    const optimisticURL = URL.createObjectURL( files[ 0 ] );

    setPreviewURL( optimisticURL );

    const paths = await uploadFiles(
      files,
      kindId as any
    );

    if ( paths.length ) {
      setSinglePath( paths[ 0 ] );
    }

    // Drop the optimistic preview once the upload has registered a blob for
    // the path: for converted formats (e.g. HEIC) the raw file's object URL
    // isn't renderable, while the registered blob always is.
    setPreviewURL( null );
    URL.revokeObjectURL( optimisticURL );
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
      // Button semantics and a pointer cursor, not styling: once a photo is
      // picked the preview below covers the drop zone entirely, so THIS div is
      // the only tap target left for replacing it — and iOS Safari does not
      // deliver clicks from a plain div to React's root listener. Without
      // these, tapping the photo did nothing at all on a phone while working
      // fine on every desktop browser.
      className="relative h-20 cursor-pointer"
      role="button"
      tabIndex={ 0 }
      aria-label="Choose a file"
      onClick={ ( e ) => {
        e.stopPropagation();

        if ( e.target === inputRef.current ) {
          return;
        }

        inputRef.current?.click();
      } }
      onKeyDown={ ( e ) => {
        if ( e.key === "Enter" || e.key === " " ) {
          e.preventDefault();
          inputRef.current?.click();
        }
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
