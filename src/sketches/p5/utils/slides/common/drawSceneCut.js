// ── The scene cut: a slide's entrance and exit, from and to a plate ─────────
//
// A slide (or the root document) can open and close its loop through a GL
// transition against a colour plate: the first `in.duration` seconds reveal
// the picture out of the plate, the last `out.duration` seconds hide it back
// into it. The frame being cut is whatever the slide drew — the sketch, its
// content items, the montage overlays — read off the canvas as a texture, so
// nothing else has to know. Slides joined in one video then cut like a film
// instead of jumping, and a lone loop gets a bookend.
//
// Same compositor and same catalogue as the sequence item: the plate is a
// generated scene (sequence/plate.js) in a buffer of its own, the canvas the
// other input. Pure function of the loop phase, like everything the recorder
// captures.

import sketch, {
  getP5
} from "../../sketch.js";
import time from "../../time.js";
import {
  resolveAnimation
} from "@/lib/animationConfig";
import {
  IDENTITY_CAMERA, resolveSceneCut, wrapUnit
} from "../../sequence/timeline.js";
import {
  renderComposite
} from "../../sequence/compositor.js";
import {
  effectUniforms
} from "../../sequence/transitionGlsl.js";
import {
  sceneGraphics
} from "../../sequence/sceneCanvas.js";
import {
  paintPlate, paletteRamp
} from "../../sequence/plate.js";

/** One cut is on screen at a time, so one composite record and one plate. */
const CUT_KEY = "scene-cut";

/**
 * Draw the cut over the finished frame. Called last in the slide's post-draw,
 * with the slide's own `cut` block (falling back to the root's).
 */
export default function drawSceneCut( cut ) {
  const p = getP5();

  if ( !p || !cut?.enabled ) {
    return;
  }

  const {
    duration: loopSeconds
  } = resolveAnimation( sketch.sketchOptions?.animation );
  const phase = wrapUnit( time.phase() );
  const seconds = phase * loopSeconds;
  const cue = resolveSceneCut(
    cut,
    seconds,
    loopSeconds
  );

  if ( !cue ) {
    return;
  }

  const canvas = sketch.getCanvasElement?.() ?? p.canvas;
  const width = p.width;
  const height = p.height;

  if ( !canvas || !( width > 0 ) || !( height > 0 ) ) {
    return;
  }

  const plate = sceneGraphics(
    `${ CUT_KEY }:plate`,
    width,
    height
  );

  if ( !plate ) {
    return;
  }

  plate.push();
  plate.clear();
  // The plate drifts over the whole loop, so an exit lands on the colours the
  // next entrance starts from.
  paintPlate(
    plate,
    cut.plate,
    width,
    height,
    phase
  );
  plate.pop();

  const plateCanvas = plate.elt ?? plate.canvas;
  const spec = cue.spec;
  const entering = cue.side === "in";
  const composite = renderComposite(
    CUT_KEY,
    {
      width,
      height,
      kind: spec.effect?.kind ?? "fade",
      from: entering ? plateCanvas : canvas,
      to: entering ? canvas : plateCanvas,
      progress: cue.mix,
      time: seconds,
      fromXform: IDENTITY_CAMERA,
      toXform: IDENTITY_CAMERA,
      color: spec.color,
      glow: spec.glow ?? 0,
      ramp: paletteRamp( spec.palette ),
      effect: effectUniforms( spec.effect ),
      grade: null
    }
  );

  if ( !composite ) {
    return;
  }

  p.push();

  if ( sketch.sketchOptions?.type === "webgl" ) {
    // The whole frame, as a flat quad over a WEBGL host: same origin
    // correction as every content item (drawSlideSketch).
    p.resetMatrix();
    p.translate(
      -width / 2,
      -height / 2
    );
  }

  p.blendMode( p.BLEND );
  p.noTint();
  p.imageMode( p.CORNER );
  p.image(
    composite,
    0,
    0,
    width,
    height
  );
  p.pop();
}
