import( "./vision-manager.js" )
  .then( module => {
    const {
      VisionManager
    } = module;

    const manager = new VisionManager();

    manager.setResultCallback( ( payload ) => {
      const {
        lib, result
      } = payload;
      const transferables = [
      ];

      // Detect if we have a transferable buffer
      if ( lib === "segmenter" && result.data && result.data.buffer ) {
        transferables.push( result.data.buffer );
      }

      postMessage(
        {
          type: "LIB_RESULT",
          payload
        },
        transferables
      );
    } );

    self.onmessage = async( event ) => {
      const message = event.data;

      if ( message.type === "INIT" ) {
        await manager.initialize( {
          tasks: message.tasks,
          mediapipeLibraryPath: message.mediapipeLibraryPath
        } );
        postMessage( {
          type: "READY"
        } );
      }

      if ( message.type === "FRAME" ) {
        manager.detect(
          message.bitmap,
          message.timestamp
        );
        // Important: Close bitmap in worker to prevent memory leak
        message.bitmap.close();
      }
    };
  } );
