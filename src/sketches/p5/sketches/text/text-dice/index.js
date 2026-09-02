import options from "@/p5/utils/options.js";
import easing from "@/p5/utils/easing.js";
import sketch from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import string from "@/p5/utils/string.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

const FACE_COUNT = 6;
const HALF_PI = Math.PI / 2;

// Each cube face is a square texture baked with createGraphics (solid
// background + a single centered word) and then drawn onto one side of a
// rotating box. Textures are cached by a signature of every property that
// affects how they look, so we only repaint when something actually changes.
const state = sketch.state( () => ( {
  dice: null,
  rollOrder: null,
  rollSeed: null
} ) );

const textureCache = new Map();

/* ------------------------------------------------------------------ */
/*  Quaternion helpers                                                */
/*                                                                    */
/*  The cube tumbles between fixed "this face is front" orientations. */
/*  Interpolating those as raw Euler angles (component-wise lerp)     */
/*  follows a tilted, wobbly path between any two faces that don't    */
/*  share an axis — that is the "drifting like orbit control" look.   */
/*  Slerping unit quaternions instead always takes the shortest       */
/*  single-axis arc, so every transition is a clean, predictable roll.*/
/* ------------------------------------------------------------------ */

function quatMultiply(
  a, b
) {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w
  };
}

// Build a quaternion from intrinsic X→Y→Z rotations, matching the order p5
// applies rotateX(); rotateY(); rotateZ();, so a face's resting orientation is
// identical whether it is reached by slerp or by the raw rotate calls.
function quatFromEuler(
  x, y, z
) {
  const qx = {
    w: Math.cos( x / 2 ),
    x: Math.sin( x / 2 ),
    y: 0,
    z: 0
  };
  const qy = {
    w: Math.cos( y / 2 ),
    x: 0,
    y: Math.sin( y / 2 ),
    z: 0
  };
  const qz = {
    w: Math.cos( z / 2 ),
    x: 0,
    y: 0,
    z: Math.sin( z / 2 )
  };

  return quatMultiply(
    quatMultiply(
      qx,
      qy
    ),
    qz
  );
}

function quatNormalize( q ) {
  const length = Math.hypot(
    q.w,
    q.x,
    q.y,
    q.z
  ) || 1;

  return {
    w: q.w / length,
    x: q.x / length,
    y: q.y / length,
    z: q.z / length
  };
}

function quatSlerp(
  a, b, t
) {
  let dot = a.w * b.w + a.x * b.x + a.y * b.y + a.z * b.z;
  let target = b;

  // Always travel the short way around (q and -q are the same orientation).
  if ( dot < 0 ) {
    target = {
      w: -b.w,
      x: -b.x,
      y: -b.y,
      z: -b.z
    };
    dot = -dot;
  }

  // Endpoints almost coincide: fall back to normalized linear interpolation to
  // avoid dividing by a vanishing sin(theta).
  if ( dot > 0.9995 ) {
    return quatNormalize( {
      w: a.w + ( target.w - a.w ) * t,
      x: a.x + ( target.x - a.x ) * t,
      y: a.y + ( target.y - a.y ) * t,
      z: a.z + ( target.z - a.z ) * t
    } );
  }

  const theta0 = Math.acos( dot );
  const theta = theta0 * t;
  const sinTheta0 = Math.sin( theta0 );
  const s1 = Math.sin( theta ) / sinTheta0;
  const s0 = Math.cos( theta ) - dot * s1;

  return {
    w: a.w * s0 + target.w * s1,
    x: a.x * s0 + target.x * s1,
    y: a.y * s0 + target.y * s1,
    z: a.z * s0 + target.z * s1
  };
}

// Conjugate of a unit quaternion is its inverse (the opposite rotation).
function quatConjugate( q ) {
  return {
    w: q.w,
    x: -q.x,
    y: -q.y,
    z: -q.z
  };
}

