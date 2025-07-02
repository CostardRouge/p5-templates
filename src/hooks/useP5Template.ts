import {
  usePathname
} from "next/navigation";
import {
  useEffect
} from "react";

type CanvasReadyCb = ( canvas: HTMLCanvasElement ) => void;

/**
 * Dynamically inject a p5 sketch (CSS + JS) and notify when
 * the canvas is created.  Cleans itself on unmount / template change.
 */
export default function useP5Template(
  templateName: string,
  onCanvasReady?: CanvasReadyCb,
) {
  const pathname = usePathname();

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
      css.dataset.sketch = templateName;
      document.head.appendChild( css );

      /* 3. observe for canvas creation ----------------------------- */
      const observer = new MutationObserver( (
        recs, obs
      ) => {
        const canvas = document.querySelector( "canvas.p5Canvas, canvas#defaultCanvas0", ) as HTMLCanvasElement | null;

        if ( canvas ) {
          onCanvasReady?.( canvas );
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
      script.src = `/assets/scripts/p5-sketches/sketches/${ templateName }/index.js`;
      script.crossOrigin = "anonymous";
      script.dataset.sketch = templateName;
      document.body.appendChild( script );

      /* 5. cleanup ------------------------------------------------- */
      return () => {
        observer.disconnect();

        document
          .querySelectorAll( `link[data-sketch="${ templateName }"]` )
          .forEach( ( el ) => el.remove() );
        document
          .querySelectorAll( `script[data-sketch="${ templateName }"]` )
          .forEach( ( el ) => el.remove() );

        document.querySelectorAll( "canvas" ).forEach( ( el ) => el.remove() );

        try {
          // optional teardown helper if you defined one in the sketch
          // @ts-ignore
          window.removeLoadedScripts?.();
        } catch {
          /* ignore */
        }
      };
    },
    [
      // onCanvasReady,
      pathname,
      templateName
    ]
  );
}
