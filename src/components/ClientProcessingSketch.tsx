"use client";

import React, {
  useState, useEffect, Fragment
} from "react";

import CaptureBanner from "@/components/CaptureBanner";

import {
  setSketchOptions, subscribeSketchOptions, getSketchOptions
} from "@/shared/syncSketchOptions.js";
import {
  usePathname
} from "next/navigation";

function ClientProcessingSketch( {
  name, options
}: {
 name: string, options: Record<string, unknown>
} ) {
  const [
    clientOptions,
    setClientOptions
  ] = useState( () => ( {
    ...getSketchOptions(),
    ...options
  } ) );

  /* push local edits → p5 */
  useEffect(
    () => setSketchOptions(
      clientOptions,
      "react"
    ),
    [
      clientOptions
    ]
  );

  /* listen for p5 edits → React state */
  useEffect(
    () => subscribeSketchOptions( ( options: any ) => setClientOptions( options ) ),
    [
    ]
  );

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
        try { // @ts-ignore
          window.removeLoadedScripts(); } catch {}
      };
    },
    [
      pathname,
      name
    ]
  );

  return (
    <Fragment>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.sketchOptions = ${ JSON.stringify( clientOptions ) };`,
        }}
      />

      <div id="sketch-ui-drawer"></div>
      <span id="sketch-ui-icon"></span>

      {/* <Script*/}
      {/*  type="module"*/}
      {/*  crossOrigin="anonymous"*/}
      {/*  src={`/assets/scripts/p5-sketches/sketches/${ name }/index.js`}*/}
      {/* />*/}

      {options.capturing !== true && (
        <CaptureBanner
          name={name}
          options={clientOptions}
          setOptions={options => setClientOptions( options as Record<string, unknown> )}
        />
      )}
    </Fragment>
  );
}

export default ClientProcessingSketch;