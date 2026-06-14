import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import string from "@/p5/utils/string.js";
import cache from "@/p5/utils/cache.js";
import {
  renderSplines
} from "../../splines/_shared.js";

// ── What this sketch is ──────────────────────────────────────────────────────
// A centred word with a glowing, colourful spline (the shared `splines` v0 / v1
// renderer) wound around it like thread on a bobbin.
//
// The spline is a helix sampled in 3D — it advances horizontally, rises / falls
// in Y and swings toward / away from the viewer in Z — then PROJECTED back to 2D
// (optional perspective + tilt) so it still reads as a real spiral in space. The
// glow renderer is a 2D screen-space effect, so projecting the helix ourselves is
// what lets us keep the colourful spline while still getting a 3D coil look.
//
// The over / under weave is done by depth, in three layers:
//
//   1. background
//   2. the BEHIND arcs of the helix (Z behind the text plane)        ← glowing spline
//   3. the word, drawn from a cached alpha texture of the glyphs      ← the mask
//   4. the IN-FRONT arcs of the helix (Z in front of the text plane)  ← glowing spline
//
// The mask is a transparent texture with ONLY the glyph shapes painted (no black
// box), so it clips the behind arcs to the exact letter outlines — clean weaving
// between letters — and it is rendered once and cached, then tinted at draw time
// so the colour is free to change without re-rasterising the font.

const TAU = Math.PI * 2;

/**
 * Render the whole word once into a canvas-sized, transparent graphics buffer,
 * painting only the glyph shapes in white. Cached on the text / font / size /
 * canvas — NOT the colour, which is applied with tint() at draw time. White +
 * tint means any fill colour (or, later, an image texture) reuses the same mask.
 */
function getWordTexture( {
  content,
  font,
  size,
  fontKey
} ) {
  const p = getP5();
  const key = cache.key(
    "text-layered-spline-mask",
    content,
    fontKey,
    size,
    p.width,
    p.height
  );

  return cache.store(
    key,
    () => {
      const g = p.createGraphics(
        p.width,
        p.height
      );

      g.clear();
      g.push();
      g.textFont( font );
      g.textSize( size );
      g.textAlign(
        g.CENTER,
        g.CENTER
      );
      g.noStroke();
      g.fill( 255 );
      g.text(
        content,
        g.width / 2,
        g.height / 2
      );
      g.pop();

      return g;
    }
  );
}

/**
 * Sample the helix in 3D and project every point to absolute canvas coordinates.
 * Returns the screen points (for the spline) alongside the camera-space depth of
 * each (for the front / behind split). The text sits on the z = 0 plane, so a
 * positive projected depth means "in front of the letters".
 */
function projectHelix( {
  helix,
  camera,
  centerX,
  centerY,
  size,
  halfSpan,
  phase
} ) {
  const p = getP5();
  const extend = ( helix.extend ?? 0.4 ) * size;
  const span = ( halfSpan + extend ) * 2;

  const radiusY = size * ( helix.radiusY ?? 0.6 );
  const radiusZ = size * ( helix.radiusZ ?? 0.6 );
  const turns = helix.turns ?? 5;
  const direction = helix.direction ?? 1;
  const phaseOffset = helix.phaseOffset ?? 0;
  const count = Math.max(
    8,
    Math.round( helix.pointCount ?? 260 )
  );

  const perspective = camera.perspective ?? true;
  const tiltX = camera.tiltX ?? 0.3;
  const tiltY = camera.tiltY ?? 0;
  const cosX = Math.cos( tiltX );
  const sinX = Math.sin( tiltX );
  const cosY = Math.cos( tiltY );
  const sinY = Math.sin( tiltY );
  // Keep the focal length well beyond the coil so the perspective divide stays
  // positive and the foreshortening is a gentle recede rather than a fisheye.
  const focal = size * 4 + radiusZ;

  const points = [];
  const depths = [];

  for ( let i = 0; i < count; i++ ) {
    const t = i / ( count - 1 );
    const angle = phase + phaseOffset + t * turns * TAU * direction;

    const lx = ( t - 0.5 ) * span;
    const ly = Math.sin( angle ) * radiusY;
    const lz = Math.cos( angle ) * radiusZ;

    // Tilt around X (look down on the coil), then around Y (turn it).
    const y1 = ly * cosX - lz * sinX;
    const z1 = ly * sinX + lz * cosX;
    const x2 = lx * cosY + z1 * sinY;
    const z2 = -lx * sinY + z1 * cosY;

    const scale = perspective
      ? Math.min(
        5,
        Math.max(
          0.2,
          focal / ( focal - z2 )
        )
      )
      : 1;

    points.push( p.createVector(
      centerX + x2 * scale,
      centerY + y1 * scale
    ) );
    depths.push( z2 );
  }

  return {
    points,
    depths
  };
}

