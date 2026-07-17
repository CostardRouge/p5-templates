import string from "../../string.js";
import sketch, {
  getP5
} from "../../sketch.js";
import time from "../../time.js";
import breakdownSound from "./breakdownSound.js";
import {
  getBreakdownRuntimeState
} from "../breakdown/index.js";
import {
  getByPath,
  matchesKeyList
} from "../breakdown/deriveSteps.js";
import {
  formatCounter,
  formatValue,
  humanizeKey,
  sampleValueTexts
} from "../breakdown/format.js";
import staggeredProgress from "../morph/staggeredProgress.js";
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
 *   1/3  DOTS                ← header: counter + step title (hideable; the
 *                              title hides itself on isolated single params
 *                              whose body line repeats the same name)
 *   COUNT: ▓▓▓░░░ 42         ← changing leaves; the value renders per
 *   FILL:  ▓▓░░░░ ▪            `valueStyle`: gauge-style bar (default),
 *                              live ticker, roll / fade / rise transitions
 *
 * Labels appear whole by default — only the value animates; `typewriter`
 * re-enables per-character typing, and `build.lineStagger` offsets the lines
 * of a group (0 = all together, 1 ≈ one after another; it also staggers the
 * injected values, so overlay and sketch stay in lock-step via the shared
 * per-leaf progress). Layout reserves each value column at the widest text
 * the lerp can produce (sampleValueTexts), so nothing overflows the panel
 * mid-animation. During the outro the whole block fades out.
 *
 * Placement: "fixed" uses the draggable position; "roaming" walks a
 * deterministic corner tour (one anchor per step, `currentStep % 5`). All
 * timing derives from animation.progression — capture-deterministic.
 */

// Corner tour for roaming placement: top-left → top-right → bottom-right →
// bottom-left → center. (x, y) is the anchor point in canvas fractions;
// (ax, ay) is which corner of the BLOCK sits on that point.
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

