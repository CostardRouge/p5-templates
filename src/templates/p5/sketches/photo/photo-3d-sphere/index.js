import options from "@/p5/utils/options.js";
import cache from "@/p5/utils/cache.js";
import easing from "@/p5/utils/easing.js";
import sketch from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import imageUtils from "@/p5/utils/imageUtils.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

/* ------------------------------------------------------------------ */
/*  Photo sphere carousel                                             */
/*                                                                    */
/*  An invisible sphere carries one photo on each of its faces.       */
/*  The whole sphere rotates so that every photo, in turn, comes to   */
/*  face the camera — upright and centred — then dwells before the    */
/*  tour glides on to the next one along the shortest arc.            */
/*                                                                    */
/*  When there are fewer photos than faces the empty slots are simply */
/*  ignored: they are neither drawn nor visited by the tour.          */
/* ------------------------------------------------------------------ */

const GOLDEN_ANGLE = Math.PI * ( 3 - Math.sqrt( 5 ) );

const Z_AXIS = {
  x: 0,
  y: 0,
  z: 1
};

const EPSILON = 1e-6;

/* ------------------------------------------------------------------ */
/*  Tiny framework-agnostic vector helpers (plain objects)            */
/* ------------------------------------------------------------------ */

const clamp = (
  value, low, high
) => Math.max(
  low,
  Math.min(
    high,
    value
  )
);

const vdot = (
  a, b
) => a.x * b.x + a.y * b.y + a.z * b.z;

const vlength = ( a ) => Math.hypot(
  a.x,
  a.y,
  a.z
);

const vcross = (
  a, b
) => ( {
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x
} );

const vnormalize = ( a ) => {
  const length = vlength( a ) || 1;

  return {
    x: a.x / length,
    y: a.y / length,
    z: a.z / length
  };
};

/**
 * Rotate a vector around a unit axis by an angle (Rodrigues' formula).
 * Used off-screen to know how far each face points toward the camera.
 */
function rotateAround(
  vector, axis, angle
) {
  const cos = Math.cos( angle );
  const sin = Math.sin( angle );
  const dot = vdot(
    axis,
    vector
  );
  const cross = vcross(
    axis,
    vector
  );

  return {
    x: vector.x * cos + cross.x * sin + axis.x * dot * ( 1 - cos ),
    y: vector.y * cos + cross.y * sin + axis.y * dot * ( 1 - cos ),
    z: vector.z * cos + cross.z * sin + axis.z * dot * ( 1 - cos )
  };
}

/**
 * Minimal (geodesic) rotation that takes unit vector `from` onto unit
 * vector `to`, expressed as an axis + angle ready for `p.rotate`.
 */
function axisAngleBetween(
  from, to
) {
  const dot = clamp(
    vdot(
      from,
      to
    ),
    -1,
    1
  );
  const angle = Math.acos( dot );
  const cross = vcross(
    from,
    to
  );
  const crossLength = vlength( cross );

  if ( crossLength < EPSILON ) {
    // Parallel (no-op) or anti-parallel (any perpendicular axis works).
    if ( dot > 0 ) {
      return {
        axis: {
          x: 1,
          y: 0,
          z: 0
        },
        angle: 0
      };
    }

    const reference = Math.abs( from.x ) < 0.9
      ? {
        x: 1,
        y: 0,
        z: 0
      }
      : {
        x: 0,
        y: 1,
        z: 0
      };

    return {
      axis: vnormalize( vcross(
        from,
        reference
      ) ),
      angle: Math.PI
    };
  }

  return {
    axis: {
      x: cross.x / crossLength,
      y: cross.y / crossLength,
      z: cross.z / crossLength
    },
    angle
  };
}

/**
 * Spherical-linear interpolation between two unit vectors — the camera
 * pans from one photo to the next along the great circle joining them.
 */
function slerp(
  a, b, t
) {
  const dot = clamp(
    vdot(
      a,
      b
    ),
    -1,
    1
  );
  const omega = Math.acos( dot );

  if ( omega < EPSILON ) {
    return {
      x: a.x,
      y: a.y,
      z: a.z
    };
  }

  const sin = Math.sin( omega );
  const wa = Math.sin( ( 1 - t ) * omega ) / sin;
  const wb = Math.sin( t * omega ) / sin;

  return vnormalize( {
    x: wa * a.x + wb * b.x,
    y: wa * a.y + wb * b.y,
    z: wa * a.z + wb * b.z
  } );
}

/* ------------------------------------------------------------------ */
/*  Face distributions on the unit sphere                             */
/* ------------------------------------------------------------------ */

