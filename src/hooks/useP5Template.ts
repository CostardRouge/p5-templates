import {
  usePathname
} from "next/navigation";
import {
  useEffect
} from "react";

function useP5Template(
  name: string, onSketchReady?: () => void
) {
  const pathname = usePathname();

  useEffect(
    () => {
      // — CLEANUP any prior sketch, css, canvas
      document.querySelectorAll( "link[data-sketch]" ).forEach( el => el.remove() );
      document.querySelectorAll( "script[data-sketch]" ).forEach( el => el.remove() );
      document.querySelectorAll( "canvas" ).forEach( el => el.remove() );

      // — INJECT new sketch CSS
      const css = document.createElement( "link" );

      css.rel = "stylesheet";
      css.href = "/assets/stylesheets/p5.css";
      css.setAttribute(
        "data-sketch",
        name
      );
      document.head.append( css );

      // — INJECT new sketch script
      const script = document.createElement( "script" );

      script.type = "module";
      script.src = `/assets/scripts/p5-sketches/sketches/${ name }/index.js`;
      script.crossOrigin = "anonymous";
      script.setAttribute(
        "data-sketch",
        name
      );
      document.body.append( script );

      // — ON UNMOUNT/CLEANUP
      return () => {
        document.querySelectorAll( `link[data-sketch="${ name }"]` ).forEach( el => el.remove() );
        document.querySelectorAll( `script[data-sketch="${ name }"]` ).forEach( el => el.remove() );
        // remove p5 canvas
        document.querySelectorAll( "canvas" ).forEach( el => el.remove() );

        document.querySelector( "canvas#defaultCanvas0.p5Canvas" )?.remove();
        // your custom teardown
        try {
          window.removeLoadedScripts();
        }
        catch {

        }
      };
    },
    [
      pathname,
      name
    ]
  );
}

export default useP5Template;