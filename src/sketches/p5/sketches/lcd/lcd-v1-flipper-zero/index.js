/**
 * A pocket multi-tool's 128 × 64 monochrome LCD: an orange backlight, dark
 * crystal pixels casting their shadow on it, and the handheld's screens — the
 * main menu, a frequency analyzer, a raw signal capture, a card read, a typed
 * message and a dithered idle plasma — cycled through with a 1-bit dissolve.
 *
 * Everything is painted into a 1-bit framebuffer first (`../_framebuffer.js`,
 * `../_font.js`) and only then turned into pixels on the canvas
 * (`../_panel.js`). The frame is a pure function of the loop phase, so an
 * export closes on itself and the LCD's slow-crystal smear is simply the frame
 * a few hundredths of a second earlier, rendered again underneath.
 */
import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import {
  resolveAnimation
} from "@/lib/animationConfig";
import {
  createFrame,
  dissolveFrames,
  invertFrame
} from "../_framebuffer.js";
import {
  drawPanel, panelLayout
} from "../_panel.js";
import {
  SCENES,
  SCENE_ORDER,
  SCREEN_HEIGHT,
  SCREEN_WIDTH
} from "./scenes.js";

// How far behind the current frame the persistence ghost is, in seconds.
const PERSISTENCE_LAG = 0.06;

const sketchState = sketch.state( () => ( {
  frame: createFrame(
    SCREEN_WIDTH,
    SCREEN_HEIGHT
  ),
  ghost: createFrame(
    SCREEN_WIDTH,
    SCREEN_HEIGHT
  ),
  from: createFrame(
    SCREEN_WIDTH,
    SCREEN_HEIGHT
  ),
  to: createFrame(
    SCREEN_WIDTH,
    SCREEN_HEIGHT
  ),
  layout: null,
  layoutKey: ""
} ) );

function playlist( program ) {
  if ( program.scene && program.scene !== "cycle" && SCENES[ program.scene ] ) {
    return [
      program.scene
    ];
  }

  const included = SCENE_ORDER.filter( ( name ) => program.include?.[ name ] !== false );

  return included.length ? included : SCENE_ORDER;
}

/**
 * Paints the screen as it is at loop `phase` into `out`. In a cycle, the tail
 * of each segment dissolves into the first frame of the next one.
 */
function renderScreen(
  phase, out, settings
) {
  const {
    scenes, seconds, transition, context, invert
  } = settings;
  const count = scenes.length;
  const wrapped = ( ( phase % 1 ) + 1 ) % 1;
  const position = wrapped * count;
  const index = Math.min(
    count - 1,
    Math.floor( position )
  );
  const s = position - index;
  const segment = {
    ...context,
    seconds: seconds / count
  };
  const fadeStart = 1 - transition;

  if ( count > 1 && transition > 0 && s > fadeStart ) {
    SCENES[ scenes[ index ] ](
      sketchState.from,
      s,
      segment
    );
    SCENES[ scenes[ ( index + 1 ) % count ] ](
      sketchState.to,
      0,
      segment
    );
    dissolveFrames(
      sketchState.from,
      sketchState.to,
      ( s - fadeStart ) / transition,
      out
    );
  } else {
    SCENES[ scenes[ index ] ](
      out,
      s,
      segment
    );
  }

  if ( invert ) {
    invertFrame( out );
  }
}

sketch.setup( () => {
  sketchState.layout = null;
  sketchState.layoutKey = "";
} );

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const program = o.program ?? {};
  const display = o.display ?? {};
  const bezel = o.bezel ?? {};
  const colors = o.colors ?? {};
  const {
    duration
  } = resolveAnimation( sketch.sketchOptions?.animation );
  const settings = {
    scenes: playlist( program ),
    seconds: duration,
    transition: Math.max(
      0,
      Math.min(
        0.5,
        program.transition ?? 0.15
      )
    ),
    invert: !!program.invert,
    context: {
      seed: program.seed ?? 7,
      text: o.message?.text ?? "Hack the planet!",
      scale: o.message?.scale ?? 2
    }
  };
  const phase = animation.progression;

  renderScreen(
    phase,
    sketchState.frame,
    settings
  );

  const persistence = display.persistence ?? 0.22;

  if ( persistence > 0 ) {
    renderScreen(
      phase - PERSISTENCE_LAG / duration,
      sketchState.ghost,
      settings
    );
  }

  const padding = bezel.enabled === false ? 0 : ( bezel.padding ?? 6 );
  const layoutKey = [
    p.width,
    p.height,
    display.fill,
    display.gap,
    padding
  ].join( "|" );

  if ( !sketchState.layout || sketchState.layoutKey !== layoutKey ) {
    sketchState.layout = panelLayout( {
      canvasWidth: p.width,
      canvasHeight: p.height,
      columns: SCREEN_WIDTH,
      rows: SCREEN_HEIGHT,
      fill: display.fill ?? 0.88,
      gap: display.gap ?? 0.12,
      padding
    } );
    sketchState.layoutKey = layoutKey;
  }

  p.background( ...( colors.background ?? [
    14,
    14,
    16
  ] ) );

  drawPanel(
    p.drawingContext,
    sketchState.frame,
    sketchState.layout,
    {
      backlight: colors.backlight,
      ink: colors.ink,
      bezel: bezel.enabled === false
        ? null
        : {
          color: bezel.color ?? [
            28,
            28,
            30
          ],
          radius: bezel.radius ?? 5
        },
      unlit: display.unlit ?? 0.05,
      shadow: display.shadow ?? 0.35,
      shadowOpacity: display.shadowOpacity ?? 0.28,
      persistence,
      vignette: display.vignette ?? 0.35,
      glare: display.glare ?? 0.1
    },
    persistence > 0 ? sketchState.ghost : null
  );
} );
