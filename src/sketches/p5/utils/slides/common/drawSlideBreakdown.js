import string from "../../string.js";
import sketch, {
  getP5
} from "../../sketch.js";
import {
  getBreakdownRuntimeState
} from "../breakdown/index.js";
import {
  getByPath
} from "../breakdown/deriveSteps.js";
import {
  formatCounter,
  formatValue,
  humanizeKey
} from "../breakdown/format.js";
import drawItemBackground, {
  measureVerticalTextBox
} from "./drawItemBackground.js";
import {
  reportItemBounds
} from "./itemBoundsRegistry.js";

/**
 * Diff-narration overlay for the breakdown item. The parameter interpolation
 * itself is injected in slides.getSketchSettings (see ../breakdown/); this
 * overlay tells the story of the CURRENT step only, in the specs visual
 * language (same text colour for text + panel outline, black panel):
 *
 *   1/3  DOTS                ← header: counter + step title (hideable)
 *   COUNT: 42                ← the group's changing leaves, typed in
 *   FILL: rgba(255, 0, 0) ▪  ← colours carry a live-animating chip
 *
 * During the outro the whole block fades out, leaving the settled sketch.
 * Everything derives from the shared schedule (animation.progression) — no
 * wall clock, so frame-by-frame capture reproduces the narration exactly.
 *
 * Placement: "fixed" uses the draggable position; "roaming" walks a
 * deterministic corner tour (one anchor per step, `currentStep % 5`) so the
 * block never hides the same region of the sketch twice.
 */

// Corner tour for roaming placement: top-left → top-right → bottom-right →
// bottom-left → center. (x, y) is the anchor point in canvas fractions;
// (ax, ay) is which corner of the BLOCK sits on that point, so the block
// hugs each edge without overflowing.
const ROAM_ANCHORS = [
  {
    x: 0.06,
    y: 0.08,
    ax: 0,
    ay: 0
  },
  {
    x: 0.94,
    y: 0.08,
    ax: 1,
    ay: 0
  },
  {
    x: 0.94,
    y: 0.92,
    ax: 1,
    ay: 1
  },
  {
    x: 0.06,
    y: 0.92,
    ax: 0,
    ay: 1
  },
  {
    x: 0.5,
    y: 0.5,
    ax: 0.5,
    ay: 0.5
  }
];

// Fraction of each step window the body lines take to type in.
const TYPE_IN_SPAN = 0.4;

