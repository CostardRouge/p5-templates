"use client";
import {
  useFormContext
} from "react-hook-form";
import useAssetDrop, {
  AssetType
} from "@/hooks/useAssetDrop";
import useSketchAssets from "@/components/ClientProcessingSketch/components/SketchOptions/components/SketchAssetsProvider/hooks/useSketchAssets";

/**
 * Counts how many content items across all slides still reference a given
 * image path. Used to decide whether removing the path from the global
 * `assets.images` pool would leave a dangling reference.
 *
 * Only images have content-item types (`image`, `images-stack`) today, so
 * this helper stays image-specific. Other kinds skip pool cleanup until
 * a generic reference visitor is added.
 */
function countImageRefs(
  slides: any[], target: string
): number {
  let n = 0;

  for ( const s of slides ?? [] ) {
    for ( const it of s?.content ?? [] ) {
      if ( it?.type === "image" && it?.src === target ) {
        n++;
      }
      if ( it?.type === "images-stack" && Array.isArray( it.items ) ) {
        n += it.items.filter( ( p: string ) => p === target ).length;
      }
    }
  }
  return n;
}

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
    if ( kind === "images" ) {
      const slides = getValues( "slides" ) ?? [];
      const refs = countImageRefs(
        slides,
        path
      );

      if ( refs > 1 ) {
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
