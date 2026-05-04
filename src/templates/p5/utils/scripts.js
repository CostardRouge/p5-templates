const scripts = {
  loaded: [],
  pending: new Map(),
  load: (
    src, async = true, type = "text/javascript"
  ) => {
    const pendingLoad = scripts.pending.get( src );

    if ( pendingLoad ) {
      return pendingLoad;
    }

    const existingScript = Array.from( document.querySelectorAll( "script[data-script-src]" ) )
      .find( ( element ) => element.dataset.scriptSrc === src );

    if ( existingScript?.dataset.loaded === "true" ) {
      return Promise.resolve( {
        status: true
      } );
    }

    const loadPromise = new Promise( (
      resolve, reject
    ) => {
      try {
        const container = document.head || document.body;
        const scriptElement = existingScript ?? document.createElement( "script" );

        scriptElement.type = type;
        scriptElement.async = async;
        scriptElement.src = src;
        scriptElement.dataset.scriptSrc = src;

        const handleLoad = () => {
          scriptElement.dataset.loaded = "true";

          resolve( {
            status: true
          } );

          if ( !scripts.loaded.some( ( entry ) => entry.scriptElement === scriptElement ) ) {
            scripts.loaded.push( {
              container,
              scriptElement
            } );
          }
        };

        const handleError = () => {
          reject( {
            status: false,
            message: `Failed to load the script ${ src }`
          } );
        };

        scriptElement.addEventListener(
          "load",
          handleLoad,
          {
            once: true
          }
        );

        scriptElement.addEventListener(
          "error",
          handleError,
          {
            once: true
          }
        );

        if ( !existingScript ) {
          container.appendChild( scriptElement );
        }
      } catch( error ) {
        reject( error );
      }
    } ).finally( () => {
      scripts.pending.delete( src );
    } );

    scripts.pending.set(
      src,
      loadPromise
    );

    return loadPromise;
  }
};

window.removeLoadedScripts = () => {
  scripts.loaded.forEach( ( {
    container, scriptElement
  } ) => {
    try {
      container?.removeChild( scriptElement );
    } catch( e ) {}
  } );

  scripts.loaded = [];
  scripts.pending.clear();
};

export default scripts;
