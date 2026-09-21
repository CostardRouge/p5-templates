// ─────────────────────────────────────────────────────────────────────────────
// Silhouettes: what the camera sees, as a SURFACE on the sheet.
//
// MediaPipe hands back landmarks — 21 points for a hand, 468 for a face, 33 for
// a body — and a relief lifted at those points alone reads as a constellation,
// not as a hand. This module traces the contour instead: fingers and limbs
// become round capsules, the palm, the face and the torso become rounded
// polygons, and every node of the sheet reads its SIGNED DISTANCE to the
// nearest primitive (negative inside). That distance is then shaped into a
// presence 0 → 1 with a feathered edge, a dome or a rim (`shapePresence`).
//
// The segmentation mask (DeepLab, the `segmenter` task) is the other route,
// for a whole body: `processMask` dilates and blurs the category mask once
// per result and `maskPresenceAt` samples it per node.
//
// Everything is in the sheet's world units (x in cells, z in world units, see
// _sheet.js); the caller converts landmarks into that space. No p5, so it is
// unit-testable with synthetic landmarks.
// ─────────────────────────────────────────────────────────────────────────────

export const CURSOR_SHAPES = [
  "disc",
  "hand",
  "oval"
];

// FaceLandmarker's face-oval contour, in order around the face.
export const FACE_OVAL = [
  10,
  338,
  297,
  332,
  284,
  251,
  389,
  356,
  454,
  323,
  361,
  288,
  397,
  365,
  379,
  378,
  400,
  377,
  152,
  148,
  176,
  149,
  150,
  136,
  172,
  58,
  132,
  93,
  234,
  127,
  162,
  21,
  54,
  103,
  67,
  109
];

// HandLandmarker joint chains, base → tip.
const HAND_FINGERS = [
  [
    1,
    2,
    3,
    4
  ],
  [
    5,
    6,
    7,
    8
  ],
  [
    9,
    10,
    11,
    12
  ],
  [
    13,
    14,
    15,
    16
  ],
  [
    17,
    18,
    19,
    20
  ]
];
const HAND_PALM = [
  0,
  1,
  5,
  9,
  13,
  17
];

// PoseLandmarker indices.
const POSE = {
  nose: 0,
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28
};
const POSE_LIMBS = [
  [
    POSE.leftShoulder,
    POSE.leftElbow
  ],
  [
    POSE.leftElbow,
    POSE.leftWrist
  ],
  [
    POSE.rightShoulder,
    POSE.rightElbow
  ],
  [
    POSE.rightElbow,
    POSE.rightWrist
  ],
  [
    POSE.leftHip,
    POSE.leftKnee
  ],
  [
    POSE.leftKnee,
    POSE.leftAnkle
  ],
  [
    POSE.rightHip,
    POSE.rightKnee
  ],
  [
    POSE.rightKnee,
    POSE.rightAnkle
  ]
];

const KIND_CAPSULE = 0;
const KIND_DISC = 1;
const KIND_ELLIPSE = 2;
const KIND_POLYGON = 3;

function clamp(
  value, min, max
) {
  return Math.min(
    max,
    Math.max(
      min,
      value
    )
  );
}

function smooth01( t ) {
  const u = clamp(
    t,
    0,
    1
  );

  return u * u * ( 3 - 2 * u );
}

// ── Primitives ───────────────────────────────────────────────────────────────

export function capsule(
  ax, az, bx, bz, r
) {
  return {
    kind: KIND_CAPSULE,
    ax,
    az,
    bx,
    bz,
    r,
    minX: Math.min(
      ax,
      bx
    ) - r,
    maxX: Math.max(
      ax,
      bx
    ) + r,
    minZ: Math.min(
      az,
      bz
    ) - r,
    maxZ: Math.max(
      az,
      bz
    ) + r
  };
}

