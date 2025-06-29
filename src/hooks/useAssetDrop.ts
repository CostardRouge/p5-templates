import {
  registerBlob
} from "@/shared/blobMap";
import {
  getSketchOptions,
  setSketchOptions
} from "@/shared/syncSketchOptions";

function useAssetDrop() {
  return async function handleFiles( {
    files,
    type,
    scope
  } : {
    files: FileList,
    type: "images"|"videos"|"audios"|"json",
    scope: "global" | {
      slide: number
    }
  } ) {
    const clonedOptions = structuredClone( getSketchOptions() );

    /* ensure path arrays exist ----------------------------------- */
    const ensureArray = (
      object: any, key: string
    ) => {
      object[ key ] ??= [
      ];
      return object[ key ];
    };

    if ( scope === "global" ) {
      const array = ensureArray(
        ensureArray(
          clonedOptions,
          "assets"
        ),
        type
      );

      for ( const file of Array.from( files ) ) {
        registerBlob(
          file.name,
          file
        );
        array.push( file.name );
      }
    } else {
      const {
        slide
      } = scope;

      clonedOptions.slides ??= [
      ];
      clonedOptions.slides[ slide ] ??= {
      };
      const array = ensureArray(
        ensureArray(
          clonedOptions.slides[ slide ],
          "assets"
        ),
        type
      );

      for ( const file of Array.from( files ) ) {
        registerBlob(
          file.name,
          file
        );
        array.push( file.name );
      }
    }

    /* broadcast to both React & p5 ------------------------------- */
    setSketchOptions(
      clonedOptions,
      "react"
    );
  };
}

export default useAssetDrop;