import React, {
  Fragment,
  useEffect, useRef
} from "react";

/**
 * Dynamically inject a p5 sketch (CSS + JS) and notify when
 * the canvas is created.  Cleans itself on unmount / template change.
 */
export default function P5Sketch( {
  name, onLoaded
}: {
  name: string, onLoaded: ( canvasElement: HTMLCanvasElement ) => void
} ) {
  const p5templateContainerRef = useRef<HTMLDivElement | null>( null );
  const canvasRef = useRef<HTMLCanvasElement | null>( null );

  useEffect(
    () => {
      /* 1. remove any previous sketch assets ----------------------- */
      document
        .querySelectorAll( "link[data-sketch]" )
        .forEach( ( el ) => el.remove() );
      document
        .querySelectorAll( "script[data-sketch]" )
        .forEach( ( el ) => el.remove() );
      document.querySelectorAll( "canvas" ).forEach( ( el ) => el.remove() );

      /* 2. inject CSS --------------------------------------------- */
      const css = document.createElement( "link" );

      css.rel = "stylesheet";
      css.href = "/assets/stylesheets/p5.css";
      css.dataset.sketch = name;
      document.head.appendChild( css );

      /* 3. observe for canvas creation ----------------------------- */
      const observer = new MutationObserver( (
        recs, obs
      ) => {
        const canvas = document.querySelector( "canvas.p5Canvas, canvas#defaultCanvas0", ) as HTMLCanvasElement | null;

        if ( canvas ) {
          onLoaded( canvas );
          canvasRef.current = canvas;
          p5templateContainerRef.current?.appendChild( canvas );
          obs.disconnect(); // stop observing
        }
      } );

      observer.observe(
        document.body,
        {
          childList: true,
          subtree: true
        }
      );

      /* 4. inject sketch script ----------------------------------- */
      const script = document.createElement( "script" );

      script.type = "module";
      script.src = `/assets/scripts/p5-sketches/sketches/${ name }/index.js`;
      script.crossOrigin = "anonymous";
      script.dataset.sketch = name;
      document.body.appendChild( script );

      /* 5. cleanup ------------------------------------------------- */
      return () => {
        observer.disconnect();

        document
          .querySelectorAll( `link[data-sketch="${ name }"]` )
          .forEach( ( el ) => el.remove() );
        document
          .querySelectorAll( `script[data-sketch="${ name }"]` )
          .forEach( ( el ) => el.remove() );

        document.querySelectorAll( "canvas" ).forEach( ( el ) => el.remove() );

        try {
          // optional teardown helper if you defined one in the sketch
          // @ts-ignore
          window.removeLoadedScripts?.();
        } catch {
          console.log( "error" );
          /* ignore */
        }
      };
    },
    [
      name,
      p5templateContainerRef
    ]
  );

  return (
    <Fragment>
      <div id="sketch-ui-drawer"></div>
      <span id="sketch-ui-icon"></span>

      <div ref={p5templateContainerRef} />
    </Fragment>
  );
}
