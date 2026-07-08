import {
  getP5
} from "@/p5/utils/sketch.js";

// ── Shared webcam capture ───────────────────────────────────────────────────
// A reusable live-camera source for sketches. The webcam-device-select picker
// (the same control the interaction/vision layer exposes) writes a `deviceId`
// into a sketch's options; this util turns that selection into a running p5
// capture whose current frame any sketch can draw.
//
// The capture is owned: it is (re)opened when the picked device or requested
// resolution changes, its MediaStream tracks are stopped on dispose / re-open
// so the camera light goes off, and the underlying <video> is tagged so a
// fresh mount can sweep strays left behind by a hot reload.
//
// Usage:
//   const cam = webcam.attach( () => options.sketch?.camera );
//   const element = cam.element();          // p5.MediaElement, or null until ready
//   if ( element ) { p.image( element, 0, 0 ); }

const STRAY_SELECTOR = "video[data-webcam-capture]";

function _stopStream( videoEl ) {
  try {
    const stream = videoEl?.srcObject;

    if ( stream?.getTracks ) {
      stream.getTracks().forEach( ( track ) => track.stop() );
    }
  } catch {
    // srcObject may already be gone (element torn down) — nothing to release.
  }
}

// Build getUserMedia constraints. A specific device is requested with `exact`
// (p5 accepts a constraints object in place of the VIDEO constant); "" lets the
// browser pick its default camera.
function _constraints(
  deviceId, width, height
) {
  const video = {
    width: {
      ideal: width
    },
    height: {
      ideal: height
    }
  };

  if ( deviceId ) {
    video.deviceId = {
      exact: deviceId
    };
  }

  return {
    audio: false,
    video
  };
}

function attach( getConfig ) {
  // Sweep <video> elements left behind by a previous sketch / hot reload so we
  // never keep a second camera open behind the new one.
  if ( typeof document !== "undefined" ) {
    document.querySelectorAll( STRAY_SELECTOR ).forEach( ( el ) => {
      _stopStream( el );
      el.remove();
    } );
  }

  let element = null;
  let signature = "";

  function release() {
    if ( !element ) {
      return;
    }

    _stopStream( element.elt );

    // remove() can throw if p5 already tore the element down (hot reload) —
    // dispose defensively so a stray failure never crashes the draw loop.
    try {
      element.remove();
    } catch {}

    element = null;
    signature = "";
  }

  function open( cfg ) {
    const p = getP5();

    if ( !p ) {
      return;
    }

    release();

    const width = Math.max(
      1,
      Math.round( cfg.width ?? 1280 )
    );
    const height = Math.max(
      1,
      Math.round( cfg.height ?? 720 )
    );
    const deviceId = cfg.deviceId || "";

    // We mirror at draw time (so toggling flip never reopens the camera), so the
    // capture itself is never flipped here.
    element = p.createCapture(
      _constraints(
        deviceId,
        width,
        height
      ),
      {
        flipped: false
      }
    );
    element.elt.setAttribute(
      "data-webcam-capture",
      ""
    );
    element.hide();

    signature = `${ deviceId }|${ width }|${ height }`;
  }

  // Reconcile the live capture with the current options once per access.
  function ensure() {
    const cfg = getConfig() ?? {};
    const width = Math.max(
      1,
      Math.round( cfg.width ?? 1280 )
    );
    const height = Math.max(
      1,
      Math.round( cfg.height ?? 720 )
    );
    const deviceId = cfg.deviceId || "";
    const next = `${ deviceId }|${ width }|${ height }`;

    if ( !element || next !== signature ) {
      open( cfg );
    }

    return element;
  }

  function isReady( el ) {
    const video = el?.elt;

    return Boolean( video && video.videoWidth && video.videoHeight );
  }

  return {
    /**
     * The live capture element once it has delivered its first frame, or null
     * while the camera is still opening (or permission was denied).
     */
    element() {
      const el = ensure();

      return isReady( el ) ? el : null;
    },

    /** Whether the capture currently has a decodable frame. */
    ready() {
      return isReady( element );
    },

    /** Stop the camera and drop the capture element. */
    dispose() {
      release();
    }
  };
}

export default {
  attach
};