export function disc(
  x, z, r
) {
  return {
    kind: KIND_DISC,
    x,
    z,
    r,
    minX: x - r,
    maxX: x + r,
    minZ: z - r,
    maxZ: z + r
  };
}

export function ellipse(
  x, z, rx, rz
) {
  return {
    kind: KIND_ELLIPSE,
    x,
    z,
    rx,
    rz,
    minX: x - rx,
    maxX: x + rx,
    minZ: z - rz,
    maxZ: z + rz
  };
}

/** `pts` is a flat [x0, z0, x1, z1, …] ring; `r` rounds the corners outward. */
export function polygon(
  pts, r = 0
) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for ( let i = 0; i < pts.length; i += 2 ) {
    minX = Math.min(
      minX,
      pts[ i ]
    );
    maxX = Math.max(
      maxX,
      pts[ i ]
    );
    minZ = Math.min(
      minZ,
      pts[ i + 1 ]
    );
    maxZ = Math.max(
      maxZ,
      pts[ i + 1 ]
    );
  }

  return {
    kind: KIND_POLYGON,
    pts,
    r,
    minX: minX - r,
    maxX: maxX + r,
    minZ: minZ - r,
    maxZ: maxZ + r
  };
}

function segmentDistance(
  px, pz, ax, az, bx, bz
) {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  const t = l2 > 0 ? clamp(
    ( ( px - ax ) * dx + ( pz - az ) * dz ) / l2,
    0,
    1
  ) : 0;

  return Math.hypot(
    ax + dx * t - px,
    az + dz * t - pz
  );
}

// Signed distance to a polygon: edge distance, negative inside (even-odd).
function polygonDistance(
  pts, px, pz
) {
  let inside = false;
  let best = Infinity;
  const n = pts.length / 2;

  for ( let i = 0, j = n - 1; i < n; j = i++ ) {
    const xi = pts[ i * 2 ];
    const zi = pts[ i * 2 + 1 ];
    const xj = pts[ j * 2 ];
    const zj = pts[ j * 2 + 1 ];

    if ( ( zi > pz ) !== ( zj > pz ) && px < ( xj - xi ) * ( pz - zi ) / ( zj - zi ) + xi ) {
      inside = !inside;
    }

    const d = segmentDistance(
      px,
      pz,
      xi,
      zi,
      xj,
      zj
    );

    if ( d < best ) {
      best = d;
    }
  }

  return inside ? -best : best;
}

/** Signed distance from (x, z) to one primitive, negative inside. */
export function primitiveDistance(
  prim, x, z
) {
  switch ( prim.kind ) {
    case KIND_CAPSULE:
      return segmentDistance(
        x,
        z,
        prim.ax,
        prim.az,
        prim.bx,
        prim.bz
      ) - prim.r;
    case KIND_DISC:
      return Math.hypot(
        x - prim.x,
        z - prim.z
      ) - prim.r;
    case KIND_ELLIPSE: {
      // Scaled-circle approximation: exact on the axes, a hair off elsewhere,
      // which a feathered edge never shows.
      const ex = ( x - prim.x ) / prim.rx;
      const ez = ( z - prim.z ) / prim.rz;

      return ( Math.hypot(
        ex,
        ez
      ) - 1 ) * Math.min(
        prim.rx,
        prim.rz
      );
    }
    case KIND_POLYGON:
      return polygonDistance(
        prim.pts,
        x,
        z
      ) - prim.r;
    default:
      return Infinity;
  }
}

// ── Entities ─────────────────────────────────────────────────────────────────
// One detected thing (a hand, a face, a body, the cursor): its primitives and
// its footprint on the sheet, which the lift order reads.

/**
 * @param {object[]} prims
 * @param {string} kind "hand" | "face" | "body" | "cursor" | "mask"
 */
