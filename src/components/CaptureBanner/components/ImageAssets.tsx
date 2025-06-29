"use client";

import React, {
  useRef, useState
} from "react";

import {
  RecordingSketchOptions
} from "@/types/recording.types";

import {
  resolveAssetURL
} from "@/shared/utils";
import useAssetDrop from "@/hooks/useAssetDrop";

export default function ImageAssets( {
  options,
  scope
}: {
    options: RecordingSketchOptions;
    scope: "global" | {
      slide: number
    }
} ) {
  const fileInputRef = useRef<HTMLInputElement>( null );

  const handleAssetDrop = useAssetDrop( );

  const [
    isDragging,
    setIsDragging
  ] = useState( false );

  const handleDrag = ( e: React.DragEvent ) => {
    e.preventDefault();
    e.stopPropagation();

    setIsDragging( true );
  };

  const handleDragIn = ( e: React.DragEvent ) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging( true );
  };

  const handleDragOut = ( e: React.DragEvent ) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging( false );
  };

  const handleImageDrop = async( e: React.DragEvent ) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging( false );

    if ( e.dataTransfer.files?.length ) {
      await handleAssetDrop( {
        files: e.dataTransfer.files,
        type: "images",
        scope
      } );
    }
  };

  const handleFileInput = async( e: React.ChangeEvent<HTMLInputElement> ) => {
    const files = e.target.files;

    if ( files && files.length > 0 ) {
      await handleAssetDrop( {
        type: "images",
        files,
        scope
      } );
    }
  };

  return (
    <div
      onDragLeave={handleDragOut}
      onDragEnter={handleDragIn}
      onDragOver={handleDrag}

      onDrop={handleImageDrop}
      className={`p-1 grid grid-cols-3 gap-1 min-h-8 ${ isDragging ? "bg-blue-300" : "" }`}
      onClick={() => fileInputRef.current?.click()}
    >

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInput}
        className="hidden"
        name="image"
        id="file-input"
      />

      { options?.assets?.images?.map( (
        imagePath, imageIndex
      ) => {
        return (
          <div
            key={`global-images-${ imageIndex }`}
            className="h-20 overflow-hidden text-center"
          >
            <img
              className="object-cover"
              src={resolveAssetURL(
                imagePath,
                options
              )}
              alt={imagePath} />
          </div>
        );
      } ) }
    </div>
  );
}