// Convert to the (angle, axis) pair p5's rotate( angle, axis ) expects.
function quatToAxisAngle( q ) {
  const n = quatNormalize( q );
  const w = Math.min(
    1,
    Math.max(
      -1,
      n.w
    )
  );
  const sinHalf = Math.sqrt( 1 - w * w );

  if ( sinHalf < 1e-6 ) {
    return {
      angle: 0,
      axis: [
        1,
        0,
        0
      ]
    };
  }

  return {
    angle: 2 * Math.acos( w ),
    axis: [
      n.x / sinHalf,
      n.y / sinHalf,
      n.z / sinHalf
    ]
  };
}

/* ------------------------------------------------------------------ */
/*  Cube geometry                                                     */
/* ------------------------------------------------------------------ */

// Rotation that lays face i flat against its side of the cube.
const FACE_PLACEMENT_EULERS = [
  [
    0,
    0,
    0
  ],
  [
    0,
    HALF_PI,
    0
  ],
  [
    HALF_PI,
    0,
    0
  ],
  [
    0,
    -HALF_PI,
    0
  ],
  [
    0,
    Math.PI,
    0
  ],
  [
    -HALF_PI,
    0,
    0
  ]
];

// Inverse of each placement: the cube rotation that brings face i to the front,
// squarely facing the camera, so the resting label is upright and unmirrored.
const FACE_TARGET_QUATS = FACE_PLACEMENT_EULERS.map( ( [
  x,
  y,
  z
] ) => quatConjugate( quatFromEuler(
  x,
  y,
  z
) ) );

// Deterministic Fisher-Yates so "roll mode" produces a repeatable face order
// for a given seed (lets the same composition be reproduced frame-for-frame).
function seededShuffle(
  length, seed
) {
  let s = seed >>> 0;

  const next = () => {
    s = ( s * 1664525 + 1013904223 ) >>> 0;

    return s / 0x100000000;
  };

  const order = Array.from(
    {
      length
    },
    (
      _, index
    ) => index
  );

  for ( let i = order.length - 1; i > 0; i-- ) {
    const j = Math.floor( next() * ( i + 1 ) );

    [
      order[ i ],
      order[ j ]
    ] = [
      order[ j ],
      order[ i ]
    ];
  }

  return order;
}

/* ------------------------------------------------------------------ */
/*  Face textures                                                     */
/* ------------------------------------------------------------------ */

function resolveFontEntry( face ) {
  const fontKey = face.font || "martian";

  return string.fonts[ fontKey ] || string.fonts.martian;
}

// Largest text size (starting from baseSize) that still fits inside the
// available square once auto-fit is on. The bounds come straight from the
// font metrics, so this is independent of the renderer's current state.
function fitTextSize(
  fontEntry, text, baseSize, maxSize
) {
  const bounds = fontEntry.textBounds(
    text,
    0,
    0,
    baseSize
  );
  const widthRatio = bounds.w > 0 ? maxSize / bounds.w : 1;
  const heightRatio = bounds.h > 0 ? maxSize / bounds.h : 1;
  const ratio = Math.min(
    widthRatio,
    heightRatio,
    1
  );

  return Math.max(
    8,
    baseSize * ratio
  );
}

function buildFaceTexture(
  face, size, settings, fontEntry
) {
  const p = getP5();
  const g = p.createGraphics(
    size,
    size
  );

  g.background( ...( face.background ?? [
    0,
    0,
    0
  ] ) );

  const text = face.text ?? "";

  if ( !fontEntry?.font || !text ) {
    return g;
  }

  const inset = size * settings.textPadding;
  const available = size - inset * 2;
  const baseSize = settings.baseTextSize * ( face.sizeFactor ?? 1 );
  const textSize = settings.autoFitText
    ? fitTextSize(
      fontEntry,
      text,
      baseSize,
      available
    )
    : baseSize;

  const jitterRad = p.radians( face.jitter ?? 0 );
  const outlineOnly = face.outlineOnly ?? false;

  g.push();
  g.translate(
    size / 2,
    size / 2
  );

  if ( jitterRad !== 0 ) {
    g.rotate( jitterRad );
  }

  // No textWidth/textHeight: with a box, p5 anchors the text to the box's
  // top-left corner, which is what pushed every face label into the
  // bottom-right quadrant. A point + CENTER/CENTER align keeps it dead centre.
  string.write(
    text,
    0,
    0,
    {
      size: textSize,
      font: fontEntry,
      fill: outlineOnly
        ? g.color(
          0,
          0,
          0,
          0
        )
        : g.color( ...( face.fill ?? [
          255,
          255,
          255
        ] ) ),
      stroke: g.color( ...( face.stroke ?? [
        0,
        0,
        0
      ] ) ),
      strokeWeight: face.strokeWeight ?? 0,
      textAlign: [
        p.CENTER,
        p.CENTER
      ],
      textWidth: -1,
      textHeight: -1,
      graphics: g,
      popPush: true
    }
  );

  g.pop();

  return g;
}

