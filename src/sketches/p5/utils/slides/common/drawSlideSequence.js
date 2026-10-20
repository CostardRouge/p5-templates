// ── The "sequence" content item: whole sketches cut together ────────────────
//
// A sequence is a reel of scenes over the host loop (sequence/timeline.js).
// Each frame this renderer asks for the buffer of the scene on screen — and of
// the scene leaving, during a transition — then hands both to the compositor
// (sequence/compositor.js), which draws the transition, the two cameras and
// the grade in one shader pass, and blits the result like a sketch layer.
//
// A sketch scene is a "sketch" layer under another name: it goes through
// renderNestedSketchLayer with a synthetic layer item, so it gets the buffer,
// the surface / options / clock swaps, the load queue and the async-draw
// refusal for free. Its clock is the scene's own: `loops` turns of its
// animation over its slot, expressed as the layer `progression` offset from
// the host phase that lands exactly there. The generated scenes (splash,
// loader, plate) paint into a P2D buffer of their own (sequence/sceneCanvas.js).
//
// Nothing here reads a wall clock: the scene buffers, the transition progress
// and the camera all come from the loop phase, so a capture renders the same
// cut as the preview.

import sketch, {
  getP5
} from "../../sketch.js";
import time from "../../time.js";
import string from "../../string.js";
import {
  resolveAnimation
} from "@/lib/animationConfig";
import {
  bufferPixels, renderNestedSketchLayer
} from "../../nestedSketch.js";
import {
  layerBox
} from "./drawSlideSketch.js";
import {
  reportItemBounds
} from "./itemBoundsRegistry.js";
import {
  IDENTITY_CAMERA,
  buildTimeline,
  cameraTransform,
  resolveSequence,
  scenePhase,
  wrapUnit
} from "../../sequence/timeline.js";
import {
  disposeComposites, renderComposite
} from "../../sequence/compositor.js";
import {
  effectUniforms
} from "../../sequence/transitionGlsl.js";
import {
  disposeSceneGraphics, sceneGraphics
} from "../../sequence/sceneCanvas.js";
import {
  paintPlate, paletteRamp
} from "../../sequence/plate.js";
import {
  paintSplash
} from "../../sequence/splash.js";
import {
  paintLoader
} from "../../sequence/loader.js";
import {
  disposeSequenceSound, updateSequenceSound
} from "../../sequence/sequenceSound.js";

/** scenes array → its timeline, for the loop it was built against. */
const timelines = new WeakMap();

function timelineFor(
  scenes, loopSeconds, loop
) {
  const cached = timelines.get( scenes );

  if ( cached && cached.loopSeconds === loopSeconds && cached.loop === loop ) {
    return cached.timeline;
  }

  const timeline = buildTimeline(
    scenes,
    loopSeconds,
    loop
  );

  timelines.set(
    scenes,
    {
      loopSeconds,
      loop,
      timeline
    }
  );

  return timeline;
}

function clamp01( value ) {
  return Math.min(
    1,
    Math.max(
      0,
      value
    )
  );
}

function fontFor( key ) {
  const fonts = string.fonts;

  return ( key && fonts[ key ] ) || fonts.martian;
}

/** Whether a grade block changes anything, so an idle sequence skips the GPU pass. */
export function gradeIsActive( grade ) {
  if ( !grade ) {
    return false;
  }

  return ( grade.letterbox ?? 0 ) > 0 ||
    ( grade.vignette ?? 0 ) > 0 ||
    ( grade.grain ?? 0 ) > 0 ||
    ( grade.aberration ?? 0 ) > 0 ||
    ( grade.saturation ?? 1 ) !== 1 ||
    ( grade.contrast ?? 1 ) !== 1 ||
    ( grade.tintAmount ?? 0 ) > 0 ||
    ( grade.scanlines ?? 0 ) > 0;
}

function cameraIsActive( xform ) {
  return xform[ 0 ] !== 1 || xform[ 1 ] !== 0 || xform[ 2 ] !== 0 || xform[ 3 ] !== 0;
}

