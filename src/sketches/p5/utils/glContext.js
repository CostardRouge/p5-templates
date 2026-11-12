// ── WebGL contexts are a page-wide budget, and nothing gives them back ─────
//
// A browser keeps a small number of WebGL contexts alive per page (16 in
// Chrome, fewer on a phone). `p5.remove()` and `p5.Graphics.remove()` detach a
// canvas and forget it; neither releases its context, which then lives until
// the garbage collector finds the canvas unreachable. For an offscreen WEBGL
// buffer that day does not come: the GPU helpers are created once per sketch
// MODULE and their closure keeps the last record it drew with (`state`), so
// the buffer of every shader sketch visited stays reachable for the life of
// the page. Measured on the deployed build: one live context per distinct
// shader sketch opened, none collected by a forced GC — until the browser
// evicts the oldest or refuses the next one ("Error creating webgl context").
//
// So a context is released by hand, at the two places that own one: the p5
// instance being torn down, and a buffer removed in the middle of a run.

const P5_CONTEXT_ERROR = /error creating webgl context/i;

export const WEBGL_UNAVAILABLE = "WebGLUnavailableError";

export const WEBGL_UNAVAILABLE_MESSAGE = "This sketch needs WebGL, and the browser would not create a WebGL context. Close other tabs or apps that use 3D graphics, check that hardware acceleration is on, then reload the page.";

/** True for the failure p5 throws when `getContext( "webgl" )` answers null. */
export function isWebGLUnavailable( error ) {
  return error?.name === WEBGL_UNAVAILABLE ||
    P5_CONTEXT_ERROR.test( String( error?.message ?? "" ) );
}

/** The same failure, worded for the person looking at an empty canvas. */
export function toWebGLUnavailableError( cause ) {
  const error = new Error(
    WEBGL_UNAVAILABLE_MESSAGE,
    {
      cause
    }
  );

  error.name = WEBGL_UNAVAILABLE;

  return error;
}

function contextOf( element ) {
  const context = element?.drawingContext ??
    element?._renderer?.drawingContext ??
    element?.GL;

  // A 2D context has no extensions; it is not a budgeted resource either.
  return typeof context?.getExtension === "function" ? context : null;
}

/**
 * Give one WebGL context back to the browser. Returns whether there was one.
 *
 * `WEBGL_lose_context` is the only handle the platform offers: it frees the
 * context's slot and its GPU memory at once instead of at some later GC. The
 * backing store is shrunk too, because a lost context's drawing buffer is not
 * reclaimed everywhere until the canvas itself goes.
 */
export function releaseGlContext( element ) {
  const gl = contextOf( element );

  if ( !gl ) {
    return false;
  }

  try {
    if ( !gl.isContextLost?.() ) {
      gl.getExtension( "WEBGL_lose_context" )?.loseContext();
    }

    const canvas = gl.canvas;

    if ( canvas && "width" in canvas ) {
      canvas.width = 1;
      canvas.height = 1;
    }
  } catch {
    // Already lost, or a browser without the extension: nothing more to do.
  }

  return true;
}

/** `graphics.remove()`, giving its context back first. */
export function removeGraphics( graphics ) {
  releaseGlContext( graphics );
  graphics?.remove?.();
}

/**
 * Release every WebGL context a p5 instance made — its own canvas when the
 * sketch is WEBGL, and each `createGraphics( …, WEBGL )` buffer, which p5
 * records in `_elements`. Call it right before `instance.remove()`.
 * Returns the number of contexts released.
 */
export function releaseInstanceContexts( instance ) {
  if ( !instance ) {
    return 0;
  }

  const elements = new Set( [
    ...( Array.isArray( instance._elements ) ? instance._elements : [] ),
    instance._renderer
  ] );
  let released = 0;

  elements.forEach( ( element ) => {
    if ( releaseGlContext( element ) ) {
      released++;
    }
  } );

  return released;
}
