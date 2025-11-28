import React, {
  useEffect, useRef
} from "react";
import "@/public/assets/stylesheets/p5.css";

type Props = {
  name: string;
  onLoaded: ( canvas: HTMLCanvasElement ) => void;
};

import metadata from "@/p5-sketches/sketches/metadata.json";

type SketchMetadata = {
  name: string;
  category: string | null;
  hasSketchForm: boolean;
  mtime: string;
  ctime: string;
};

// Helper to get the full sketch path (with category if it exists)
function getSketchPath( name: string ): string {
  const meta = ( metadata as SketchMetadata[] ).find( m => m.name === name );

  if ( meta?.category ) {
    return `${ meta.category }/${ name }`;
  }

  return name;
}

// Webpack will create a context covering all .../sketches/*/index.js files
const importSketch = ( name: string ) => {
  const sketchPath = getSketchPath( name );

  return import( `@/p5-sketches/sketches/${ sketchPath }/index.js` );
};

export default function P5Sketch( {
  name, onLoaded
}: Props ) {
  const containerRef = useRef<HTMLDivElement | null>( null );

  useEffect(
    () => {
      document
        .querySelectorAll( "canvas.p5Canvas, canvas#defaultCanvas0" )
        .forEach( ( el ) => el.remove() );

      // 2) Observe for canvases if the sketch self-bootstraps on import
      const observer = new MutationObserver( () => {
        const canvas = document.querySelector( "canvas.p5Canvas, canvas#defaultCanvas0" ) as HTMLCanvasElement | null;

        if ( !canvas ) {
          return;
        }

        onLoaded?.( canvas );

        if ( containerRef.current && !containerRef.current.contains( canvas ) ) {
          containerRef.current.appendChild( canvas );
        }

        observer.disconnect();
      } );

      observer.observe(
        document.body,
        {
          childList: true,
          subtree: true
        }
      );

      // 3) Import the sketch module by name
      importSketch( name )
        .catch( ( e ) => {
          console.error(
            `[P5Sketch] failed to import sketch "${ name }"`,
            e
          );
        } );

      return () => {
        observer.disconnect();

        document
          .querySelectorAll( "canvas.p5Canvas, canvas#defaultCanvas0" )
          .forEach( ( element ) => element.remove() );

        window.removeLoadedScripts?.();
      };
    },
    [
      name
    ]
  );

  return <div ref={containerRef} />;
}
