import options from "@/p5/utils/options.js";
import easing from "@/p5/utils/easing.js";
import string from "@/p5/utils/string.js";
import exif from "@/p5/utils/exif.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import imageUtils from "@/p5/utils/imageUtils.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";
import {
  shapeAspect,
  resolveFrame,
  getCoverTexture
} from "@/p5/utils/photo/coverTexture.js";

/* ------------------------------------------------------------------ */
/*  Photo 3D stack                                                     */
/*                                                                     */
/*  A loop of photo cards that flow endlessly along a 3D path. The     */
/*  path shape is configurable — a receding tower, a rotating helix,   */
/*  an orbiting carousel, a camera-facing tunnel or a serpentine wave  */
/*  — and a global turntable spin can rotate the whole formation for a */
/*  circular-rotation feel.                                            */
/*                                                                     */
/*  Everything is a pure function of animation.progression so the      */
/*  motion loops seamlessly and records cleanly (no per-frame random,  */
/*  no orbitControl). Cards are flat textured quads, cover-cropped and */
/*  cached once per photo, sorted back-to-front so alpha blends right. */
/* ------------------------------------------------------------------ */

/* ----------------------------- helpers ---------------------------- */

const clamp = (
  value, low, high
) => Math.max(
  low,
  Math.min(
    high,
    value
  )
);

const smoothstep = (
  edge0, edge1, x
) => {
  if ( edge1 === edge0 ) {
    return x < edge0 ? 0 : 1;
  }

  const t = clamp(
    ( x - edge0 ) / ( edge1 - edge0 ),
    0,
    1
  );

  return t * t * ( 3 - 2 * t );
};

/* ------------------------- option readers ------------------------- */

const getLayout = () => options.sketch?.layout ?? {};
const getMotion = () => options.sketch?.motion ?? {};
const getStyle = () => options.sketch?.style ?? {};
const getInfo = () => options.sketch?.info ?? {};

const getBackground = () => getStyle().backgroundColor ?? [
  14,
  14,
  18
];

/* --------------------------- path shapes -------------------------- */
/*  Each shape maps a card's lifecycle phase (0 → 1, wrapping) to a    */
/*  local placement: position + the Y rotation that orients the card.  */
/*  Camera-facing shapes return rotY ≈ 0; orbiting shapes turn the     */
/*  card outward so the front-most one squarely faces the camera.      */

const PLACEMENTS = {
  // Receding deck: cards rise from the near foreground up into the
  // distance, shrinking with perspective like an endless stack.
  tower: (
    phase, layout, p
  ) => ( {
    x: 0,
    y: p.lerp(
      layout.rise / 2,
      -layout.rise / 2,
      phase
    ),
    z: p.lerp(
      layout.depth * 0.2,
      -layout.depth,
      phase
    ),
    rotY: 0
  } ),

  // Spiral staircase around the vertical axis — the circular-rotation
  // headline. Cards face outward, so the nearest one faces the camera.
  helix: (
    phase, layout, p
  ) => {
    const angle = phase * p.TAU * layout.turns;

    return {
      x: Math.cos( angle ) * layout.radius,
      y: p.lerp(
        -layout.rise / 2,
        layout.rise / 2,
        phase
      ),
      z: Math.sin( angle ) * layout.radius,
      rotY: p.HALF_PI - angle
    };
  },

  // Single ring at eye level, gently bobbing — a coverflow turntable.
  carousel: (
    phase, layout, p
  ) => {
    const angle = phase * p.TAU;

    return {
      x: Math.cos( angle ) * layout.radius,
      y: Math.sin( phase * p.TAU * 2 ) * layout.rise * 0.06,
      z: Math.sin( angle ) * layout.radius,
      rotY: p.HALF_PI - angle
    };
  },

  // Cards charge straight at the camera down the Z axis.
  tunnel: (
    phase, layout, p
  ) => ( {
    x: 0,
    y: 0,
    z: p.lerp(
      -layout.depth,
      layout.depth * 0.25,
      phase
    ),
    rotY: 0
  } ),

  // Serpentine ribbon swinging left/right while flowing top → bottom.
  wave: (
    phase, layout, p
  ) => {
    const swing = Math.sin( phase * p.TAU * layout.waves );

    return {
      x: swing * layout.amplitude,
      y: p.lerp(
        -layout.rise / 2,
        layout.rise / 2,
        phase
      ),
      z: Math.cos( phase * p.TAU * layout.waves ) * layout.depth * 0.5,
      rotY: swing * 0.6
    };
  }
};

/* --------------------------- normalising -------------------------- */

