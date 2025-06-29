import {
  registerBlob
} from "@/shared/blobMap";
import {
  getSketchOptions,
  setSketchOptions
} from "@/shared/syncSketchOptions";

const ensureArray = (
  obj: any, key: string
) => {
  obj[ key ] ??= [
  ];
  return obj[ key ];
};

type Scope =
  | "global"
  | {
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
      registerBlob(
        file.name,
        file
      );
      targetArray.push( file.name );
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
      return ensureArray(
        ensureArray(
          base,
          "assets"
        ),
        type
      );
    }
    const {
      slide
    } = scope;

    base.slides ??= [
    ];
    base.slides[ slide ] ??= {
    };
    return ensureArray(
      ensureArray(
        base.slides[ slide ],
        "assets"
      ),
      type
    );
  }

  return {
    addAssets,
    removeAsset
  };
}
