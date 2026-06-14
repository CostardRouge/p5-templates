import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import string from "@/p5/utils/string.js";
import colors from "@/p5/utils/colors.js";

// ── What this sketch is ──────────────────────────────────────────────────────
// A word, centred on the canvas, with a spiral wound around it like a thread on
// a bobbin. The scene is genuinely 3D: it is drawn into an offscreen WEBGL
// graphics buffer and composited back onto the main canvas.
//
// The word is filled, opaque text sitting on the z = 0 plane. The spiral is a
// real helix wound around the screen's HORIZONTAL (X) axis: as it advances from
// left to right it rises and falls in Y and — crucially — swings toward and away
// from the viewer in Z:
//
//     x = left → right across the word
//     y = sin(angle) · radiusY      (rises / falls on screen)
//     z = cos(angle) · radiusZ      (comes in front of / goes behind the text)
//
// Because everything shares one depth buffer, the parts of the helix with z > 0
// are drawn in front of the letters and the parts with z < 0 are hidden behind
// them — no manual clipping, the GPU's z-test does it. Animating the helix phase
// slides those front/back crossings along the word, so each letter is alternately
// revealed and swallowed by the coil in quinconce.
//
// Orthographic projection (the default) keeps the weave flat and even; switch to
// perspective for the receding "round spiral" look where the far side of the coil
// shrinks into the distance.

const TAU = Math.PI * 2;

const state = {
  buffer: null
};

sketch.setup( ( {
  canvas
} ) => {
  const p = getP5();

  state.buffer = p.createGraphics(
    canvas.width,
    canvas.height,
    p.WEBGL
  );
} );

/**
 * Draw the word as opaque filled text on the z = 0 plane. Opaqueness is what
 * lets the depth buffer hide the helix segments that pass behind it. Returns the
 * half-width of the word so the helix knows how far to span.
 */
function drawWord(
  g, textOptions, font, size
) {
  const [
    fr,
    fg,
    fb
  ] = textOptions.fill ?? [
    235,
    235,
    240
  ];
  const strokeColor = textOptions.stroke ?? [
    0,
    0,
    0,
    255
  ];
  const strokeWeight = textOptions.strokeWeight ?? 0;
  const content = ( textOptions.content ?? "" ).toString();

  g.push();
  g.textFont( font );
  g.textSize( size );
  g.textAlign(
    g.CENTER,
    g.CENTER
  );
  g.fill(
    fr,
    fg,
    fb,
    255
  );

  if ( strokeWeight > 0 ) {
    g.stroke( ...strokeColor );
    g.strokeWeight( strokeWeight );
  } else {
    g.noStroke();
  }

  g.text(
    content,
    0,
    0
  );
  g.pop();

  // The opentype bounds are a far more reliable measure of the rendered width
  // than WEBGL's textWidth(), which under-reports for some fonts and would leave
  // the coil short of the word.
  const bounds = font.textBounds(
    content,
    0,
    0,
    size
  );

  return ( bounds?.w ?? size * content.length * 0.6 ) / 2;
}

/**
 * Draw the helix wound around the X axis, segment by segment so each piece can be
 * hued individually and depth-tested on its own. Segments are short lines in 3D
 * space; the WEBGL depth buffer resolves which ones land in front of the letters.
 */
function drawHelix( {
  g,
  helix,
  stroke,
  halfSpan,
  size,
  phase
} ) {
  const extend = ( helix.extend ?? 0.5 ) * size;
  const left = -halfSpan - extend;
  const right = halfSpan + extend;
  const span = right - left;

  const radiusY = size * ( helix.radiusY ?? 0.6 );
  const radiusZ = size * ( helix.radiusZ ?? 0.6 );
  const turns = helix.turns ?? 7;
  const direction = helix.direction ?? 1;
  const phaseOffset = helix.phaseOffset ?? 0;
  const count = Math.max(
    8,
    Math.round( helix.pointCount ?? 260 )
  );

  const gradient = stroke.gradient ?? false;
  const hueSpeed = stroke.hueSpeed ?? 1;
  const hueSpread = stroke.hueSpread ?? 1.5;
  const hueOffset = stroke.hueOffset ?? 0;
  const timeHue = animation.angle * hueSpeed;

  // When the hue is uniform it only depends on time, so compute it once.
  const uniformColor = colors.rainbow( {
    hueIndex: timeHue + hueOffset
  } );

  g.push();
  g.noFill();
  g.strokeWeight( helix.thickness ?? 16 );

  let prevX = 0;
  let prevY = 0;
  let prevZ = 0;

  for ( let i = 0; i < count; i++ ) {
    const t = i / ( count - 1 );
    const angle = phase + phaseOffset + t * turns * TAU * direction;
    const x = left + t * span;
    const y = Math.sin( angle ) * radiusY;
    const z = Math.cos( angle ) * radiusZ;

    if ( i > 0 ) {
      g.stroke( gradient
        ? colors.rainbow( {
          hueIndex: hueOffset + timeHue + t * TAU * hueSpread
        } )
        : uniformColor );
      g.line(
        prevX,
        prevY,
        prevZ,
        x,
        y,
        z
      );
    }

    prevX = x;
    prevY = y;
    prevZ = z;
  }

  g.pop();
}

sketch.draw( () => {
  const p = getP5();
  const g = state.buffer;
  const o = options.sketch ?? {};
  const textOptions = o.text ?? {};
  const helix = o.helix ?? {};
  const cameraOptions = o.camera ?? {};
  const position = o.position ?? {
    x: 0.5,
    y: 0.5
  };

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    8,
    8,
    12,
    255
  ] ) );

  if ( !g ) {
    return;
  }

  const fontKey = textOptions.font ?? "martian";
  const font = string.fonts[ fontKey ] ?? string.fonts.martian;

  if ( !font?.font ) {
    return;
  }

  const size = textOptions.size ?? 240;

  // Fresh colour + depth buffer every frame (transparent, so the p2d background
  // shows through once composited).
  g.clear();
  g.push();

  // Orthographic keeps the weave flat and even; perspective makes the far side of
  // the coil recede. Either way the depth buffer drives the front/back occlusion.
  // The projection persists on the graphics buffer between frames, so it is set
  // explicitly every frame (with arguments — the no-arg perspective() throws on a
  // p5.Graphics) to honour live toggling of the mode.
  if ( cameraOptions.orthographic ?? true ) {
    const halfW = g.width / 2;
    const halfH = g.height / 2;

    g.ortho(
      -halfW,
      halfW,
      -halfH,
      halfH,
      -( g.width + g.height ),
      g.width + g.height
    );
  } else {
    g.perspective(
      Math.PI / 3,
      g.width / g.height,
      1,
      10000
    );
  }

  // Move the whole scene to the requested screen position (WEBGL origin is the
  // centre; position is normalised with y pointing down like screen space).
  g.translate(
    ( position.x - 0.5 ) * g.width,
    ( position.y - 0.5 ) * g.height,
    0
  );

  // Optional tilt to expose the depth of the coil as an actual spiral in space.
  g.rotateX( cameraOptions.tiltX ?? 0 );
  g.rotateY( cameraOptions.tiltY ?? 0 );

  const halfSpan = drawWord(
    g,
    textOptions,
    font,
    size
  );

  drawHelix( {
    g,
    helix,
    stroke: o.stroke ?? {},
    halfSpan,
    size,
    phase: animation.angle * ( helix.speed ?? 1 )
  } );

  g.pop();

  p.image(
    g,
    0,
    0
  );
} );
