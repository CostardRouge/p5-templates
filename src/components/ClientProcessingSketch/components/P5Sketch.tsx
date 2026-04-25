import React, {
  useEffect, useRef
} from "react";
import "@/public/assets/stylesheets/p5.css";

type Props = {
  name: string;
  onLoaded: ( canvas: HTMLCanvasElement ) => void;
};

import {
  resolveSketchPath
} from "@/engines/metadata";

// Webpack will create a context covering all .../sketches/*/index.js files
const importSketch = ( name: string ) => {
  const sketchPath = resolveSketchPath(
    name,
    "p5",
  );

  return import( `@/p5/sketches/${ sketchPath }/index.js` );
};

export default function P5Sketch( {
  name, onLoaded
}: Props ) {
  const containerRef = useRef<HTMLDivElement | null>( null );

  const attachMainCanvas = () => {
    const canvas = document.querySelector( "canvas#defaultCanvas0" ) as HTMLCanvasElement | null;

    if ( !canvas ) {
      return false;
    }

    onLoaded?.( canvas );

    if ( containerRef.current && !containerRef.current.contains( canvas ) ) {
      containerRef.current.appendChild( canvas );
    }

    return true;
  };

  useEffect(
    () => {
      document
        .querySelectorAll( "canvas.p5Canvas, canvas#defaultCanvas0" )
        .forEach( ( el ) => el.remove() );

      // 2) Observe for canvases if the sketch self-bootstraps on import
      const observer = new MutationObserver( () => {
        if ( attachMainCanvas() ) {
          observer.disconnect();
        }
      } );

      observer.observe(
        document.body,
        {
          childList: true,
          subtree: true,
        }
      );

      // 3) Import the sketch module by name
      importSketch( name ).catch( ( e ) => {
        console.error(
          `[P5Sketch] failed to import sketch "${ name }"`,
          e
        );
      } );

      // Handle sketches that create the main canvas immediately after import.
      if ( attachMainCanvas() ) {
        observer.disconnect();
      }

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
