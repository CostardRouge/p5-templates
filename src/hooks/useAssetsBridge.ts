"use client";
import {
  useFormContext
} from "react-hook-form";
import useAssetDrop, {
  AssetType
} from "@/hooks/useAssetDrop";
import useTemplateAssets from "@/components/ClientProcessingSketch/components/TemplateOptions/components/TemplateAssetsProvider/hooks/useTemplateAssets";

function countImageRefs(
  slides: any[], target: string
): number {
  let n = 0;

  for ( const s of slides ?? [
  ] ) {
    for ( const it of s?.content ?? [
    ] ) {
      if ( it?.type === "image" && it?.src === target ) n++;
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
  } = useTemplateAssets();
  const {
    getValues, setValue
  } = useFormContext();
  const {
    addAssets
  } = useAssetDrop();

  function ensureInAssets( paths: string[] ) {
    const assets = getValues( assetsName ) ?? {
    };
    const current: string[] = assets?.images ?? [
    ];
    const next = [
      ...new Set( [
        ...current,
        ...paths
      ] )
    ];

    setValue(
 `${ assetsName }.images` as any,
 next,
 {
   shouldDirty: true,
   shouldTouch: true
 }
    );
  }

  function maybeRemoveFromAssets( path: string ) {
    const slides = getValues( "slides" ) ?? [
    ];
    const refs = countImageRefs(
      slides,
      path
    );

    if ( refs <= 1 ) {
      const assets = getValues( assetsName ) ?? {
      };
      const current: string[] = assets?.images ?? [
      ];
      const filtered = current.filter( ( p ) => p !== path );

      setValue(
 `${ assetsName }.images` as any,
 filtered,
 {
   shouldDirty: true,
   shouldTouch: true
 }
      );
    }
  }

  async function uploadFiles(
    files: FileList, type: AssetType = "images"
  ): Promise<string[]> {
    if ( !files || files.length === 0 ) {
      return [
      ];
    }

    const newPaths = ( await addAssets( {
      type,
      files,
      scope
    } ) ) as unknown as string[] | undefined;

    const paths = newPaths ?? [
    ];

    if ( paths.length ) {
      ensureInAssets( paths );
    }
    return paths;
  }

  return {
    uploadFiles,
    ensureInAssets,
    maybeRemoveFromAssets
  };
}