function canvasOf( buffer ) {
  return buffer?.elt ?? buffer?.canvas ?? null;
}

/**
 * The buffer of one scene at `local` seconds into its slot of `length`, or
 * null while it is not drawable yet (a sketch still loading).
 */
function sceneBuffer(
  key, scene, index, local, length, layoutWidth, layoutHeight, density, seconds
) {
  const sceneKey = `${ key }:scene:${ index }`;

  if ( scene.kind === "sketch" ) {
    if ( !scene.sketch ) {
      return null;
    }

    // The layer runtime offsets the HOST phase by `progression`; the offset
    // that lands on the scene's own phase is their difference. Null (follow
    // the host) stays 0, which installs no override at all.
    const phase = scenePhase(
      scene,
      local,
      length
    );
    const progression = phase === null
      ? 0
      : wrapUnit( phase - wrapUnit( time.phase() ) );

    return renderNestedSketchLayer(
      sceneKey,
      {
        sketch: scene.sketch,
        settings: scene.settings ?? {},
        play: true,
        progression,
        framerate: scene.framerate ?? 0,
        drawBackground: scene.drawBackground !== false,
        clearEachFrame: scene.clearEachFrame !== false
      },
      layoutWidth,
      layoutHeight,
      density * ( scene.resolution ?? 1 )
    );
  }

  const {
    pixelWidth, pixelHeight
  } = bufferPixels(
    layoutWidth,
    layoutHeight,
    density
  );
  const g = sceneGraphics(
    sceneKey,
    pixelWidth,
    pixelHeight
  );

  if ( !g ) {
    return null;
  }

  const env = {
    progress: length > 0 ? clamp01( local / length ) : 1,
    seconds,
    font: null
  };

  g.push();
  g.clear();
  // Painters work in layout units; the buffer may hold more or fewer pixels.
  g.scale(
    pixelWidth / layoutWidth,
    pixelHeight / layoutHeight
  );

  try {
    switch ( scene.kind ) {
      case "splash":
        env.font = fontFor( scene.font );
        paintSplash(
          g,
          scene,
          layoutWidth,
          layoutHeight,
          env
        );
        break;
      case "loader":
        env.font = fontFor( scene.font );
        paintLoader(
          g,
          scene,
          layoutWidth,
          layoutHeight,
          env
        );
        break;
      default:
        paintPlate(
          g,
          scene.background,
          layoutWidth,
          layoutHeight,
          env.progress
        );
        break;
    }
  } finally {
    g.pop();
  }

  return g;
}

function registerDisposer() {
  if ( sketch && !sketch.disposeSequences ) {
    // Installed on first render like nestedSketch's, for the same import-cycle
    // reason: sketch.reset() frees these between sketches.
    sketch.disposeSequences = () => {
      disposeComposites();
      disposeSceneGraphics();
      disposeSequenceSound();
    };
  }
}

/**
 * Composite one sequence item onto the host canvas.
 *
 * `key` is the layer's "<scope>:<index>" address; the scene buffers and the
 * composite are kept under it.
 */