/**
 * Split the projected helix into contiguous runs of the same side (in front of
 * vs behind the text plane). Each sign flip starts a new run seeded with the
 * previous point, so neighbouring arcs overlap by a vertex and join cleanly once
 * the spline renderer smooths them. Runs shorter than two points are dropped.
 */
function splitByDepth(
  points, depths
) {
  const front = [];
  const back = [];
  let current = null;
  let currentIsFront = null;

  for ( let i = 0; i < points.length; i++ ) {
    const isFront = depths[ i ] >= 0;

    if ( current === null || isFront !== currentIsFront ) {
      const seed = current && current.length
        ? [
          current[ current.length - 1 ]
        ]
        : [];

      current = seed;
      currentIsFront = isFront;
      ( isFront ? front : back ).push( current );
    }

    current.push( points[ i ] );
  }

  const usable = ( runs ) => runs.filter( ( run ) => run.length >= 2 );

  return {
    front: usable( front ),
    back: usable( back )
  };
}

function renderArcs(
  runs, o
) {
  renderSplines(
    runs,
    {
      curve: {
        method: "chaikin",
        closed: false,
        iterations: o.curve?.iterations ?? 4
      },
      stroke: o.stroke ?? {},
      overlay: {
        polygon: {
          show: false
        },
        points: {
          show: false
        }
      }
    }
  );
}

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const textOptions = o.text ?? {};
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
  p.strokeCap( p.ROUND );
  p.strokeJoin( p.ROUND );

  const fontKey = textOptions.font ?? "martian";
  const font = string.fonts[ fontKey ] ?? string.fonts.martian;

  if ( !font?.font ) {
    return;
  }

  const content = ( textOptions.content ?? "" ).toString();

  if ( content.length === 0 ) {
    return;
  }

  const size = textOptions.size ?? 200;
  const centerX = p.width * position.x;
  const centerY = p.height * position.y;

  // Accurate rendered width from the font, so the coil spans the whole word.
  const bounds = font.textBounds(
    content,
    0,
    0,
    size
  );
  const halfSpan = ( bounds?.w ?? size * content.length * 0.6 ) / 2;

  const {
    points,
    depths
  } = projectHelix( {
    helix: o.helix ?? {},
    camera: o.camera ?? {},
    centerX,
    centerY,
    size,
    halfSpan,
    phase: animation.angle * ( o.helix?.speed ?? 1 )
  } );

  const {
    front,
    back
  } = splitByDepth(
    points,
    depths
  );

  // 1. arcs behind the word — the glowing spline.
  renderArcs(
    back,
    o
  );

  // 2. the word mask: cached glyph alpha, tinted to the chosen colour. Only the
  //    glyph pixels are opaque, so the behind arcs are clipped to the letters.
  const texture = getWordTexture( {
    content,
    font,
    size,
    fontKey
  } );
  const fill = textOptions.fill ?? [
    235,
    235,
    240,
    255
  ];

  p.push();
  p.blendMode( p.BLEND );
  p.tint( ...fill );
  p.image(
    texture,
    centerX - p.width / 2,
    centerY - p.height / 2
  );
  p.pop();

  // 3. arcs in front of the word — the glowing spline, on top.
  renderArcs(
    front,
    o
  );
} );