export function makeEntity(
  prims, kind = "entity"
) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  prims.forEach( ( prim ) => {
    minX = Math.min(
      minX,
      prim.minX
    );
    maxX = Math.max(
      maxX,
      prim.maxX
    );
    minZ = Math.min(
      minZ,
      prim.minZ
    );
    maxZ = Math.max(
      maxZ,
      prim.maxZ
    );
  } );

  if ( !prims.length ) {
    minX = maxX = minZ = maxZ = 0;
  }

  return {
    kind,
    prims,
    cx: ( minX + maxX ) / 2,
    cz: ( minZ + maxZ ) / 2,
    radius: Math.max(
      Math.hypot(
        maxX - minX,
        maxZ - minZ
      ) / 2,
      1e-6
    ),
    minX,
    maxX,
    minZ,
    maxZ
  };
}

/**
 * Signed distance from (x, z) to the entity, or `Infinity` when the point is
 * more than `pad` outside its bounding box (the cheap reject that keeps a
 * 2 000-node sheet under a millisecond).
 */
export function entityDistance(
  entity, x, z, pad = 0
) {
  if (
    x < entity.minX - pad || x > entity.maxX + pad
    || z < entity.minZ - pad || z > entity.maxZ + pad
  ) {
    return Infinity;
  }

  let best = Infinity;
  const prims = entity.prims;

  for ( let i = 0; i < prims.length; i++ ) {
    const prim = prims[ i ];

    if (
      x < prim.minX - pad || x > prim.maxX + pad
      || z < prim.minZ - pad || z > prim.maxZ + pad
    ) {
      continue;
    }

    const d = primitiveDistance(
      prim,
      x,
      z
    );

    if ( d < best ) {
      best = d;
    }
  }

  return best;
}

/**
 * Signed distance → presence 0 → 1.
 *
 * @param {number} d signed distance, negative inside
 * @param {object} cfg
 * @param {number} cfg.feather  edge width outside the contour, world units
 * @param {string} cfg.profile  "plateau" (flat), "dome" (rises toward the
 *   inside over `dome` units), "rim" (only a band of `rim` units inside the
 *   edge — the O stays an O even at a coarse density)
 * @param {number} [cfg.dome=1.5]
 * @param {number} [cfg.rim=0.6]
 */
export function shapePresence(
  d, {
    feather,
    profile,
    dome = 1.5,
    rim = 0.6
  }
) {
  if ( !Number.isFinite( d ) ) {
    return 0;
  }

  const edge = d <= 0
    ? 1
    : ( feather > 0 ? smooth01( 1 - d / feather ) : 0 );

  if ( edge <= 0 ) {
    return 0;
  }

  if ( profile === "dome" ) {
    return edge * smooth01( -d / Math.max(
      dome,
      1e-6
    ) );
  }

  if ( profile === "rim" ) {
    const depth = -d;
    const band = Math.max(
      rim,
      1e-6
    );

    return edge * ( 1 - smooth01( ( depth - band * 0.5 ) / ( band * 0.5 ) ) );
  }

  return edge;
}

// ── Builders from landmarks ──────────────────────────────────────────────────
// Points arrive as [{ x, z, visibility? }] already in sheet world units.

function pt(
  points, i
) {
  const p = points[ i ];

  return p && Number.isFinite( p.x ) && Number.isFinite( p.z ) ? p : null;
}

/**
 * A hand: one capsule per phalanx, a rounded palm polygon. Sizes follow the
 * hand's own scale (wrist → middle-finger base), so a hand near the camera
 * gets fat fingers and a far one thin ones.
 *
 * @param {Array<{x:number, z:number}>} points 21 landmarks
 * @param {{thickness?:number}} [cfg]
 */