// fontReady is part of the signature on purpose: fonts load asynchronously, so
// the first frames bake a textless face. Including readiness gives that a
// distinct key, so the moment the font resolves we build a fresh, lettered
// texture instead of being stuck with the cached blank until a param changes.
function faceSignature(
  face, size, settings, fontReady
) {
  return [
    size,
    settings.baseTextSize,
    settings.autoFitText,
    settings.textPadding,
    fontReady,
    face.text,
    face.font,
    face.sizeFactor,
    face.strokeWeight,
    face.outlineOnly,
    face.jitter,
    ( face.fill ?? [] ).join( "," ),
    ( face.stroke ?? [] ).join( "," ),
    ( face.background ?? [] ).join( "," )
  ].join( "|" );
}

// Free a face/buffer graphic. p5's Graphics.remove() throws if its parent
// instance was already torn down (stale _pInst._elements), so guard it and
// fall back to just detaching the canvas — either way our reference is dropped.
function disposeGraphics( graphics ) {
  if ( !graphics ) {
    return;
  }

  try {
    graphics.remove();
  } catch {
    graphics.canvas?.remove?.();
  }
}

// Bounded cache: editing options in the UI would otherwise leak a new
// p5.Graphics on every keystroke. Six live faces always survive because they
// are the most-recently inserted; only stale generations get freed.
function getFaceTexture(
  face, size, settings
) {
  const fontEntry = resolveFontEntry( face );
  const key = faceSignature(
    face,
    size,
    settings,
    !!fontEntry?.font
  );
  const cached = textureCache.get( key );

  if ( cached ) {
    return cached;
  }

  const texture = buildFaceTexture(
    face,
    size,
    settings,
    fontEntry
  );

  textureCache.set(
    key,
    texture
  );

  const limit = FACE_COUNT * 4;

  if ( textureCache.size > limit ) {
    for ( const staleKey of textureCache.keys() ) {
      if ( textureCache.size <= limit ) {
        break;
      }

      const stale = textureCache.get( staleKey );

      textureCache.delete( staleKey );
      disposeGraphics( stale );
    }
  }

  return texture;
}

/* ------------------------------------------------------------------ */
/*  Rotation + rendering                                              */
/* ------------------------------------------------------------------ */

function rollQuatSequence( settings ) {
  if ( !settings.rollMode ) {
    state.rollOrder = null;
    state.rollSeed = null;

    return FACE_TARGET_QUATS;
  }

  const seed = ( settings.rollSeed ?? 0 ) >>> 0;

  if ( !state.rollOrder || state.rollSeed !== seed ) {
    state.rollOrder = seededShuffle(
      FACE_COUNT,
      seed
    );
    state.rollSeed = seed;
  }

  return state.rollOrder.map( ( index ) => FACE_TARGET_QUATS[ index ] );
}

// Orientation of the whole cube for the current frame, as an (angle, axis).
// The face index is driven straight off the looping animation clock and stays
// in lockstep with it, so progression 1 lands exactly back on the start
// orientation — the loop is seamless and never snaps.
function diceOrientation( settings ) {
  const sequence = rollQuatSequence( settings );
  const steps = sequence.length;
  const spins = Math.max(
    0,
    Math.round( settings.spinsPerLoop )
  );

  if ( spins === 0 || steps <= 1 ) {
    return quatToAxisAngle( sequence[ 0 ] );
  }

  const easeFn = easing?.[ settings.easing ] || easing.easeInOutExpo;
  const cyclePosition = animation.progression * steps * spins;
  const index = Math.floor( cyclePosition );
  const blend = easeFn( cyclePosition - index );
  const from = sequence[ ( ( index % steps ) + steps ) % steps ];
  const to = sequence[ ( ( ( index + 1 ) % steps ) + steps ) % steps ];

  return quatToAxisAngle( quatSlerp(
    from,
    to,
    blend
  ) );
}