function readLayout() {
  const layout = getLayout();

  return {
    shape: PLACEMENTS[ layout.shape ] ? layout.shape : "helix",
    count: Math.max(
      0,
      Math.round( layout.count ?? 0 )
    ),
    radius: layout.radius ?? 300,
    turns: layout.turns ?? 1.4,
    depth: layout.depth ?? 1100,
    rise: layout.rise ?? 1500,
    waves: Math.max(
      1,
      layout.waves ?? 2
    ),
    amplitude: layout.amplitude ?? 260,
    photoSize: clamp(
      layout.photoSize ?? 0.6,
      0.1,
      1.5
    ),
    photoShape: layout.photoShape ?? "auto",
    zoom: layout.zoom ?? -1150
  };
}

function readMotion() {
  const motion = getMotion();

  // Whole cycles/turns per loop keep the scroll and turntable seamless across
  // the loop wrap (a fractional count would snap back at progression 1 → 0).
  return {
    scrollSpeed: Math.round( motion.scrollSpeed ?? 1 ),
    direction: motion.direction === "up" ? -1 : 1,
    spin: Math.round( motion.spin ?? 1 ),
    sway: motion.sway ?? 0.12,
    tilt: clamp(
      motion.tilt ?? -0.15,
      -1,
      1
    ),
    cardSpin: motion.cardSpin ?? 0,
    easingFn: easing[ motion.easing ] || easing.linear
  };
}

/* ----------------------------- camera ----------------------------- */

/**
 * Fit the frustum loosely around the whole formation so cards never
 * wink out against the near/far planes, whatever the radius/zoom/depth.
 */
function applyPerspective(
  p, layout
) {
  const eyeZ = ( p.height / 2 ) / Math.tan( Math.PI / 6 );
  const reach = Math.abs( layout.zoom )
    + layout.depth
    + layout.rise
    + layout.radius
    + 2000;

  p.perspective(
    Math.PI / 3,
    p.width / p.height,
    1,
    eyeZ + reach
  );
}

/* --------------------------- info overlay ------------------------- */

function buildInfoText(
  asset, info
) {
  const parts = [
    exif.formatFocalLength( asset?.exif?.focalLength ),
    exif.formatAperture( asset?.exif?.aperture ),
    exif.formatShutterSpeed( asset?.exif?.shutterSpeed ),
    exif.formatISO( asset?.exif?.iso )
  ].filter( Boolean );

  if ( info.showFilename && asset?.filename ) {
    parts.unshift( asset.filename );
  }

  return parts.join( "  ·  " );
}

// Each entry is the box ORIGIN (not its centre): `string.write` is given a
// `textWidth` of `span` and centre alignment, so it centres the text inside
// `[origin, origin + span]` along the local x-axis after `rotate(angle)`.
const INFO_PLACEMENTS = {
  bottom: ( p ) => ( {
    x: 0,
    y: p.height - 40,
    angle: 0,
    span: p.width
  } ),
  top: ( p ) => ( {
    x: 0,
    y: 40,
    angle: 0,
    span: p.width
  } ),
  left: ( p ) => ( {
    x: 40,
    y: p.height,
    angle: -p.HALF_PI,
    span: p.height
  } ),
  right: ( p ) => ( {
    x: p.width - 40,
    y: 0,
    angle: p.HALF_PI,
    span: p.height
  } )
};

function drawInfo(
  asset, info
) {
  if ( !info.show || !asset ) {
    return;
  }

  const text = buildInfoText(
    asset,
    info
  );

  if ( !text ) {
    return;
  }

  const p = getP5();
  const place = ( INFO_PLACEMENTS[ info.placement ] ?? INFO_PLACEMENTS.bottom )( p );
  const color = info.color ?? [
    235,
    235,
    235
  ];

  p.push();
  p.translate(
    -p.width / 2,
    -p.height / 2
  );
  p.translate(
    place.x,
    place.y
  );
  p.rotate( place.angle );
  string.write(
    text,
    0,
    0,
    {
      size: info.size ?? 22,
      fill: p.color( ...color ),
      stroke: p.color( ...getBackground() ),
      strokeWeight: 4,
      font: string.fonts?.[ info.font ] || string.fonts.martian,
      textWidth: place.span,
      popPush: false,
      textAlign: [
        p.CENTER,
        p.CENTER
      ]
    }
  );
  p.pop();
}

function drawTitle() {
  const p = getP5();

  p.push();
  p.translate(
    -p.width / 2,
    -p.height / 2
  );
  renderTitle();
  p.pop();
}

/* ------------------------------ sketch ---------------------------- */

sketch.setup(
  undefined,
  {
    type: "webgl",
    size: {
      width: options.size?.width,
      height: options.size?.height
    },
    animation: {
      framerate:
        options.sketch?.animation?.framerate ?? options.animation?.framerate ?? 60,
      duration:
        options.sketch?.animation?.duration ?? options.animation?.duration ?? 10
    }
  }
);

