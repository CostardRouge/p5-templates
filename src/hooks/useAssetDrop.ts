import {
  registerBlob
} from "@/shared/blobMap";

import {
  getScopeAssetPath
} from "@/shared/utils";

import {
  getSketchOptions,
  setSketchOptions
} from "@/shared/syncSketchOptions";

const ensurePath = (
  obj: any, key: string, value: any = [
  ]
) => {
  obj[ key ] ??= value;
  return obj[ key ];
};

type Scope = "global" | {
  slide: number
};

type AssetType = "images" | "videos" | "audios" | "json";

export default function useAssetDrop() {
  async function addAssets( {
    files,
    type,
    scope,
  }: {
    files: FileList;
    type: AssetType;
    scope: Scope;
  } ) {
    const opts = structuredClone( getSketchOptions() );

    const targetArray = resolveArray(
      opts,
      scope,
      type
    );

    for ( const file of Array.from( files ) ) {
      const registeredBlobName = getScopeAssetPath(
        file.name,
        type,
        scope
      );

      registerBlob(
        registeredBlobName,
        file
      );
      targetArray.push( registeredBlobName );
    }

    setSketchOptions(
      opts,
      "react"
    );
  }

  function removeAsset( {
    index,
    type,
    scope,
  }: {
    index: number;
    type: AssetType;
    scope: Scope;
  } ) {
    const opts = structuredClone( getSketchOptions() );

    const targetArray = resolveArray(
      opts,
      scope,
      type
    );
    const [
      removed
    ] = targetArray.splice(
      index,
      1
    );

    if ( removed && window.__blobAssetMap?.[ removed ] ) {
      URL.revokeObjectURL( window.__blobAssetMap[ removed ] );
      delete window.__blobAssetMap[ removed ];
    }

    setSketchOptions(
      opts,
      "react"
    );
  }

  function resolveArray(
    base: any, scope: Scope, type: AssetType
  ): string[] {
    if ( scope === "global" ) {
      return ensurePath(
        ensurePath(
          base,
          "assets",
          {
          }
        ),
        type,
        [
        ]
      );
    }

    const {
      slide
    } = scope;

    base.slides ??= [
    ];
    base.slides[ slide ] ??= {
    };

    return ensurePath(
      ensurePath(
        base.slides[ slide ],
        "assets",
        {
        }
      ),
      type,
      [
      ]
    );
  }

  return {
    addAssets,
    removeAsset
  };
}