function distribute(
  mode, count
) {
  const points = [];

  if ( count <= 0 ) {
    return points;
  }

  if ( mode === "ring" ) {
    for ( let i = 0; i < count; i++ ) {
      const angle = ( i / count ) * Math.PI * 2;

      points.push( {
        x: Math.cos( angle ),
        y: 0,
        z: Math.sin( angle )
      } );
    }

    return points;
  }

  if ( mode === "vertical-ring" ) {
    for ( let i = 0; i < count; i++ ) {
      const angle = ( i / count ) * Math.PI * 2;

      points.push( {
        x: 0,
        y: Math.sin( angle ),
        z: Math.cos( angle )
      } );
    }

    return points;
  }

  if ( mode === "spiral" ) {
    const turns = Math.max(
      1,
      Math.round( count / 4 )
    );

    for ( let i = 0; i < count; i++ ) {
      const fraction = ( i + 0.5 ) / count;
      const y = 1 - fraction * 2;
      const radius = Math.sqrt( Math.max(
        0,
        1 - y * y
      ) );
      const angle = fraction * Math.PI * 2 * turns;

      points.push( {
        x: Math.cos( angle ) * radius,
        y,
        z: Math.sin( angle ) * radius
      } );
    }

    return points;
  }

  // "sphere" — evenly spread via the Fibonacci / golden-spiral lattice.
  for ( let i = 0; i < count; i++ ) {
    const y = 1 - ( ( i + 0.5 ) / count ) * 2;
    const radius = Math.sqrt( Math.max(
      0,
      1 - y * y
    ) );
    const angle = i * GOLDEN_ANGLE;

    points.push( {
      x: Math.cos( angle ) * radius,
      y,
      z: Math.sin( angle ) * radius
    } );
  }

  return points;
}

/* ------------------------------------------------------------------ */
/*  Photo shape + texture baking (cover-crop, optional polaroid frame) */
/* ------------------------------------------------------------------ */

function shapeAspect( shape ) {
  const p = getP5();

  switch ( shape ) {
    case "square":
      return 1;
    case "landscape":
      return 4 / 3;
    case "portrait":
      return 3 / 4;
    default:
      return p.width / p.height;
  }
}

function textureResolution( aspect ) {
  const long = 512;

  if ( aspect >= 1 ) {
    return {
      width: long,
      height: Math.round( long / aspect )
    };
  }

  return {
    width: Math.round( long * aspect ),
    height: long
  };
}

function bakePhoto(
  img, aspect, frame
) {
  const p = getP5();
  const {
    width,
    height
  } = textureResolution( aspect );
  const graphics = p.createGraphics(
    width,
    height
  );

  graphics.pixelDensity( 1 );
  graphics.clear();

  const inset = frame.enabled
    ? Math.round( Math.min(
      width,
      height
    ) * frame.thickness )
    : 0;

  if ( frame.enabled ) {
    graphics.noStroke();
    graphics.fill( ...frame.color );
    graphics.rect(
      0,
      0,
      width,
      height
    );
  }

  const innerWidth = width - 2 * inset;
  const innerHeight = height - 2 * inset;
  const scale = Math.max(
    innerWidth / img.width,
    innerHeight / img.height
  );
  const drawWidth = img.width * scale;
  const drawHeight = img.height * scale;
  const context = graphics.drawingContext;

  context.save();
  context.beginPath();
  context.rect(
    inset,
    inset,
    innerWidth,
    innerHeight
  );
  context.clip();
  graphics.image(
    img,
    inset + ( innerWidth - drawWidth ) / 2,
    inset + ( innerHeight - drawHeight ) / 2,
    drawWidth,
    drawHeight
  );
  context.restore();

  return graphics;
}

/**
 * Cover-cropped, cached texture for one photo. Returns null while the
 * underlying image is still loading so the slot is skipped for now.
 */
function getPhotoTexture(
  asset, aspect, frame
) {
  const img = asset?.img;

  if ( !img || !img.width ) {
    return null;
  }

  const key = `photo-sphere-tex|${ asset.path }|${ aspect.toFixed( 4 ) }`
    + `|frame:${ frame.enabled ? 1 : 0 }-${ frame.color.join( "_" ) }-${ frame.thickness }`;
  const cached = cache.get( key );

  if ( cached ) {
    return cached;
  }

  return cache.set(
    key,
    bakePhoto(
      img,
      aspect,
      frame
    )
  );
}

/* ------------------------------------------------------------------ */
/*  Option readers                                                    */
/* ------------------------------------------------------------------ */

const getLayout = () => options.sketch?.layout ?? {};
const getMotion = () => options.sketch?.motion ?? {};
const getStyle = () => options.sketch?.style ?? {};

const getBackground = () => getStyle().backgroundColor ?? [
  8,
  8,
  12
];

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

/* ------------------------------------------------------------------ */
/*  Sketch                                                            */
/* ------------------------------------------------------------------ */

sketch.setup(
  undefined,
  {
    type: "webgl"
  }
);

