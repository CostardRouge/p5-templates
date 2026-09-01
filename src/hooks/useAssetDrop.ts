import {
  getScopeAssetPath, registerBlobUnique, revokeBlob
} from "@/lib/assets";

import {
  getSketchOptions,
  setSketchOptions
} from "@/lib/syncSketchOptions";

const ensurePath = (
  obj: any, key: string, value: any = []
) => {
  obj[ key ] ??= value;
  return obj[ key ];
};

type Scope =
  | "global"
  | {
    slide: number;
  };

export type AssetType = "images" | "videos" | "audios" | "json";

export default function useAssetDrop() {
  async function addAssets( {
    files,
    type,
    scope
  }: {
    files: FileList;
    type: AssetType;
    scope: Scope;
  } ) {
    const registeredBlobNames = [];
    const opts = structuredClone( getSketchOptions() );

    const targetArray = resolveArray(
      opts,
      scope,
      type
    );

    for ( const file of Array.from( files ) ) {
      // The path the file's own name asks for, and the one it actually gets:
      // a phone hands every camera-roll pick over as `image.jpg`, so the name
      // alone is not an identity (see `registerBlobUnique`).
      const registeredBlobName = registerBlobUnique(
        getScopeAssetPath(
          file.name,
          type,
          scope
        ),
        file
      );

      registeredBlobNames.push( registeredBlobName );

      // Re-adding a file that is already in the pool keeps its path, and the
      // pool is a set: a duplicate entry would render twice and delete once.
      if ( !targetArray.includes( registeredBlobName ) ) {
        targetArray.push( registeredBlobName );
      }
    }

    setSketchOptions(
      opts,
      "react"
    );

    return registeredBlobNames;
  }

  function removeAsset( {
    index,
    type,
    scope
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

    if ( removed ) {
      revokeBlob( removed );
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
          {}
        ),
        type,
        []
      );
    }

    const {
      slide
    } = scope;

    base.slides ??= [];
    base.slides[ slide ] ??= {};

    return ensurePath(
      ensurePath(
        base.slides[ slide ],
        "assets",
        {}
      ),
      type,
      []
    );
  }

  return {
    addAssets,
    removeAsset
  };
}