// Fraction of each step window over which lines reveal (stagger/typewriter).
const REVEAL_SPAN = 0.4;

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
    leafT,
    startValues
  } = state;

  // Nothing changed (diff mode) or nothing animatable: the injection no-ops
  // and the overlay hides — an honest diff shows nothing when nothing
  // differs.
  if ( !animSteps.length ) {
    return;
  }

  // Sound on change: click as each parameter locks into place. Scheduled off
  // the same runtime state the overlay draws, so a click can never drift from
  // the value it narrates. Runs regardless of the drawing early-returns below
  // (outro fade, missing step) so the last step's clicks still flush.
  const sound = breakdownOption.sound;

  if ( sound?.enabled ) {
    breakdownSound.noteFrame(
      sound,
      {
        animSteps,
        leafT,
        now: time.seconds()
      }
    );
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

  const size = breakdownOption.size ?? 16;
  const lineStep = size * ( breakdownOption.lineHeight ?? 1.4 );
  const font =
    string.fonts?.[ breakdownOption.font ] ?? string.fonts.spaceMonoRegular;
  const valueStyle = breakdownOption.valueStyle ?? "bar";
  const typewriter = breakdownOption.typewriter ?? false;
  const lineStagger = breakdownOption.build?.lineStagger ?? 0;
  const snapKeys = breakdownOption.build?.snapKeys ?? [
    "seed"
  ];

  const measureWidth = ( text ) => {
    p.push();
    p.textFont( font );
    p.textSize( size );
    const w = p.textWidth( text );

    p.pop();

    return w;
  };

  const baseFill = () => {
    const c = p.color( ...( breakdownOption.fill ?? [
      0,
      255,
      120
    ] ) );

    c.setAlpha( alpha );

    return c;
  };

  /* ---- header --------------------------------------------------------- */

  const showHeader = breakdownOption.showHeader ?? true;
  const showCounter = breakdownOption.showCounter ?? true;
  const showTitle = breakdownOption.showTitle ?? true;

  // An isolated single param's body line repeats the full parameter name —
  // a header title would be a word-for-word duplicate. Groups reduced to one
  // changed sub-property keep theirs (GRID / COLUMNS: 8 is informative).
  const titleRedundant =
    step.leaves.length === 1 && !step.leaves[ 0 ].path.includes( "." );

  let headerText = "";

  if ( showHeader && ( showCounter || ( showTitle && !titleRedundant ) ) ) {
    const parts = [];

    if ( showCounter ) {
      parts.push( formatCounter(
        currentStep,
        animSteps.length,
        breakdownOption.counterMode
      ) );
    }

    if ( showTitle && !titleRedundant ) {
      parts.push( step.label );
    }

    headerText = parts.join( "  " );
  }

  /* ---- row model -------------------------------------------------------
   * Column layout, reserved up front so nothing can overflow mid-lerp:
   *   LABEL:  [ value zone ]
   * The value zone is sized at the WIDEST text the lerp can render
   * (sampleValueTexts) plus the bar / colour chip the style adds.
   */

  const chipSide = size * 0.9;
  const gap = size * 0.4;
  const barW = size * 6;
  const barH = size * 0.45;

  const bodyLines = step.leaves.map( ( leaf ) => {
    const subPath = leaf.path.startsWith( `${ step.id }.` )
      ? leaf.path.slice( step.id.length + 1 )
      : leaf.path;
    const labelText = `${ humanizeKey( subPath ) }: `;
    const startValue = getByPath(
      startValues,
      leaf.path
    );
    const isColor = leaf.cls === "colors";
    const snap = matchesKeyList(
      leaf.path,
      snapKeys
    );

    const maxTextW = Math.max(
      0,
      ...sampleValueTexts(
        startValue,
        leaf.value,
        snap
      ).map( measureWidth )
    );

    // What the style renders inside the value zone:
    //   bar    → bar [+ live text | chip]
    //   ticker → live text [+ chip]
    //   roll/fade/rise → start/final texts crossfading [+ chip]
    let valueZoneW;

    if ( valueStyle === "bar" ) {
      valueZoneW = barW + gap + ( isColor ? chipSide : maxTextW );
    } else {
      valueZoneW = maxTextW + ( isColor ? gap + chipSide : 0 );
    }

    return {
      leaf,
      labelText,
      startValue,
      isColor,
      labelW: measureWidth( labelText ),
      valueZoneW,
      width: measureWidth( labelText ) + valueZoneW
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

  /* ---- placement ------------------------------------------------------- */

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

  /* ---- panel (specs invocation, drawn first) ---------------------------- */

  const firstText = headerText || bodyLines[ 0 ].labelText;
  const lastLine = bodyLines[ bodyLines.length - 1 ];
  const firstBox = measureVerticalTextBox(
    font,
    firstText,
    originX,
    originY,
    size
  );
  const lastBox = measureVerticalTextBox(
    font,
    lastLine ? lastLine.labelText : firstText,
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

  /* ---- drawing helpers --------------------------------------------------- */

  const writeText = (
    text, x, y, alphaFactor = 1
  ) => {
    if ( !text ) {
      return;
    }

    const fill = baseFill();

    fill.setAlpha( Math.round( alpha * clamp01( alphaFactor ) ) );

    string.write(
      text,
      x,
      y,
      {
        size,
        font,
        fill,
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

  const drawChip = (
    x, y, liveValue
  ) => {
    if ( !Array.isArray( liveValue ) ) {
      return;
    }

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

    const border = baseFill();

    border.setAlpha( Math.min(
      120,
      alpha
    ) );

    p.push();
    p.blendMode( p.BLEND );
    p.noStroke();
    p.fill( chipColor );
    p.rect(
      x,
      chipY,
      chipSide,
      chipSide
    );
    p.noFill();
    p.stroke( border );
    p.strokeWeight( 1 );
    p.rect(
      x,
      chipY,
      chipSide,
      chipSide
    );
    p.pop();
  };

  const drawBar = (
    x, y, t
  ) => {
    const barY = y + ( size - barH ) / 2;
    const track = baseFill();

    track.setAlpha( Math.min(
      60,
      alpha
    ) );

    p.push();
    p.blendMode( p.BLEND );
    p.noStroke();
    p.fill( track );
    p.rect(
      x,
      barY,
      barW,
      barH
    );
    p.fill( baseFill() );
    p.rect(
      x,
      barY,
      barW * clamp01( t ),
      barH
    );
    p.pop();
  };

  // Clip to one line's value zone so rise/roll glyphs sliding vertically
  // never bleed into the neighbouring lines.
  const withLineClip = (
    x, y, w, draw
  ) => {
    const ctx = p.drawingContext;

    ctx.save();
    ctx.beginPath();
    ctx.rect(
      x,
      y - size * 0.2,
      w,
      size * 1.4
    );
    ctx.clip();
    draw();
    ctx.restore();
  };

  /* ---- text -------------------------------------------------------------- */

  let y = originY;

  if ( headerText ) {
    writeText(
      headerText,
      originX,
      y
    );
    y += lineStep;
  }

  const leafCount = bodyLines.length;

  bodyLines.forEach( (
    line, index
  ) => {
    // Per-line reveal: with lineStagger 0 every line is on from the step's
    // first frame; higher values wash the lines in one after another over
    // the first REVEAL_SPAN of the window.
    const reveal = staggeredProgress(
      clamp01( stepLocalT / REVEAL_SPAN ),
      leafCount > 1 ? index / ( leafCount - 1 ) : 0,
      lineStagger
    );

    if ( reveal <= 0 ) {
      y += lineStep;

      return;
    }

    const path = line.leaf.path;
    const t = leafT.get( path ) ?? 1;
    const liveValue = currentFlat.has( path )
      ? currentFlat.get( path )
      : line.leaf.value;
    const startText = formatValue( line.startValue ) ?? "";
    const finalText = formatValue( line.leaf.value ) ?? "";
    const liveText = formatValue( liveValue ) ?? "";

    // Label: whole by default; per-character only when typewriter is on.
    const labelText = typewriter
      ? line.labelText.slice(
        0,
        Math.ceil( line.labelText.length * reveal )
      )
      : line.labelText;

    writeText(
      labelText,
      originX,
      y
    );

    // The value zone renders once the label is fully in.
    const valueReady = !typewriter || reveal >= 1;
    const valueX = originX + line.labelW;

    if ( valueReady ) {
      switch ( valueStyle ) {
        case "ticker":
          writeText(
            liveText,
            valueX,
            y
          );

          if ( line.isColor ) {
            drawChip(
              valueX + measureWidth( liveText ) + gap,
              y,
              liveValue
            );
          }

          break;

        case "fade":
          writeText(
            startText,
            valueX,
            y,
            1 - t
          );
          writeText(
            finalText,
            valueX,
            y,
            t
          );

          if ( line.isColor ) {
            drawChip(
              valueX + line.valueZoneW - chipSide,
              y,
              liveValue
            );
          }

          break;

        case "rise": {
          const amp = size * 0.55;
          const textZoneW = line.valueZoneW - ( line.isColor ? gap + chipSide : 0 );

          withLineClip(
            valueX,
            y,
            textZoneW,
            () => {
              writeText(
                startText,
                valueX,
                y - t * amp,
                1 - t
              );
              writeText(
                finalText,
                valueX,
                y + ( 1 - t ) * amp,
                t
              );
            }
          );

          if ( line.isColor ) {
            drawChip(
              valueX + line.valueZoneW - chipSide,
              y,
              liveValue
            );
          }

          break;
        }

        case "roll": {
          // Per-character odometer: each column rolls from the start glyph
          // to the final glyph, later columns trailing slightly.
          const textZoneW = line.valueZoneW - ( line.isColor ? gap + chipSide : 0 );
          const charW = measureWidth( "0" ) || size * 0.6;
          const maxLen = Math.max(
            startText.length,
            finalText.length
          );

          withLineClip(
            valueX,
            y,
            textZoneW,
            () => {
              for ( let k = 0; k < maxLen; k++ ) {
                const fromChar = startText[ k ] ?? "";
                const toChar = finalText[ k ] ?? "";
                const charT = staggeredProgress(
                  t,
                  maxLen > 1 ? k / ( maxLen - 1 ) : 0,
                  0.35
                );
                const x = valueX + k * charW;

                if ( fromChar === toChar ) {
                  writeText(
                    toChar,
                    x,
                    y
                  );
                  continue;
                }

                writeText(
                  fromChar,
                  x,
                  y - charT * size * 1.1,
                  1 - charT
                );
                writeText(
                  toChar,
                  x,
                  y + ( 1 - charT ) * size * 1.1,
                  charT
                );
              }
            }
          );

          if ( line.isColor ) {
            drawChip(
              valueX + line.valueZoneW - chipSide,
              y,
              liveValue
            );
          }

          break;
        }

        case "bar":
        default:
          drawBar(
            valueX,
            y,
            t
          );

          if ( line.isColor ) {
            drawChip(
              valueX + barW + gap,
              y,
              liveValue
            );
          } else {
            writeText(
              liveText,
              valueX + barW + gap,
              y
            );
          }

          break;
      }
    }

    y += lineStep;
  } );

  p.pop();
}
