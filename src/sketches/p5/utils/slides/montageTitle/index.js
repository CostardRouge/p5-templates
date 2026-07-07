import string from "../../string.js";
import sketch, {
  getP5
} from "../../sketch.js";
import animation from "../../animation.js";
import easing from "../../easing.js";
import resolveMontageSources from "../morph/resolveMontageSources.js";
import {
  mapProgressionToSegment
} from "../morph/segmentMapper.js";
import {
  formatSlideTitle
} from "./formatTitle.js";
import {
  reportItemBounds
} from "../common/itemBoundsRegistry.js";
import {
  resolveMontageTitlePosition
} from "../contentDrag.js";

/**
 * Overlay that names the variant a montage slide is currently showing. It rides
 * on the same segment clock as the morph (segmentMapper), so the label tracks —
 * and animates between — the source slides as they cycle.
 *
 * Style chrome (title.style): plain / bracket / pill / underline, sharing the
 * specs overlay's colour, mono font and size by default.
 *
 * Change animation (title.changeAnimation), played as the shown variant flips
 * at each segment midpoint: none / fade / rise / scale / roll. "roll" is the
 * per-character odometer — digits & letters slide in the advance direction.
 */

// Half-width (in eased segment progress) of the window, centred on the segment
// midpoint, over which a variant change is animated.
const SWITCH_HALF_WINDOW = 0.18;