export function handEntity(
  points, {
    thickness = 1
  } = {}
) {
  const wrist = pt(
    points,
    0
  );
  const middleBase = pt(
    points,
    9
  );

  if ( !wrist || !middleBase ) {
    return null;
  }

  const scale = Math.max(
    Math.hypot(
      middleBase.x - wrist.x,
      middleBase.z - wrist.z
    ),
    1e-3
  );
  const fingerR = 0.1 * scale * thickness;
  const prims = [];

  HAND_FINGERS.forEach( (
    chain, f
  ) => {
    const r = f === 0 ? fingerR * 1.15 : fingerR;

    for ( let i = 0; i < chain.length - 1; i++ ) {
      const a = pt(
        points,
        chain[ i ]
      );
      const b = pt(
        points,
        chain[ i + 1 ]
      );

      if ( a && b ) {
        prims.push( capsule(
          a.x,
          a.z,
          b.x,
          b.z,
          r
        ) );
      }
    }
  } );

  const palm = [];

  HAND_PALM.forEach( ( i ) => {
    const p = pt(
      points,
      i
    );

    if ( p ) {
      palm.push(
        p.x,
        p.z
      );
    }
  } );

  if ( palm.length >= 6 ) {
    prims.push( polygon(
      palm,
      fingerR * 1.3
    ) );
  }

  return prims.length ? makeEntity(
    prims,
    "hand"
  ) : null;
}

/**
 * A face from the 468-point mesh: the face-oval contour as a polygon.
 *
 * @param {Array<{x:number, z:number}>} points 468 landmarks
 */
export function faceEntity( points ) {
  const ring = [];

  FACE_OVAL.forEach( ( i ) => {
    const p = pt(
      points,
      i
    );

    if ( p ) {
      ring.push(
        p.x,
        p.z
      );
    }
  } );

  if ( ring.length < 6 ) {
    return null;
  }

  return makeEntity(
    [
      polygon( ring )
    ],
    "face"
  );
}

/** A face from the detector's box alone: an ellipse. */
export function faceBoxEntity(
  cx, cz, width, height
) {
  return makeEntity(
    [
      ellipse(
        cx,
        cz,
        width / 2,
        height / 2
      )
    ],
    "face"
  );
}

/**
 * A body from the 33 pose landmarks: torso polygon, limb capsules, a head disc,
 * discs on the wrists. Landmarks under `minVisibility` are left out, and a limb
 * needs both its ends.
 *
 * @param {Array<{x:number, z:number, visibility?:number}>} points
 * @param {{thickness?:number, minVisibility?:number}} [cfg]
 */
export function bodyEntity(
  points, {
    thickness = 1,
    minVisibility = 0.3
  } = {}
) {
  const seen = ( i ) => {
    const p = pt(
      points,
      i
    );

    return p && ( p.visibility ?? 1 ) >= minVisibility ? p : null;
  };
  const ls = seen( POSE.leftShoulder );
  const rs = seen( POSE.rightShoulder );

  if ( !ls || !rs ) {
    return null;
  }

  const shoulderW = Math.max(
    Math.hypot(
      ls.x - rs.x,
      ls.z - rs.z
    ),
    1e-3
  );
  const limbR = 0.13 * shoulderW * thickness;
  const prims = [];

  const lh = seen( POSE.leftHip );
  const rh = seen( POSE.rightHip );

  if ( lh && rh ) {
    prims.push( polygon(
      [
        ls.x,
        ls.z,
        rs.x,
        rs.z,
        rh.x,
        rh.z,
        lh.x,
        lh.z
      ],
      limbR
    ) );
  } else {
    prims.push( capsule(
      ls.x,
      ls.z,
      rs.x,
      rs.z,
      limbR * 1.5
    ) );
  }

  POSE_LIMBS.forEach( ( [
    a,
    b
  ] ) => {
    const pa = seen( a );
    const pb = seen( b );

    if ( pa && pb ) {
      prims.push( capsule(
        pa.x,
        pa.z,
        pb.x,
        pb.z,
        limbR
      ) );
    }
  } );

  [
    POSE.leftWrist,
    POSE.rightWrist
  ].forEach( ( i ) => {
    const p = seen( i );

    if ( p ) {
      prims.push( disc(
        p.x,
        p.z,
        limbR * 1.4
      ) );
    }
  } );

  const nose = seen( POSE.nose );
  const le = seen( POSE.leftEar );
  const re = seen( POSE.rightEar );
  const head = nose ?? ( le && re ? {
    x: ( le.x + re.x ) / 2,
    z: ( le.z + re.z ) / 2
  } : null );

  if ( head ) {
    const earSpan = le && re ? Math.hypot(
      le.x - re.x,
      le.z - re.z
    ) : 0;
    const headR = Math.max(
      earSpan * 0.65,
      shoulderW * 0.22
    );

    prims.push( disc(
      head.x,
      head.z,
      headR
    ) );
    prims.push( capsule(
      ( ls.x + rs.x ) / 2,
      ( ls.z + rs.z ) / 2,
      head.x,
      head.z,
      limbR
    ) );
  }

  return makeEntity(
    prims,
    "body"
  );
}

