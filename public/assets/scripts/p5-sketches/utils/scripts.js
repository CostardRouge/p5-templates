const scripts = {
  loaded: [
  ],
  load: (
    src, async = true, type = "text/javascript"
  ) => {
    return new Promise( (
      resolve, reject
    ) => {
      try {
        const scriptElement = document.createElement( "script" );
        const container = document.head || document.body;

        scriptElement.type = type;
        scriptElement.async = async;
        scriptElement.src = src;

        scriptElement.addEventListener(
          "load",
          () => {
            resolve( {
              status: true
            } );

            scripts.loaded.push( {
              container,
              scriptElement
            } );
          }
        );

        scriptElement.addEventListener(
          "error",
          () => {
            reject( {
              status: false,
              message: `Failed to load the script ${ src }`
            } );
          }
        );

        container.appendChild( scriptElement );
      } catch ( error ) {
        reject( error );
      }
    } );
  }
};

window.removeLoadedScripts = () => {
  scripts.loaded.forEach( ( {
    container, scriptElement
  } ) => {
    container?.removeChild( scriptElement );
  } );
};

export default scripts;