sketch.draw( (
  _time, _center, favoriteColor
) => {
  const p = getP5();
  const layout = readLayout();
  const motion = readMotion();
  const style = getStyle();

  p.clear();

  if ( style.variableBackgroundColor ) {
    p.background( p.lerpColor(
      p.color( ...getBackground() ),
      favoriteColor,
      animation.triangleProgression()
    ) );
  } else {
    p.background( ...getBackground() );
  }

  const images = imageUtils.getImages();

  if ( images.length === 0 ) {
    drawTitle();
    return;
  }

  const cardCount = layout.count > 0 ? layout.count : images.length;
  const aspect = shapeAspect( layout.photoShape );
  const frame = resolveFrame( {
    enabled: style.photoFrame,
    color: style.frameColor,
    thickness: style.frameThickness
  } );

  const cardLong = p.height * layout.photoSize;
  const cardWidth = aspect >= 1 ? cardLong : cardLong * aspect;
  const cardHeight = aspect >= 1 ? cardLong / aspect : cardLong;

  const place = PLACEMENTS[ layout.shape ];
  const progression = animation.progression;
  const tiltRad = motion.tilt * p.HALF_PI;

  // `spin` is whole turntable revolutions per loop (seamless across the loop
  // wrap); `sway` is a gentle pendulum that always returns to zero at the seam.
  const globalAngle =
    progression * motion.spin * p.TAU
    + Math.sin( progression * p.TAU ) * motion.sway;

  // Trig for the camera-space depth of each card (rotateX(tilt) ∘
  // rotateY(globalAngle)), reused for sorting and depth dimming.
  const sinG = Math.sin( globalAngle );
  const cosG = Math.cos( globalAngle );
  const sinT = Math.sin( tiltRad );
  const cosT = Math.cos( tiltRad );

  /* -- build the card list ---------------------------------------- */

  const cards = [];

  for ( let i = 0; i < cardCount; i++ ) {
    const asset = images[ i % images.length ];
    const texture = getCoverTexture( {
      asset,
      aspect,
      frame,
      keyPrefix: "photo-stack-tex",
      long: 1024
    } );

    if ( !texture ) {
      continue;
    }

    const base = i / cardCount;
    const phase = (
      ( progression * motion.scrollSpeed * motion.direction + base ) % 1 + 1
    ) % 1;
    const eased = motion.easingFn( phase );
    const placement = place(
      eased,
      layout,
      p
    );

    // Camera-space Z after the turntable + tilt — drives both the
    // back-to-front draw order and the depth-based dimming (larger = nearer).
    const rotatedZ = -placement.x * sinG + placement.z * cosG;
    const worldZ = placement.y * sinT + rotatedZ * cosT;

    cards.push( {
      asset,
      texture,
      placement,
      phase,
      worldZ,
      rotZ: eased * motion.cardSpin * p.TAU
    } );
  }

  if ( cards.length === 0 ) {
    drawTitle();
    return;
  }

  cards.sort( (
    a, b
  ) => a.worldZ - b.worldZ );

  const zMin = cards[ 0 ].worldZ;
  const zMax = cards[ cards.length - 1 ].worldZ;
  const fadeDepth = clamp(
    style.fadeDepth ?? 0,
    0,
    1
  );

  /* -- render ----------------------------------------------------- */

  applyPerspective(
    p,
    layout
  );

  p.push();
  p.translate(
    0,
    0,
    layout.zoom
  );
  p.rotateX( tiltRad );
  p.rotateY( globalAngle );

  for ( const card of cards ) {
    let alpha = 255;

    if ( style.fadeEdges ) {
      alpha *= Math.min(
        smoothstep(
          0,
          0.12,
          card.phase
        ),
        smoothstep(
          0,
          0.12,
          1 - card.phase
        )
      );
    }

    if ( fadeDepth > 0 && zMax > zMin ) {
      const nearness = ( card.worldZ - zMin ) / ( zMax - zMin );

      alpha *= 1 - fadeDepth * ( 1 - nearness );
    }

    p.push();
    p.translate(
      card.placement.x,
      card.placement.y,
      card.placement.z
    );
    p.rotateY( card.placement.rotY );

    if ( card.rotZ ) {
      p.rotateZ( card.rotZ );
    }

    p.noStroke();
    p.tint(
      255,
      255,
      255,
      alpha
    );
    p.texture( card.texture );
    p.rect(
      -cardWidth / 2,
      -cardHeight / 2,
      cardWidth,
      cardHeight
    );
    p.pop();
  }

  p.pop();
  p.noTint();

  /* -- overlays (screen space) ------------------------------------ */

  // The front-most card (nearest the camera) drives the EXIF read-out.
  drawInfo(
    cards[ cards.length - 1 ].asset,
    getInfo()
  );
  drawTitle();
} );
