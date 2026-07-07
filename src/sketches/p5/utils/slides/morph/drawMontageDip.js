import sketch, {
  getP5
} from "../../sketch.js";
import animation from "../../animation.js";
import resolveMontageSources from "./resolveMontageSources.js";
import {
  mapProgressionToSegment
} from "./segmentMapper.js";

/**
 * Draw the "dip" overlay for a montage slide whose style is "dip": a full-canvas
 * fade to dipColor that peaks at each segment's midpoint, hiding the hard param
 * switch underneath (see getMontageSketch, which snaps params at the same
 * midpoint). Drawn last, on top of the sketch and its content overlays.
 *
 * No-op for non-dip montages or when fewer than two sources resolve.
 */
export default function drawMontageDip(
  montageSlide, allSlides
) {
  const transition = montageSlide?.transition;

  if ( !transition?.enabled || transition.style !== "dip" ) {
    return;
  }

  const sources = resolveMontageSources(
    montageSlide,
    allSlides
  );

  if ( sources.length < 2 ) {
    return;
  }

  const {
    localT
  } = mapProgressionToSegment(
    animation.progression,
    sources.length,
    transition
  );

  // 0 at the segment edges (and through the hold), full at the midpoint switch.
  const alpha = Math.sin( Math.PI * localT ) * 255;

  if ( alpha <= 0 ) {
    return;
  }

  const p = getP5();
  const color = Array.isArray( transition.dipColor ) ? transition.dipColor : [
    0,
    0,
    0
  ];

  p.push();

  if ( sketch.sketchOptions?.type === "webgl" ) {
    p.translate(
      -p.width / 2,
      -p.height / 2
    );
  }

  p.noStroke();
  p.fill(
    color[ 0 ],
    color[ 1 ],
    color[ 2 ],
    alpha
  );
  p.rect(
    0,
    0,
    p.width,
    p.height
  );
  p.pop();
}
