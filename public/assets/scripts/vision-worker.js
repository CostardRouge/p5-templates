// Buffer messages synchronously: INIT can arrive while vision-manager.js is
// still being fetched, and a message dispatched with no listener attached is
// silently dropped — which would leave the main thread waiting forever.
const pendingMessages = [];

self.onmessage = ( event ) => {
  pendingMessages.push( event );
};

import( "./vision-manager.js" ).then( ( module ) => {
  const {
    VisionManager
  } = module;

  const manager = new VisionManager();

  manager.setResultCallback( ( payload ) => {
    const transferables = [];
    const buffer = payload.result?.data?.buffer;

    // Segmentation masks carry a large buffer — transfer instead of copying.
    if ( buffer ) {
      transferables.push( buffer );
    }

    postMessage(
      {
        type: "LIB_RESULT",
        payload
      },
      transferables
    );
  } );

  const handleMessage = async( event ) => {
    const message = event.data;

    if ( message.type === "INIT" ) {
      try {
        await manager.initialize( {
          tasks: message.tasks,
          taskOptions: message.taskOptions ?? {},
          mediapipeLibraryPath: message.mediapipeLibraryPath
        } );
        postMessage( {
          type: "READY"
        } );
      } catch( error ) {
        postMessage( {
          type: "INIT_ERROR",
          message: error?.message ?? String( error )
        } );
      }
    }

    if ( message.type === "SET_MODE" ) {
      await manager.setMode( message.mode );
    }

    if ( message.type === "FRAME" ) {
      try {
        manager.detect(
          message.bitmap,
          message.timestamp
        );

        // Lets the main thread clear its busy flag deterministically, even
        // when several tasks each emitted (or none emitted) a LIB_RESULT.
        postMessage( {
          type: "FRAME_DONE",
          timestamp: message.timestamp
        } );
      } catch( error ) {
        postMessage( {
          type: "FRAME_ERROR",
          message: error?.message ?? String( error )
        } );
      } finally {
        // Important: Close bitmap in worker to prevent memory leak
        if ( message.bitmap?.close ) {
          message.bitmap.close();
        }
      }
    }

    if ( message.type === "INTERACT" ) {
      try {
        // Run the interactive segmenter
        manager.interact(
          message.bitmap,
          message.roi
        );
      } finally {
        // Cleanup
        if ( message.bitmap?.close ) {
          message.bitmap.close();
        }
      }
    }

    if ( message.type === "CLOSE" ) {
      manager.close();
      self.close();
    }
  };

  self.onmessage = handleMessage;

  // Replay anything that arrived while the manager module was loading.
  pendingMessages.splice( 0 ).forEach( handleMessage );
} );
