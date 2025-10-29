"use client";

import React, {
  useEffect, useRef
} from "react";
import "@/public/assets/stylesheets/p5.css";

type Props = {
  name: string;
  onLoaded: ( canvas: HTMLCanvasElement ) => void;
  onOptions?: ( options: any ) => void; // { defaults, fields, perSlide? }
};

// Webpack will create a context covering all .../sketches/*/index.js files
const importSketch = ( name: string ) =>
  import(
    /* webpackMode: "lazy", webpackChunkName: "sketch-[request]" */
    /* webpackInclude: /\/[^/]+\/index\.js$/ */
    `@/p5-sketches/sketches/${ name }/index.js` );

export default function P5Sketch( {
  name, onLoaded, onOptions
}: Props ) {
  const containerRef = useRef<HTMLDivElement | null>( null );
  const teardownRef = useRef<null |( () => void )>( null );

  useEffect(
    () => {
      let cancelled = false;

      // 0) Cleanup any previous sketch
      teardownRef.current?.();
      teardownRef.current = null;
      document
        .querySelectorAll( "canvas.p5Canvas, canvas#defaultCanvas0" )
        .forEach( ( el ) => el.remove() );

      // // 1) Inject CSS
      // const css = document.createElement( "link" );
      //
      // css.rel = "stylesheet";
      // css.href = "/assets/stylesheets/p5.css";
      // css.dataset.sketch = name;
      // document.head.appendChild( css );

      // 2) Observe for canvases if the sketch self-bootstraps on import
      const observer = new MutationObserver( () => {
        const canvas = document.querySelector( "canvas.p5Canvas, canvas#defaultCanvas0" ) as HTMLCanvasElement | null;

        if ( !canvas ) return;
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
        .then( ( sketchModule: any ) => {
          if ( cancelled ) return;

          // 3a) If the sketch exports options, register them and notify UI
          // if ( mod?.options ) {
          //   try {
          //     declareSketchOptions( mod.options ); // fills defaults + sets up fields
          //   } catch ( e ) {
          //     console.warn(
          //       "[P5Sketch] declareSketchOptions failed:",
          //       e
          //     );
          //   }
          //   onOptions?.( mod.options );
          // }

          // 3b) Prefer an explicit mount(container) API if provided
          if ( typeof sketchModule?.mount === "function" ) {
            const api = {
              container: containerRef.current ?? undefined,
              onCanvas: ( c: HTMLCanvasElement ) => {
                onLoaded?.( c );
                if ( containerRef.current && !containerRef.current.contains( c ) ) {
                  containerRef.current.appendChild( c );
                }
              },
            };
            const teardown = sketchModule.mount( api );

            if ( typeof teardown === "function" ) teardownRef.current = teardown;
          }
        // else: legacy self-bootstrap path → MutationObserver will catch the canvas
        } )
        .catch( ( e ) => {
          console.error(
            `[P5Sketch] failed to import sketch "${ name }"`,
            e
          );
        } );

      // 4) Cleanup on unmount / name change
      return () => {
        cancelled = true;
        observer.disconnect();
        teardownRef.current?.();
        teardownRef.current = null;

        // remove canvases and CSS added for this sketch
        document
          .querySelectorAll( "canvas.p5Canvas, canvas#defaultCanvas0" )
          .forEach( ( el ) => el.remove() );
        // document
        //   .querySelectorAll( `link[data-sketch="${ name }"]` )
        //   .forEach( ( el ) => el.remove() );

        try {
        // Optional legacy teardown if a sketch added it to window
        // @ts-ignore
          window.removeLoadedScripts?.();
        } catch {
        /* ignore */
        }
      };
    },
    [
      name
    ]
  );

  return <div ref={containerRef} />;
}