sketch.draw( (
  time, center, favoriteColor
) => {
  const p = getP5();
  const layout = getLayout();
  const motion = getMotion();
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
  const requested = Math.round( layout.faceCount ?? 0 );
  const slotCount = requested > 0 ? requested : images.length;

  if ( slotCount <= 0 || images.length <= 0 ) {
    drawTitle();
    return;
  }

  const positions = distribute(
    layout.distribution ?? "sphere",
    slotCount
  );

  // Only the first `filledCount` slots hold a photo; the rest stay empty
  // and are skipped both visually and by the tour.
  const filledCount = Math.min(
    slotCount,
    images.length
  );

  const aspect = shapeAspect( layout.photoShape ?? "auto" );
  const frame = {
    enabled: Boolean( style.photoFrame ),
    color: style.frameColor ?? [
      255,
      255,
      255
    ],
    thickness: clamp(
      style.frameThickness ?? 0.06,
      0,
      0.45
    )
  };

  const radius = layout.sphereRadius ?? 600;
  const photoSize = layout.photoSize ?? 0.82;
  const faceLong = radius * photoSize;
  const faceWidth = aspect >= 1 ? faceLong : faceLong * aspect;
  const faceHeight = aspect >= 1 ? faceLong / aspect : faceLong;
  const zoom = layout.zoom ?? -1200;

  /* -- where is the tour right now? ------------------------------- */

  const stops = filledCount;
  const speed = clamp(
    motion.tourSpeed ?? 1,
    0.05,
    8
  );
  const hold = clamp(
    motion.holdRatio ?? 0.45,
    0,
    0.95
  );
  const easingFn = easing[ motion.easing ] || easing.easeInOutCubic;

  const travelled = ( ( animation.progression * speed ) % 1 ) * stops;
  const step = Math.floor( travelled ) % stops;
  const local = travelled - Math.floor( travelled );
  const phase = local < hold ? 0 : easingFn( ( local - hold ) / ( 1 - hold ) );

  const frontFrom = positions[ step ];
  const frontTo = positions[ ( step + 1 ) % stops ];
  const front = stops > 1
    ? slerp(
      frontFrom,
      frontTo,
      phase
    )
    : frontFrom;

  // Global rotation that brings the current front direction to the camera.
  const globalRotation = axisAngleBetween(
    front,
    Z_AXIS
  );

  /* -- collect the drawable faces -------------------------------- */

  const focusDim = clamp(
    style.focusDim ?? 0.55,
    0,
    1
  );
  const hideBackFaces = style.hideBackFaces ?? true;

  const faces = [];

  for ( let i = 0; i < filledCount; i++ ) {
    const texture = getPhotoTexture(
      images[ i ],
      aspect,
      frame
    );

    if ( !texture ) {
      continue;
    }

    const position = positions[ i ];
    // How squarely this face points at the camera (1 front, -1 behind).
    const facing = rotateAround(
      position,
      globalRotation.axis,
      globalRotation.angle
    ).z;

    if ( hideBackFaces && facing < -0.15 ) {
      continue;
    }

    const brightness = 1 - focusDim * ( 1 - clamp(
      facing,
      0,
      1
    ) );

    faces.push( {
      position,
      texture,
      facing,
      alpha: 255 * brightness
    } );
  }

  if ( faces.length === 0 ) {
    drawTitle();
    return;
  }

  // Back-to-front so the focused photo lands on top and alpha blends cleanly.
  faces.sort( (
    a, b
  ) => a.facing - b.facing );

  /* -- render ----------------------------------------------------- */

  // p5's default camera sits at z = 800 with near/far clip planes of
  // 80 / 8000. A large radius or a strong zoom pushes the back faces past
  // the far plane (they wink out mid-rotation) or the near faces behind the
  // eye, so fit the frustum snugly around the sphere instead. The near plane
  // is kept in front of the title plane (z = 0, i.e. distance = eye) so the
  // overlay never gets clipped.
  const eyeZ = 800;
  const fov = 2 * Math.atan( ( p.height / 2 ) / eyeZ );
  const centerDistance = eyeZ - zoom;
  const bound = radius + 0.5 * Math.hypot(
    faceWidth,
    faceHeight
  );
  const near = Math.max(
    1,
    Math.min(
      centerDistance - bound,
      eyeZ
    ) - 50
  );
  const far = centerDistance + bound + 50;

  p.perspective(
    fov,
    p.width / p.height,
    near,
    far
  );

  p.push();
  p.translate(
    0,
    0,
    zoom
  );

  if ( globalRotation.angle > EPSILON ) {
    p.rotate(
      globalRotation.angle,
      p.createVector(
        globalRotation.axis.x,
        globalRotation.axis.y,
        globalRotation.axis.z
      )
    );
  }

  faces.forEach( ( face ) => {
    const placement = axisAngleBetween(
      Z_AXIS,
      face.position
    );

    p.push();

    if ( placement.angle > EPSILON ) {
      p.rotate(
        placement.angle,
        p.createVector(
          placement.axis.x,
          placement.axis.y,
          placement.axis.z
        )
      );
    }

    p.translate(
      0,
      0,
      radius
    );
    p.noStroke();
    p.tint(
      255,
      255,
      255,
      face.alpha
    );
    p.texture( face.texture );
    p.rect(
      -faceWidth / 2,
      -faceHeight / 2,
      faceWidth,
      faceHeight
    );

    p.pop();
  } );

  p.pop();
  p.noTint();

  drawTitle();
} );
