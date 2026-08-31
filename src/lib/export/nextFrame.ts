/**
 * How long to wait for an animation frame before carrying on without one.
 *
 * Long enough that a page drawing at any plausible rate wins the race and the
 * frame is a real frame; short enough that a page drawing at no rate at all
 * still makes progress.
 */
const FRAME_FALLBACK_MS = 250;

export type FrameWait = {
  /** Whether an actual animation frame arrived, rather than the fallback timer. */
  framed: boolean;
};

/**
 * Wait for the next animation frame — or for a timer, if none comes.
 *
 * `requestAnimationFrame` is not a promise the browser keeps. A hidden tab, a
 * minimised window, or a software renderer with nothing left to composite can
 * stop delivering frames indefinitely, and every wait in an export is inside a
 * loop whose deadline is only ever checked *between* frames. So a frame that
 * never arrives does not make an export slow, it hangs it forever on whatever
 * stage it was on — which is what a user backgrounding the tab mid-export
 * would see.
 *
 * Racing a timer keeps those loops turning. Callers that budget their waits in
 * frames are told which one won, so a timer tick can poll without being
 * counted as a frame the engine actually drew.
 */
export default function nextFrame(): Promise<FrameWait> {
  return new Promise( ( resolve ) => {
    let settled = false;

    const settle = ( framed: boolean ) => {
      if ( settled ) {
        return;
      }

      settled = true;
      resolve( {
        framed
      } );
    };

    if ( typeof requestAnimationFrame === "function" ) {
      requestAnimationFrame( () => settle( true ) );
    }

    setTimeout(
      () => settle( false ),
      FRAME_FALLBACK_MS
    );
  } );
}