function renderDiceFaces(
  g, size, render
) {
  for ( let i = 0; i < FACE_PLACEMENT_EULERS.length; i++ ) {
    const [
      rX,
      rY,
      rZ
    ] = FACE_PLACEMENT_EULERS[ i ];

    g.push();
    g.rotateX( rX );
    g.rotateY( rY );
    g.rotateZ( rZ );
    g.translate(
      0,
      0,
      size / 2
    );

    render(
      i,
      size
    );

    g.pop();
  }
}

// Recreate the offscreen WEBGL buffer when the canvas size changes — or when it
// belongs to a previous p5 instance (a re-mount/HMR), since drawing with or
// removing a torn-down instance's graphic is what triggers the _elements crash.
function ensureDiceGraphics( p ) {
  const sameInstance = state.dice?._pInst === p;

  if (
    !state.dice ||
    !sameInstance ||
    state.dice.width !== p.width ||
    state.dice.height !== p.height
  ) {
    if ( sameInstance ) {
      disposeGraphics( state.dice );
    }

    state.dice = p.createGraphics(
      p.width,
      p.height,
      p.WEBGL
    );
  }

  return state.dice;
}

// Drop every graphic cached from a previous mount. The textures and buffer are
// module-level and outlive a single p5 instance, so a fresh setup must forget
// them rather than reuse/remove() graphics whose instance is already gone.
function resetGraphicsState() {
  textureCache.clear();
  state.dice = null;
  state.rollOrder = null;
  state.rollSeed = null;
}

function readSettings( sketchOptions ) {
  return {
    faces: sketchOptions?.faces ?? [],
    backgroundColor: sketchOptions?.backgroundColor ?? [
      0,
      0,
      0
    ],
    diceSizeFactor: sketchOptions?.diceSizeFactor ?? 1.5,
    faceScale: sketchOptions?.faceScale ?? 1,
    baseTextSize: sketchOptions?.baseTextSize ?? 280,
    autoFitText: sketchOptions?.autoFitText ?? true,
    textPadding: sketchOptions?.textPadding ?? 0.12,
    spinsPerLoop: sketchOptions?.spinsPerLoop ?? 1,
    easing: sketchOptions?.easing ?? "easeInOutExpo",
    rollMode: sketchOptions?.rollMode ?? false,
    rollSeed: sketchOptions?.rollSeed ?? 0
  };
}

sketch.setup( () => {
  const p = getP5();

  resetGraphicsState();
  ensureDiceGraphics( p );
  p.background( ...readSettings( options.sketch ).backgroundColor );
} );

sketch.draw( () => {
  const p = getP5();
  const settings = readSettings( options.sketch );

  p.clear();
  p.background( ...settings.backgroundColor );

  if ( settings.faces.length === 0 ) {
    return;
  }

  const g = ensureDiceGraphics( p );
  const faceSize = p.width / settings.diceSizeFactor;
  const textureSize = Math.round( Math.min(
    1024,
    Math.max(
      256,
      faceSize
    )
  ) );

  const {
    angle, axis
  } = diceOrientation( settings );

  g.push();
  g.background( ...settings.backgroundColor );
  g.rotate(
    angle,
    p.createVector(
      axis[ 0 ],
      axis[ 1 ],
      axis[ 2 ]
    )
  );

  renderDiceFaces(
    g,
    faceSize,
    (
      index, size
    ) => {
      const face = settings.faces[ index % settings.faces.length ];

      if ( !face ) {
        return;
      }

      const texture = getFaceTexture(
        face,
        textureSize,
        settings
      );
      const drawSize = size * settings.faceScale;

      g.image(
        texture,
        -drawSize / 2,
        -drawSize / 2,
        drawSize,
        drawSize
      );
    }
  );

  g.pop();

  p.image(
    g,
    0,
    0
  );
} );