export default function drawSlideSequence(
  item, _slideOptions, key
) {
  const p = getP5();
  const scenes = Array.isArray( item?.scenes ) ? item.scenes : [];

  if ( !p || item.enabled === false || scenes.length === 0 ) {
    return;
  }

  registerDisposer();

  const {
    width, height
  } = layerBox(
    p,
    item
  );

  if ( !( width > 0 ) || !( height > 0 ) ) {
    return;
  }

  const layoutWidth = Math.max(
    1,
    Math.round( width )
  );
  const layoutHeight = Math.max(
    1,
    Math.round( height )
  );
  const density = item.resolution ?? 1;
  const {
    pixelWidth, pixelHeight
  } = bufferPixels(
    layoutWidth,
    layoutHeight,
    density
  );

  const {
    duration: loopSeconds
  } = resolveAnimation( sketch.sketchOptions?.animation );
  const timeline = timelineFor(
    scenes,
    loopSeconds,
    item.loop ?? "cyclic"
  );
  const seconds = wrapUnit( time.phase() ) * loopSeconds;
  const cue = resolveSequence(
    timeline,
    seconds,
    scenes
  );

  if ( !cue ) {
    return;
  }

  const toScene = scenes[ cue.index ];
  let toBuffer = sceneBuffer(
    key,
    toScene,
    cue.index,
    cue.local,
    cue.length,
    layoutWidth,
    layoutHeight,
    density,
    seconds
  );
  let toXform = cameraTransform(
    toScene.camera,
    cue.progress,
    seconds
  );
  let fromBuffer = null;
  let fromXform = IDENTITY_CAMERA;
  let mix = 1;

  if ( cue.from ) {
    const fromScene = scenes[ cue.from.index ];

    fromBuffer = sceneBuffer(
      key,
      fromScene,
      cue.from.index,
      cue.from.local,
      timeline.scenes[ cue.from.index ].length,
      layoutWidth,
      layoutHeight,
      density,
      seconds
    );
    fromXform = cameraTransform(
      fromScene.camera,
      cue.from.progress,
      seconds
    );
    mix = cue.mix;
  }

  // The hit lands as the cut begins: the entered scene is the one that counts.
  updateSequenceSound(
    key,
    item.sound,
    {
      activeIndex: cue.index,
      count: scenes.length
    },
    time.seconds()
  );

  // An incoming sketch still loading: hold the outgoing scene rather than
  // flash the host through. Nothing drawable at all: draw nothing this frame.
  if ( !toBuffer ) {
    if ( !fromBuffer ) {
      return;
    }

    toBuffer = fromBuffer;
    toXform = fromXform;
    fromBuffer = null;
    mix = 1;
  }

  const transitioning = fromBuffer !== null && mix < 1;
  const transition = toScene.transition ?? {};
  const kind = transitioning ? ( transition.effect?.kind ?? "fade" ) : "cut";
  const needsPass = transitioning || gradeIsActive( item.grade ) || cameraIsActive( toXform );

  let output = toBuffer;

  if ( needsPass ) {
    output = renderComposite(
      key,
      {
        width: pixelWidth,
        height: pixelHeight,
        kind,
        from: transitioning ? canvasOf( fromBuffer ) : null,
        to: canvasOf( toBuffer ),
        progress: transitioning ? mix : 1,
        time: seconds,
        fromXform,
        toXform,
        color: transition.color,
        glow: transition.glow ?? 0,
        ramp: paletteRamp( transition.palette ),
        effect: effectUniforms( transition.effect ),
        grade: item.grade
      }
    ) ?? toBuffer;
  }

  const x = p.width * ( item.position?.x ?? 0.5 );
  const y = p.height * ( item.position?.y ?? 0.5 );

  p.push();

  if ( sketch.sketchOptions?.type === "webgl" ) {
    // Same origin correction as every content item on a WEBGL host (see
    // drawSlideSketch): a layer is a flat quad and must not inherit the host's
    // standing transform.
    p.resetMatrix();
    p.translate(
      -p.width / 2,
      -p.height / 2
    );
  }

  if ( item.blend ) {
    p.blendMode( item.blend );
  }

  const opacity = item.opacity ?? 1;

  if ( opacity < 1 ) {
    p.tint(
      255,
      Math.round( opacity * 255 )
    );
  }

  p.translate(
    x,
    y
  );
  p.rotate( item.rotation ?? 0 );
  p.imageMode( p.CENTER );
  p.image(
    output,
    0,
    0,
    width,
    height
  );
  p.pop();
  // push/pop does not restore the blend mode in p5.
  p.blendMode( p.BLEND );

  reportItemBounds(
    x - width / 2,
    y - height / 2,
    width,
    height
  );
}
