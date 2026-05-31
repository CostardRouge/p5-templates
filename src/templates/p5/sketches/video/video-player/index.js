import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";

import {
  subscribeSketchOptions
} from "@/p5/shared/syncSketchOptions.js";
import {
  createVideoSync
} from "@/lib/assets/kinds/videos/createVideoSync";

// ---------------------------------------------------------------------------
// Video playback demo.
//
// Drop one or more videos in the "Videos" field of the options panel. Each
// video carries its own time-stretch params (repeat / speed / offset / loop)
// editable from the gear button on its thumbnail.
//
// The sketch is fully reactive: videos added *after* setup are picked up via
// `subscribeSketchOptions`, and removing a video disposes its element. With no
// video selected it simply shows a hint — nothing crashes.
// ---------------------------------------------------------------------------

let videos = null;

function disposeVideos() {
  videos?.dispose();
  videos = null;

  // Belt-and-suspenders: sweep any orphaned video elements left behind by a
  // previous run / hot-reload (reset() clears events without invoking them).
  document
    .querySelectorAll( "video[data-video-asset]" )
    .forEach( ( element ) => element.remove() );
}

sketch.setup( () => {
  disposeVideos();

  videos = createVideoSync( {
    getInstances: () => options.sketch?.videos ?? [],
    jobId: () => options.id,
    // Refresh on option changes so videos added after setup load on the fly.
    // `dispose()` (on the next setup) unsubscribes, so nothing leaks.
    subscribe: ( onChange ) => subscribeSketchOptions( onChange )
  } );
} );

sketch.draw( () => {
  const p = getP5();

  p.background( ...( options.sketch?.backgroundColor ?? [
    10,
    10,
    12
  ] ) );

  const sources = videos?.sources() ?? [];

  if ( sources.length === 0 ) {
    drawHint( p );
    return;
  }

  const progression = animation.progression;

  // Nudge each video toward the target time, then draw whatever frame it
  // currently holds — both synchronously. The seek is fire-and-forget: p5
  // does not await an async `draw`, so awaiting here would let the next
  // rAF clear the canvas before the frame lands, causing a black flash.
  // For deterministic capture the recorder drains the pending seeks
  // (trackPendingMedia) before reading the frame.
  drawGrid(
    p,
    sources,
    progression
  );
} );

/* ---- drawing helpers ----------------------------------------------------- */

function drawGrid(
  p, sources, progression
) {
  const count = sources.length;
  const columns = Math.ceil( Math.sqrt( count ) );
  const rows = Math.ceil( count / columns );
  const cellWidth = p.width / columns;
  const cellHeight = p.height / rows;

  sources.forEach( (
    source, index
  ) => {
    source.seekToProgression( progression ).catch( () => {} );

    const column = index % columns;
    const row = Math.floor( index / columns );

    drawCover(
      p,
      source.element,
      column * cellWidth,
      row * cellHeight,
      cellWidth,
      cellHeight
    );
  } );
}

/** Draw a video element cover-fitted into the (x, y, w, h) cell. */
function drawCover(
  p, element, x, y, w, h
) {
  const vw = element.videoWidth;
  const vh = element.videoHeight;

  if ( !vw || !vh ) {
    return; // metadata not ready yet
  }

  const scale = Math.max(
    w / vw,
    h / vh
  );
  const drawWidth = vw * scale;
  const drawHeight = vh * scale;
  const offsetX = x + ( w - drawWidth ) / 2;
  const offsetY = y + ( h - drawHeight ) / 2;

  const context = p.drawingContext;

  context.save();
  context.beginPath();
  context.rect(
    x,
    y,
    w,
    h
  );
  context.clip();
  context.drawImage(
    element,
    offsetX,
    offsetY,
    drawWidth,
    drawHeight
  );
  context.restore();
}

function drawHint( p ) {
  p.push();
  p.noStroke();
  p.fill( 150 );
  p.textAlign(
    p.CENTER,
    p.CENTER
  );
  p.textSize( Math.max(
    14,
    p.width * 0.025
  ) );
  p.text(
    "Add a video in the options panel →",
    p.width / 2,
    p.height / 2
  );
  p.pop();
}
