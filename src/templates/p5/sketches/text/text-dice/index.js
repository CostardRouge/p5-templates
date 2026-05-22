import options from "@/p5/utils/options.js";
import easing from "@/p5/utils/easing.js";
import sketch from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import imageUtils from "@/p5/utils/imageUtils.js";
import string from "@/p5/utils/string.js";
import cache from "@/p5/utils/cache.js";
import renderTitle from "@/p5/utils/title/renderTitle";
import {
  getP5
} from "@/p5/utils/sketch.js";

const FACE_COUNT = 6;

const state = {
  dice: null,
  faceTextureSize: 0,
  rollOrder: null,
  rollSeed: -1
};

function seededShuffle(
  length, seed
) {
  let s = seed >>> 0;
  const next = () => {
    s = ( s * 1664525 + 1013904223 ) >>> 0;
    return s / 0x100000000;
  };
  const arr = Array.from(
    {
      length
    },
    (
      _, i
    ) => i
  );

  for ( let i = arr.length - 1; i > 0; i-- ) {
    const j = Math.floor( next() * ( i + 1 ) );

    [
      arr[ i ],
      arr[ j ]
    ] = [
      arr[ j ],
      arr[ i ]
    ];
  }

  return arr;
}

function buildFaceTexture(
  face, size
) {
  const p = getP5();
  const fontKey = face.font || "martian";
  const fontEntry = string.fonts[ fontKey ] || string.fonts.martian;

  const g = p.createGraphics(
    size,
    size
  );

  g.background( ...face.background );

  if ( !fontEntry?.font ) {
    return g;
  }

  const padding = size * 0.08;
  const maxWidth = size - padding * 2;
  const maxHeight = size - padding * 2;
  const baseSize = ( options.sketch?.baseTextSize ?? 220 ) * ( face.sizeFactor ?? 1 );
  const autoFit = options.sketch?.autoFitText ?? true;

  let textSize = baseSize;

  if ( autoFit ) {
    const probeOptions = {
      size: baseSize,
      font: fontEntry,
      strokeWeight: face.strokeWeight ?? 0,
      textAlign: [
        p.CENTER,
        p.CENTER
      ],
      textWrap: p.WORD
    };

    string.applyFontStyle( {
      graphics: g,
      ...probeOptions
    } );

    const bounds = fontEntry.textBounds(
      face.text || "",
      0,
      0,
      baseSize
    );
    const wRatio = bounds.w > 0 ? maxWidth / bounds.w : 1;
    const hRatio = bounds.h > 0 ? maxHeight / bounds.h : 1;
    const ratio = Math.min(
      wRatio,
      hRatio,
      1
    );

    textSize = Math.max(
      8,
      baseSize * ratio
    );
  }

  const jitterRad = ( ( face.jitter ?? 0 ) * Math.PI ) / 180;

  g.push();
  g.translate(
    size / 2,
    size / 2
  );

  if ( jitterRad !== 0 ) {
    g.rotate( jitterRad );
  }

  const outlineOnly = face.outlineOnly ?? false;

  string.write(
    face.text || "",
    0,
    0,
    {
      size: textSize,
      font: fontEntry,
      fill: outlineOnly ? g.color(
        0,
        0,
        0,
        0
      ) : g.color( ...face.fill ),
      stroke: g.color( ...face.stroke ),
      strokeWeight: face.strokeWeight ?? 0,
      textAlign: [
        p.CENTER,
        p.CENTER
      ],
      textWidth: maxWidth,
      textHeight: maxHeight,
      graphics: g,
      popPush: true
    }
  );

  g.pop();

  return g;
}

function getFaceTexture(
  face, size
) {
  const key = cache.key(
    "text-dice-face",
    size,
    face.text,
    face.font,
    face.sizeFactor,
    face.strokeWeight,
    face.outlineOnly,
    face.jitter,
    ( face.fill || [] ).join( "," ),
    ( face.stroke || [] ).join( "," ),
    ( face.background || [] ).join( "," ),
    options.sketch?.baseTextSize ?? 220,
    options.sketch?.autoFitText ?? true
  );

  return cache.store(
    key,
    () => buildFaceTexture(
      face,
      size
    )
  );
}

function diceFaces(
  size, render
) {
  const p = getP5();
  const g = state.dice;

  const rotations = [
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

  for ( let i = 0; i < rotations.length; i++ ) {
    const {
      x: rX, y: rY, z: rZ
    } = rotations[ i ];

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

sketch.setup( () => {
  const p = getP5();

  state.dice = p.createGraphics(
    p.width,
    p.height,
    p.WEBGL
  );

  p.background( ...options.sketch.backgroundColor );
} );

sketch.draw( () => {
  const p = getP5();

  p.clear();
  p.background( ...options.sketch.backgroundColor );

  const faces = options.sketch?.faces ?? [];

  if ( faces.length === 0 ) {
    return;
  }

  const rotateSpeed = options.sketch?.rotateSpeed ?? 1;
  const easeFn = easing?.[ options.sketch?.easing ] || easing.easeInOutExpo;
  const rollMode = options.sketch?.rollMode ?? false;
  const diceSizeFactor = options.sketch?.diceSizeFactor ?? 1.5;
  const faceScale = options.sketch?.faceScale ?? 0.85;

  const g = state.dice;

  const targetRotations = [
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

  let sequence = targetRotations;

  if ( rollMode ) {
    if ( !state.rollOrder ) {
      state.rollOrder = seededShuffle(
        FACE_COUNT,
        0xc0ffee
      );
    }
    sequence = state.rollOrder.map( ( i ) => targetRotations[ i ] );
  } else {
    state.rollOrder = null;
  }

  const {
    x: rX, y: rY, z: rZ
  } = animation.ease( {
    values: sequence,
    currentTime: animation.progression * FACE_COUNT * rotateSpeed,
    lerpFn: mappers.lerpVector,
    easingFn: easeFn
  } );

  const textureSize = Math.max(
    256,
    Math.round( p.width / diceSizeFactor )
  );

  state.faceTextureSize = textureSize;

  g.push();
  g.background( ...options.sketch.backgroundColor );

  g.rotateX( rX );
  g.rotateY( rY );
  g.rotateZ( rZ );

  diceFaces(
    p.width / diceSizeFactor,
    (
      index, size
    ) => {
      const face = faces[ index % faces.length ];

      if ( !face ) {
        return;
      }

      const texture = getFaceTexture(
        face,
        textureSize
      );

      if ( !texture ) {
        return;
      }

      imageUtils.marginImage( {
        position: p.createVector(
          0,
          0
        ),
        img: texture,
        scale: faceScale,
        center: true,
        graphics: g
      } );
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
