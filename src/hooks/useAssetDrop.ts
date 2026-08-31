import {
  getScopeAssetPath, normalizeImageFile, registerBlob, revokeBlob
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
      let processed = file;

      if ( type === "images" ) {
        // Exotic formats (HEIC/HIF/DNG) are converted to plain JPEG here,
        // at ingest, so every consumer downstream — preview, p5, S3,
        // backend recording — only ever sees browser-native images.
        try {
          processed = await normalizeImageFile( file );
        } catch( error ) {
          console.error(
            `[assets] skipping ${ file.name }: conversion failed`,
            error
          );
          continue;
        }
      }

      const registeredBlobName = getScopeAssetPath(
        processed.name,
        type,
        scope
      );

      registerBlob(
        registeredBlobName,
        processed
      );
      registeredBlobNames.push( registeredBlobName );
      targetArray.push( registeredBlobName );
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
