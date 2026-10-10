"use client";
import {
  useFormContext
} from "react-hook-form";
import useAssetDrop, {
  AssetType
} from "@/hooks/useAssetDrop";
import useSketchAssets from "@/components/ClientProcessingSketch/components/SketchOptions/components/SketchAssetsProvider/hooks/useSketchAssets";
import countImageRefs from "@/lib/assets/countImageRefs";

export default function useAssetsBridge() {
  const {
    assetsName, scope
  } = useSketchAssets();
  const {
    getValues, setValue
  } = useFormContext();
  const {
    addAssets
  } = useAssetDrop();

  function ensureInAssets(
    paths: string[], kind: AssetType = "images"
  ) {
    const assets = getValues( assetsName ) ?? {};
    const current: string[] = assets?.[ kind ] ?? [];
    const next = [
      ...new Set( [
        ...current,
        ...paths
      ] )
    ];

    setValue(
      `${ assetsName }.${ kind }` as any,
      next,
      {
        shouldDirty: true,
        shouldTouch: true
      }
    );
  }

  function maybeRemoveFromAssets(
    path: string, kind: AssetType = "images"
  ) {
    // Only the images pool has known content-item references to guard
    // against. Other kinds always remove on request — callers decide.
    //
    // Callers clear or remove their own reference BEFORE calling this
    // (`setSinglePath( "" )`, `removeAt`), and react-hook-form writes the
    // form values synchronously, so the item being edited is no longer
    // counted: any remaining reference is someone else's, hence `> 0`.
    if ( kind === "images" ) {
      const refs = countImageRefs(
        {
          content: getValues( "content" ),
          slides: getValues( "slides" )
        },
        path
      );

      if ( refs > 0 ) {
        return;
      }
    }

    const assets = getValues( assetsName ) ?? {};
    const current: string[] = assets?.[ kind ] ?? [];
    const filtered = current.filter( ( p ) => p !== path );

    setValue(
      `${ assetsName }.${ kind }` as any,
      filtered,
      {
        shouldDirty: true,
        shouldTouch: true
      }
    );
  }

  async function uploadFiles(
    files: FileList,
    type: AssetType = "images"
  ): Promise<string[]> {
    if ( !files || files.length === 0 ) {
      return [];
    }

    const newPaths = ( await addAssets( {
      type,
      files,
      scope
    } ) ) as unknown as string[] | undefined;

    const paths = newPaths ?? [];

    if ( paths.length ) {
      ensureInAssets(
        paths,
        type
      );
    }
    return paths;
  }

  return {
    uploadFiles,
    ensureInAssets,
    maybeRemoveFromAssets
  };
}