function clamp01( value ) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export default function drawSlideBreakdown( breakdownOption ) {
  const p = getP5();

  // A montage slide's params morph between OTHER slides — the breakdown
  // injection is inert there (montage wins in getSketchSettings), so the
  // narration would lie. Stay silent on montage slides.
  const currentSlide =
    typeof window !== "undefined" ? window.slides?.current : undefined;

  if ( currentSlide?.transition?.enabled ) {
    return;
  }

  const state = getBreakdownRuntimeState( breakdownOption );
  const {
    animSteps,
    progress,
    currentFlat,
    startValues
  } = state;

  // Nothing changed (diff mode) or nothing animatable: the injection no-ops
  // and the overlay hides — an honest diff shows nothing when nothing
  // differs.
  if ( !animSteps.length ) {
    return;
  }

  const {
    phase,
    phaseT,
    currentStep,
    stepLocalT
  } = progress;

  // Outro: fade the whole block out, panel included.
  const alpha = phase === "outro" ? Math.round( 255 * ( 1 - phaseT ) ) : 255;

  if ( alpha <= 0 ) {
    return;
  }

  const step = animSteps[ currentStep ];

  if ( !step ) {
    return;
  }

  const size = breakdownOption.size ?? 22;
  const lineStep = size * ( breakdownOption.lineHeight ?? 1.4 );
  const font =
    string.fonts?.[ breakdownOption.font ] ?? string.fonts.spaceMonoRegular;

  const measureWidth = ( text ) => {
    p.push();
    p.textFont( font );
    p.textSize( size );
    const w = p.textWidth( text );

    p.pop();

    return w;
  };

  /* ---- row model (measured at FINAL values: stable within a step) --- */

  const showHeader = breakdownOption.showHeader ?? true;
  const showCounter = breakdownOption.showCounter ?? true;
  const showTitle = breakdownOption.showTitle ?? true;

  let headerText = "";

  if ( showHeader && ( showCounter || showTitle ) ) {
    const parts = [];

    if ( showCounter ) {
      parts.push( formatCounter(
        currentStep,
        animSteps.length,
        breakdownOption.counterMode
      ) );
    }

    if ( showTitle ) {
      parts.push( step.label );
    }

    headerText = parts.join( "  " );
  }

  // One body line per leaf: "SUB LABEL: value". Nested leaves label with the
  // path past the group prefix; an isolated leaf repeats its own name (needed
  // when the header is hidden).
  const chipSide = size * 0.9;
  const chipGap = size * 0.4;

  const bodyLines = step.leaves.map( ( leaf ) => {
    const subPath = leaf.path.startsWith( `${ step.id }.` )
      ? leaf.path.slice( step.id.length + 1 )
      : leaf.path;
    const label = humanizeKey( subPath );
    const finalText = `${ label }: ${ formatValue( leaf.value ) ?? "" }`;

    // In-flight values sit BETWEEN start and final, so their rendered text
    // never outgrows the wider of the two extremes (plus a small margin for
    // the fractional digits a lerp introduces between integer endpoints).
    // Measuring only the final would under-reserve — mid-lerp a right-
    // anchored roaming block would overflow the canvas edge.
    const startValue = getByPath(
      startValues,
      leaf.path
    );
    const startText = `${ label }: ${ formatValue( startValue ) ?? "" }`;

    return {
      leaf,
      label,
      width:
        Math.max(
          measureWidth( finalText ),
          measureWidth( startText )
        ) +
        size * 0.8 +
        ( leaf.cls === "colors" ? chipGap + chipSide : 0 )
    };
  } );

  const rows = ( headerText ? 1 : 0 ) + bodyLines.length;

  if ( !rows ) {
    return;
  }

  const blockW = Math.max(
    headerText ? measureWidth( headerText ) : 0,
    ...bodyLines.map( ( line ) => line.width ),
    size * 4
  );
  const blockH = ( rows - 1 ) * lineStep + size;

  /* ---- placement ----------------------------------------------------- */

  p.push();
  if ( sketch.sketchOptions?.type === "webgl" ) {
    p.translate(
      -p.width / 2,
      -p.height / 2
    );
  }

  let originX;
  let originY;

  if ( ( breakdownOption.placement ?? "fixed" ) === "roaming" ) {
    // Deterministic corner tour — a different anchor per step, keyed on the
    // step index only (loop-clock world, capture-safe).
    const anchor = ROAM_ANCHORS[ currentStep % ROAM_ANCHORS.length ];

    originX = p.width * anchor.x - blockW * anchor.ax;
    originY = p.height * anchor.y - blockH * anchor.ay;
    // Roaming blocks are not draggable — no reported bounds (and contentDrag
    // additionally skips them, see its collectTargets guard).
  } else {
    originX = p.width * ( breakdownOption.position?.x ?? 0.06 );
    originY = p.height * ( breakdownOption.position?.y ?? 0.08 );

    // Generous, stable grab zone for the on-canvas drag (specs pattern).
    reportItemBounds(
      originX,
      originY - size,
      blockW,
      blockH + size * 2
    );
  }

  /* ---- panel (specs invocation, drawn first) -------------------------- */

  const texts = [];

  if ( headerText ) {
    texts.push( headerText );
  }

  bodyLines.forEach( ( line ) => texts.push( `${ line.label }: ${ formatValue( line.leaf.value ) ?? "" }` ) );

  const firstBox = measureVerticalTextBox(
    font,
    texts[ 0 ],
    originX,
    originY,
    size
  );
  const lastBox = measureVerticalTextBox(
    font,
    texts[ texts.length - 1 ],
    originX,
    originY + ( rows - 1 ) * lineStep,
    size
  );
  const bgPad = size * 0.35;

  drawItemBackground( {
    x: originX - bgPad,
    y: firstBox.top - bgPad,
    w: blockW + bgPad * 2,
    h: lastBox.bottom - firstBox.top + bgPad * 2,
    color: breakdownOption.backgroundColor,
    radius: breakdownOption.backgroundRadius ?? 0,
    alpha: alpha / 255,
    stroke: breakdownOption.backgroundStroke,
    strokeWeight: Math.min(
      Math.max(
        1,
        size * 0.06
      ),
      4
    )
  } );

  /* ---- text ------------------------------------------------------------ */

  const textFill = p.color( ...( breakdownOption.fill ?? [
    0,
    255,
    120
  ] ) );

  textFill.setAlpha( alpha );

  const writeLine = (
    text, x, y
  ) => {
    string.write(
      text,
      x,
      y,
      {
        size,
        font,
        fill: textFill,
        stroke: false,
        strokeWeight: 0,
        blendMode: breakdownOption.blend,
        textWidth: -1,
        textAlign: [
          p.LEFT,
          p.TOP
        ]
      }
    );
  };

  let y = originY;

  if ( headerText ) {
    writeLine(
      headerText,
      originX,
      y
    );
    y += lineStep;
  }

  // Body lines type in over the first part of the step window: earlier lines
  // full, the appearing line per-character (specs boot-log pattern).
  const exactLines =
    clamp01( stepLocalT / TYPE_IN_SPAN ) * bodyLines.length;
  const fullyVisible = Math.floor( exactLines );
  const typingFraction = exactLines - fullyVisible;

  bodyLines.forEach( (
    line, index
  ) => {
    if ( index > fullyVisible ) {
      return;
    }

    const liveValue = currentFlat.has( line.leaf.path )
      ? currentFlat.get( line.leaf.path )
      : line.leaf.value;
    const full = `${ line.label }: ${ formatValue( liveValue ) ?? "" }`;

    if ( index < fullyVisible ) {
      writeLine(
        full,
        originX,
        y
      );

      // Live colour chip after the text (HUD swatch look: filled square +
      // 1px border in the text colour).
      if ( line.leaf.cls === "colors" && Array.isArray( liveValue ) ) {
        const chipX = originX + measureWidth( full ) + chipGap;
        const chipY = y + ( size - chipSide ) / 2;
        const chipColor = p.color(
          liveValue[ 0 ] ?? 0,
          liveValue[ 1 ] ?? 0,
          liveValue[ 2 ] ?? 0
        );

        chipColor.setAlpha( Math.min(
          liveValue[ 3 ] ?? 255,
          alpha
        ) );

        const border = p.color( ...( breakdownOption.fill ?? [
          0,
          255,
          120
        ] ) );

        border.setAlpha( Math.min(
          120,
          alpha
        ) );

        p.push();
        p.blendMode( p.BLEND );
        p.noStroke();
        p.fill( chipColor );
        p.rect(
          chipX,
          chipY,
          chipSide,
          chipSide
        );
        p.noFill();
        p.stroke( border );
        p.strokeWeight( 1 );
        p.rect(
          chipX,
          chipY,
          chipSide,
          chipSide
        );
        p.pop();
      }
    } else {
      // Line currently being typed: reveal character by character.
      const visibleCount = Math.ceil( full.length * typingFraction );

      writeLine(
        full.slice(
          0,
          visibleCount
        ),
        originX,
        y
      );
    }

    y += lineStep;
  } );

  p.pop();
}
