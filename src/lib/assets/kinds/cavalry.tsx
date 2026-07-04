"use client";
import React from "react";

import type {
  AssetInstance, AssetKind, AssetPreviewProps
} from "../types";

type CavalryParams = Record<string, never>;

/**
 * Preview for a Cavalry scene. `.cv` files are opaque binaries with no
 * rasterisable thumbnail here, so we show the file name (derived from the
 * storage path) inside a labelled tile.
 */
function CavalryPreview( {
  path, className, children
}: AssetPreviewProps ) {
  const fileName = path.split( "/" ).pop() || path;

  return (
    <div
      className={ `relative h-full w-full grid place-items-center bg-gray-900 text-gray-100 ${ className ?? "" }` }
    >
      {path ? (
        <div className="flex flex-col items-center gap-1 px-2 text-center">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Cavalry
          </span>
          <span className="text-xs break-all line-clamp-2">
            { fileName }
          </span>
        </div>
      ) : (
        <div className="h-full w-full grid place-items-center text-xs text-gray-400 bg-gray-50">
          No scene
        </div>
      )}
      {children}
    </div>
  );
}

export const cavalryKind: AssetKind<CavalryParams> = {
  id: "cavalry",
  label: "Cavalry scene",
  accept: ".cv",
  hasParams: false,
  defaultParams: () => ( {} ),

  parseFieldEntry(
    raw, makeId
  ): AssetInstance<CavalryParams> {
    if ( typeof raw === "string" ) {
      return {
        id: makeId(),
        path: raw,
        params: {}
      };
    }

    const obj = raw as Partial<AssetInstance<CavalryParams>>;

    return {
      id: obj.id ?? makeId(),
      path: obj.path ?? "",
      params: {}
    };
  },

  serializeFieldEntry( instance ): string {
    return instance.path;
  },

  PreviewComponent: CavalryPreview
};