/**
 * A pointer's brush: a disc, an oval or a synthetic hand of `size` (its
 * longest extent, world units), rotated by `angle`.
 */
export function cursorEntity(
  shape, x, z, size, angle = 0
) {
  const s = Math.max(
    size,
    1e-3
  );

  if ( shape === "oval" ) {
    return makeEntity(
      [
        ellipse(
          x,
          z,
          s * 0.38,
          s * 0.5
        )
      ],
      "cursor"
    );
  }

  if ( shape !== "hand" ) {
    return makeEntity(
      [
        disc(
          x,
          z,
          s * 0.5
        )
      ],
      "cursor"
    );
  }

  // A hand ~ 1 unit tall in its own frame, fingers toward -z (up on screen).
  const cosA = Math.cos( angle );
  const sinA = Math.sin( angle );
  const half = s * 0.5;
  const T = (
    ux, uz
  ) => [
    x + ( ux * cosA - uz * sinA ) * half,
    z + ( ux * sinA + uz * cosA ) * half
  ];
  const palm = [
    [
      -0.30,
      0.55
    ],
    [
      -0.24,
      0.18
    ],
    [
      0.22,
      0.18
    ],
    [
      0.32,
      0.52
    ],
    [
      0.20,
      0.92
    ],
    [
      -0.20,
      0.92
    ]
  ].flatMap( ( [
    ux,
    uz
  ] ) => T(
    ux,
    uz
  ) );
  const fingers = [
    [
      -0.36,
      0.42,
      -0.66,
      0.06,
      0.075
    ],
    [
      -0.20,
      0.18,
      -0.32,
      -0.40,
      0.072
    ],
    [
      -0.04,
      0.16,
      -0.04,
      -0.50,
      0.072
    ],
    [
      0.12,
      0.18,
      0.20,
      -0.42,
      0.068
    ],
    [
      0.25,
      0.24,
      0.42,
      -0.20,
      0.06
    ]
  ];
  const prims = [
    polygon(
      palm,
      0.06 * half
    )
  ];

  fingers.forEach( ( [
    ax,
    az,
    bx,
    bz,
    r
  ] ) => {
    const a = T(
      ax,
      az
    );
    const b = T(
      bx,
      bz
    );

    prims.push( capsule(
      a[ 0 ],
      a[ 1 ],
      b[ 0 ],
      b[ 1 ],
      r * half
    ) );
  } );

  return makeEntity(
    prims,
    "cursor"
  );
}

// ── The segmentation mask ────────────────────────────────────────────────────

/**
 * Turn a category mask (`data[i] > 0` = subject) into a soft coverage field:
 * dilated by `dilate` px (box), then box-blurred by `blur` px, with the
 * subject's centroid and equivalent radius for the lift order. Both passes are
 * separable, so a 320 × 240 mask costs well under a millisecond.
 *
 * @param {{data:Uint8Array, width:number, height:number}} mask
 * @param {{dilate?:number, blur?:number}} [cfg]
 * @returns {{data:Float32Array, width:number, height:number, cu:number, cv:number, radius:number, count:number}|null}
 *   `cu`/`cv`/`radius` normalised to the mask's width / height.
 */