function clamp01( value ) {
  if ( !Number.isFinite( value ) ) {
    return 0;
  }

  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function getFont( key ) {
  return string.fonts?.[ key ] ?? string.fonts.spaceMonoRegular;
}

/** Left edge x of a `width`-wide label anchored at `anchorX` per `align`. */
function alignLeft(
  anchorX, width, align
) {
  if ( align === "left" ) {
    return anchorX;
  }

  if ( align === "center" ) {
    return anchorX - width / 2;
  }

  return anchorX - width; // "right" (default)
}

function colorWithAlpha(
  p, fill, alpha
) {
  const col = p.color(
    fill?.[ 0 ] ?? 0,
    fill?.[ 1 ] ?? 0,
    fill?.[ 2 ] ?? 0
  );

  col.setAlpha( clamp01( alpha / 255 ) * 255 );

  return col;
}

/**
 * Style chrome behind / around a label box of width `w` whose top-left is
 * (left, top). `alpha` is 0..255 (the resolved label opacity).
 */
function drawChrome(
  p, title, left, top, w, size, alpha
) {
  switch ( title.style ) {
    case "pill": {
      const padX = size * 0.35;
      const padTop = size * 0.18;
      const padBottom = size * 0.34;
      const h = size + padTop + padBottom;
      const radius = h / 2;

      p.push();
      p.rectMode( p.CORNER );
      p.noStroke();
      p.fill( colorWithAlpha(
        p,
        title.fill,
        alpha * 0.16
      ) );
      p.rect(
        left - padX,
        top - padTop,
        w + padX * 2,
        h,
        radius
      );
      p.noFill();
      p.stroke( colorWithAlpha(
        p,
        title.fill,
        alpha * 0.5
      ) );
      p.strokeWeight( Math.max(
        1,
        size * 0.05
      ) );
      p.rect(
        left - padX,
        top - padTop,
        w + padX * 2,
        h,
        radius
      );
      p.pop();
      break;
    }

    case "underline": {
      const lineY = top + size * 1.05;

      p.push();
      p.stroke( colorWithAlpha(
        p,
        title.fill,
        alpha
      ) );
      p.strokeWeight( Math.max(
        1,
        size * 0.07
      ) );
      p.line(
        left,
        lineY,
        left + w,
        lineY
      );
      p.pop();
      break;
    }

    case "bracket": {
      const gap = size * 0.35;
      const open = "[";
      const close = "]";

      p.push();
      p.noStroke();
      p.fill( colorWithAlpha(
        p,
        title.fill,
        alpha
      ) );
      p.text(
        open,
        left - gap - p.textWidth( open ),
        top
      );
      p.text(
        close,
        left + w + gap,
        top
      );
      p.pop();
      break;
    }

    default:
      break; // "plain"
  }
}

/** Draw a single styled, whole-string label with an optional transform. */
function paintLabel(
  p, title, anchorX, anchorY, font, size, baseAlpha, text, opts = {}
) {
  const {
    alpha = 1, dx = 0, dy = 0, scale = 1
  } = opts;
  const resolved = baseAlpha * clamp01( alpha );

  if ( !text || resolved < 1 ) {
    return;
  }

  p.push();
  p.textFont( font );
  p.textSize( size );
  p.textAlign(
    p.LEFT,
    p.TOP
  );

  const w = p.textWidth( text );
  const left = alignLeft(
    anchorX,
    w,
    title.align
  );
  const top = anchorY;

  p.translate(
    dx,
    dy
  );

  if ( scale !== 1 ) {
    const cx = left + w / 2;
    const cy = top + size / 2;

    p.translate(
      cx,
      cy
    );
    p.scale( scale );
    p.translate(
      -cx,
      -cy
    );
  }

  drawChrome(
    p,
    title,
    left,
    top,
    w,
    size,
    resolved
  );

  p.noStroke();
  p.fill( colorWithAlpha(
    p,
    title.fill,
    resolved
  ) );
  p.text(
    text,
    left,
    top
  );
  p.pop();
}

/** Draw one glyph horizontally centred in its column at vertical `top`. */
function drawGlyph(
  p, title, ch, centerX, top, baseAlpha, alpha
) {
  const resolved = baseAlpha * clamp01( alpha );

  if ( ch === " " || resolved < 1 ) {
    return;
  }

  const gw = p.textWidth( ch );

  p.noStroke();
  p.fill( colorWithAlpha(
    p,
    title.fill,
    resolved
  ) );
  p.text(
    ch,
    centerX - gw / 2,
    top
  );
}

/**
 * Per-character odometer between two labels. Columns that differ slide in
 * `direction` (+1 = upward / advance, -1 = backward) as `switchT` goes 0 -> 1.
 */
function paintRoll(
  p, title, anchorX, anchorY, font, size, baseAlpha, fromText, toText, switchT, direction
) {
  p.push();
  p.textFont( font );
  p.textSize( size );
  p.textAlign(
    p.LEFT,
    p.TOP
  );

  // Right-align both strings so shared trailing columns line up under the roll.
  // Columns are laid out on a per-glyph advance grid, so the odometer is exact
  // for the mono default font; a proportional font rolls with looser spacing.
  const len = Math.max(
    fromText.length,
    toText.length
  );
  const a = fromText.padStart( len );
  const b = toText.padStart( len );
  const spaceW = p.textWidth( " " );

  const colW = [];
  let totalW = 0;

  for ( let j = 0; j < len; j++ ) {
    const wj = Math.max(
      p.textWidth( a[ j ] ),
      p.textWidth( b[ j ] ),
      spaceW
    );

    colW.push( wj );
    totalW += wj;
  }

  const left = alignLeft(
    anchorX,
    totalW,
    title.align
  );
  const top = anchorY;

  drawChrome(
    p,
    title,
    left,
    top,
    totalW,
    size,
    baseAlpha
  );

  let x = left;

  for ( let j = 0; j < len; j++ ) {
    const cw = colW[ j ];
    const center = x + cw / 2;
    const oldCh = a[ j ];
    const newCh = b[ j ];

    if ( oldCh === newCh ) {
      drawGlyph(
        p,
        title,
        oldCh,
        center,
        top,
        baseAlpha,
        1
      );
    } else {
      drawGlyph(
        p,
        title,
        oldCh,
        center,
        top - direction * switchT * size,
        baseAlpha,
        1 - switchT
      );
      drawGlyph(
        p,
        title,
        newCh,
        center,
        top + direction * ( 1 - switchT ) * size,
        baseAlpha,
        switchT
      );
    }

    x += cw;
  }

  p.pop();
}

export default function drawMontageTitle(
  slide, allSlides, slideIndex = 0
) {
  const transition = slide?.transition;
  const title = transition?.title;

  if ( !transition?.enabled || !title?.enabled ) {
    return;
  }

  const slides = Array.isArray( allSlides ) ? allSlides : [];
  const sources = resolveMontageSources(
    slide,
    slides
  );

  // No resolved sources -> label the montage slide itself (acts as a plain,
  // static per-slide name tag).
  const subjects = sources.length ? sources : [
    slide
  ];
  const n = subjects.length;

  let fromIndex = 0;
  let toIndex = 0;
  let localT = 0;

  if ( n > 1 ) {
    const seg = mapProgressionToSegment(
      animation.progression,
      n,
      transition
    );

    fromIndex = seg.fromIndex;
    toIndex = seg.toIndex;
    localT = seg.localT;
  }

  const deckIndexOf = ( subject ) => {
    const i = slides.indexOf( subject );

    return i >= 0 ? i : 0;
  };

  const fromLabel = formatSlideTitle(
    subjects[ fromIndex ],
    fromIndex,
    deckIndexOf( subjects[ fromIndex ] ),
    title
  );
  const toLabel = formatSlideTitle(
    subjects[ toIndex ],
    toIndex,
    deckIndexOf( subjects[ toIndex ] ),
    title
  );

  const changing = fromIndex !== toIndex && title.changeAnimation !== "none";

  // 0 -> showing `from`, 1 -> showing `to`, eased across the switch window.
  let switchT;

  if ( !changing ) {
    switchT = localT < 0.5 ? 0 : 1;
  } else {
    const easeFn = easing[ title.changeEasing ] ?? easing.linear;
    const lo = 0.5 - SWITCH_HALF_WINDOW;

    switchT = easeFn( clamp01( ( localT - lo ) / ( SWITCH_HALF_WINDOW * 2 ) ) );
  }

  const p = getP5();
  const font = getFont( title.font );

  if ( !font?.font ) {
    return; // font still loading
  }

  const size = title.size ?? 22;
  const fill = Array.isArray( title.fill ) ? title.fill : [
    0,
    255,
    120
  ];
  const baseAlpha = fill[ 3 ] ?? 255;

  p.push();
  p.blendMode( title.blend ?? "source-over" );

  if ( sketch.sketchOptions?.type === "webgl" ) {
    p.translate(
      -p.width / 2,
      -p.height / 2
    );
  }

  // While the label is being dragged on canvas, follow the live position; the
  // stored one applies otherwise (the overlay renders outside freeLayout, so it
  // resolves its own drag override rather than going through resolveDraggedItem).
  const position = resolveMontageTitlePosition(
    slideIndex,
    title.position
  );
  const anchorX = p.width * ( position?.x ?? 0.95 );
  const anchorY = p.height * ( position?.y ?? 0.08 );

  // Report the shown label's rectangle so the drag layer can grab it by its
  // visible body (the anchor sits at the aligned edge, often off the glyphs).
  const shownText = switchT < 0.5 ? fromLabel : toLabel;

  if ( shownText ) {
    p.push();
    p.textFont( font );
    p.textSize( size );
    const shownWidth = p.textWidth( shownText );

    p.pop();

    reportItemBounds(
      alignLeft(
        anchorX,
        shownWidth,
        title.align
      ),
      anchorY,
      shownWidth,
      size
    );
  }

  if ( !changing ) {
    paintLabel(
      p,
      title,
      anchorX,
      anchorY,
      font,
      size,
      baseAlpha,
      switchT < 0.5 ? fromLabel : toLabel
    );
  } else if ( title.changeAnimation === "roll" ) {
    // Advance direction: forward steps roll upward, pingpong's return rolls back
    // down. Pingpong indices never wrap, so a falling index marks the descending
    // half — which also disambiguates n === 2, where the modular "next" test
    // can't tell the two directions apart. Cyclic / once always advance (the
    // last -> first wrap still reads as forward).
    const forward =
      transition.loop === "pingpong" ? toIndex > fromIndex : true;

    paintRoll(
      p,
      title,
      anchorX,
      anchorY,
      font,
      size,
      baseAlpha,
      fromLabel,
      toLabel,
      switchT,
      forward ? 1 : -1
    );
  } else if ( title.changeAnimation === "rise" ) {
    const amp = size * 0.55;

    paintLabel(
      p,
      title,
      anchorX,
      anchorY,
      font,
      size,
      baseAlpha,
      fromLabel,
      {
        alpha: 1 - switchT,
        dy: -switchT * amp
      }
    );
    paintLabel(
      p,
      title,
      anchorX,
      anchorY,
      font,
      size,
      baseAlpha,
      toLabel,
      {
        alpha: switchT,
        dy: ( 1 - switchT ) * amp
      }
    );
  } else if ( title.changeAnimation === "scale" ) {
    paintLabel(
      p,
      title,
      anchorX,
      anchorY,
      font,
      size,
      baseAlpha,
      fromLabel,
      {
        alpha: 1 - switchT,
        scale: 1 - 0.35 * switchT
      }
    );
    paintLabel(
      p,
      title,
      anchorX,
      anchorY,
      font,
      size,
      baseAlpha,
      toLabel,
      {
        alpha: switchT,
        scale: 0.65 + 0.35 * switchT
      }
    );
  } else {
    // "fade" (default): crossfade the two whole labels in place.
    paintLabel(
      p,
      title,
      anchorX,
      anchorY,
      font,
      size,
      baseAlpha,
      fromLabel,
      {
        alpha: 1 - switchT
      }
    );
    paintLabel(
      p,
      title,
      anchorX,
      anchorY,
      font,
      size,
      baseAlpha,
      toLabel,
      {
        alpha: switchT
      }
    );
  }

  p.pop();
  // push/pop does not restore blendMode in p5's 2D renderer.
  p.blendMode( "source-over" );
}
