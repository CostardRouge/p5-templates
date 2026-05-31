"use client";
import React from "react";

import type {
  AssetInstance, AssetKind, AssetPreviewProps
} from "../types";

type ImageParams = Record<string, never>;

function ImagePreview( {
  url, path, className, children
}: AssetPreviewProps ) {
  return (
    <div className={ `relative h-full w-full ${ className ?? "" }` }>
      {url ? (
        <img src={ url } alt={ path } className="object-cover h-full w-full" />
      ) : (
        <div className="h-full w-full grid place-items-center text-xs text-gray-400 bg-gray-50">
          Invalid image
        </div>
      )}
      {children}
    </div>
  );
}

export const imagesKind: AssetKind<ImageParams> = {
  id: "images",
  label: "Image",
  accept: "image/*",
  hasParams: false,
  defaultParams: () => ( {} ),

  parseFieldEntry(
    raw, makeId
  ): AssetInstance<ImageParams> {
    if ( typeof raw === "string" ) {
      return {
        id: makeId(),
        path: raw,
        params: {}
      };
    }

    const obj = raw as Partial<AssetInstance<ImageParams>>;

    return {
      id: obj.id ?? makeId(),
      path: obj.path ?? "",
      params: {}
    };
  },

  serializeFieldEntry( instance ): string {
    return instance.path;
  },

  PreviewComponent: ImagePreview
};
