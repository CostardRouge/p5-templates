import options from "@/p5/utils/options.js";
import easing from "@/p5/utils/easing.js";
import sketch from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import string from "@/p5/utils/string.js";
import renderTitle from "@/p5/utils/title/renderTitle";
import {
  getP5
} from "@/p5/utils/sketch.js";

const FACE_COUNT = 6;

// Each cube face is a square texture baked with createGraphics (solid
// background + a single centered word) and then drawn onto one side of a
// rotating box. Textures are cached by a signature of every property that
// affects how they look, so we only repaint when something actually changes.
const state = {
  dice: null,
  rollOrder: null,
  rollSeed: null
};

const textureCache = new Map();

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
  face, size, settings
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

  const fontEntry = resolveFontEntry( face );
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

function faceSignature(
  face, size, settings
) {
  return [
    size,
    settings.baseTextSize,
    settings.autoFitText,
    settings.textPadding,
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

// Bounded cache: editing options in the UI would otherwise leak a new
// p5.Graphics on every keystroke. Six live faces always survive because they
// are the most-recently inserted; only stale generations get freed.
function getFaceTexture(
  face, size, settings
) {
  const key = faceSignature(
    face,
    size,
    settings
  );
  const cached = textureCache.get( key );

  if ( cached ) {
    return cached;
  }

  const texture = buildFaceTexture(
    face,
    size,
    settings
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

      stale?.remove?.();
      textureCache.delete( staleKey );
    }
  }

  return texture;
}

// Orientation that places face i onto its side of the cube.
function faceOrientations(
  g, p
) {
  return [
    g.createVector(),
    g.createVector(
      0,
      p.HALF_PI
    ),
    g.createVector( p.HALF_PI ),
    g.createVector(
      0,
      -p.HALF_PI
    ),
    g.createVector(
      0,
      p.PI
    ),
    g.createVector( -p.HALF_PI )
  ];
}

// Inverse of the orientation above: the cube rotation that brings face i to
// the front, squarely facing the camera (so the resting label is never mirrored).
function faceTargets(
  g, p
) {
  return [
    g.createVector(),
    g.createVector(
      0,
      -p.HALF_PI
    ),
    g.createVector( -p.HALF_PI ),
    g.createVector(
      0,
      p.HALF_PI
    ),
    g.createVector(
      0,
      p.PI
    ),
    g.createVector( p.HALF_PI )
  ];
}

function renderDiceFaces(
  g, p, size, render
) {
  const orientations = faceOrientations(
    g,
    p
  );

  for ( let i = 0; i < orientations.length; i++ ) {
    const {
      x: rX, y: rY, z: rZ
    } = orientations[ i ];

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

function rollSequence(
  g, p, settings
) {
  const targets = faceTargets(
    g,
    p
  );

  if ( !settings.rollMode ) {
    state.rollOrder = null;
    state.rollSeed = null;

    return targets;
  }

  const seed = ( settings.rollSeed ?? 0 ) >>> 0;

  if ( !state.rollOrder || state.rollSeed !== seed ) {
    state.rollOrder = seededShuffle(
      FACE_COUNT,
      seed
    );
    state.rollSeed = seed;
  }

  return state.rollOrder.map( ( index ) => targets[ index ] );
}

// Recreate the offscreen WEBGL buffer only when the canvas size changes, so a
// resize doesn't leave us drawing into a stale, wrongly-sized graphic.
function ensureDiceGraphics( p ) {
  if (
    !state.dice ||
    state.dice.width !== p.width ||
    state.dice.height !== p.height
  ) {
    state.dice?.remove?.();
    state.dice = p.createGraphics(
      p.width,
      p.height,
      p.WEBGL
    );
  }

  return state.dice;
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
    rotateSpeed: sketchOptions?.rotateSpeed ?? 1,
    easing: sketchOptions?.easing ?? "easeInOutExpo",
    rollMode: sketchOptions?.rollMode ?? false,
    rollSeed: sketchOptions?.rollSeed ?? 0
  };
}

sketch.setup( () => {
  const p = getP5();

  ensureDiceGraphics( p );
  p.background( ...readSettings( options.sketch ).backgroundColor );
} );

sketch.draw( () => {
  const p = getP5();
  const settings = readSettings( options.sketch );

  p.clear();
  p.background( ...settings.backgroundColor );

  if ( settings.faces.length === 0 ) {
    renderTitle();

    return;
  }

  const g = ensureDiceGraphics( p );
  const easeFn = easing?.[ settings.easing ] || easing.easeInOutExpo;
  const sequence = rollSequence(
    g,
    p,
    settings
  );

  const {
    x: rX, y: rY, z: rZ
  } = animation.ease( {
    values: sequence,
    currentTime: animation.progression * FACE_COUNT * settings.rotateSpeed,
    lerpFn: mappers.lerpVector,
    easingFn: easeFn
  } );

  const faceSize = p.width / settings.diceSizeFactor;
  const textureSize = Math.round( Math.min(
    1024,
    Math.max(
      256,
      faceSize
    )
  ) );

  g.push();
  g.background( ...settings.backgroundColor );
  g.rotateX( rX );
  g.rotateY( rY );
  g.rotateZ( rZ );

  renderDiceFaces(
    g,
    p,
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

  renderTitle();
} );