export function processMask(
  mask, {
    dilate = 0,
    blur = 0
  } = {}
) {
  if ( !mask?.data || !( mask.width > 0 ) || !( mask.height > 0 ) ) {
    return null;
  }

  const {
    width,
    height,
    data
  } = mask;
  const n = width * height;
  let a = new Float32Array( n );
  let b = new Float32Array( n );
  let count = 0;
  let sumX = 0;
  let sumY = 0;

  for ( let y = 0; y < height; y++ ) {
    for ( let x = 0; x < width; x++ ) {
      const i = y * width + x;

      if ( data[ i ] > 0 ) {
        a[ i ] = 1;
        count++;
        sumX += x;
        sumY += y;
      }
    }
  }

  const passMax = (
    src, dst, radius, horizontal
  ) => {
    for ( let y = 0; y < height; y++ ) {
      for ( let x = 0; x < width; x++ ) {
        let best = 0;

        for ( let k = -radius; k <= radius && best < 1; k++ ) {
          const xx = horizontal ? x + k : x;
          const yy = horizontal ? y : y + k;

          if ( xx < 0 || xx >= width || yy < 0 || yy >= height ) {
            continue;
          }

          if ( src[ yy * width + xx ] > best ) {
            best = src[ yy * width + xx ];
          }
        }

        dst[ y * width + x ] = best;
      }
    }
  };
  const passMean = (
    src, dst, radius, horizontal
  ) => {
    const span = radius * 2 + 1;

    for ( let y = 0; y < height; y++ ) {
      for ( let x = 0; x < width; x++ ) {
        let sum = 0;

        for ( let k = -radius; k <= radius; k++ ) {
          const xx = horizontal ? x + k : x;
          const yy = horizontal ? y : y + k;

          if ( xx < 0 || xx >= width || yy < 0 || yy >= height ) {
            continue;
          }

          sum += src[ yy * width + xx ];
        }

        dst[ y * width + x ] = sum / span;
      }
    }
  };

  const d = Math.max(
    0,
    Math.round( dilate )
  );
  const s = Math.max(
    0,
    Math.round( blur )
  );

  if ( d > 0 ) {
    passMax(
      a,
      b,
      d,
      true
    );
    passMax(
      b,
      a,
      d,
      false
    );
  }

  if ( s > 0 ) {
    passMean(
      a,
      b,
      s,
      true
    );
    passMean(
      b,
      a,
      s,
      false
    );
  }

  return {
    data: a,
    width,
    height,
    count,
    cu: count ? sumX / count / width : 0.5,
    cv: count ? sumY / count / height : 0.5,
    radius: count ? Math.sqrt( count / Math.PI ) / width : 0
  };
}

/** Bilinear sample of a processed mask at normalised (u, v). */
export function maskPresenceAt(
  processed, u, v
) {
  if ( !processed ) {
    return 0;
  }

  const {
    data,
    width,
    height
  } = processed;
  const fx = clamp(
    u,
    0,
    1
  ) * ( width - 1 );
  const fy = clamp(
    v,
    0,
    1
  ) * ( height - 1 );
  const x0 = Math.floor( fx );
  const y0 = Math.floor( fy );
  const x1 = Math.min(
    x0 + 1,
    width - 1
  );
  const y1 = Math.min(
    y0 + 1,
    height - 1
  );
  const tx = fx - x0;
  const ty = fy - y0;
  const top = data[ y0 * width + x0 ] * ( 1 - tx ) + data[ y0 * width + x1 ] * tx;
  const bottom = data[ y1 * width + x0 ] * ( 1 - tx ) + data[ y1 * width + x1 ] * tx;

  return top * ( 1 - ty ) + bottom * ty;
}
