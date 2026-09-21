import clamp from "@/utils/clamp";
import {
  fractionToValue,
  stepDecimals,
  valueToFraction,
  type AxisRange
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/components/ControlledVector2DInput/utils/vector2dMath";

export type {
  AxisRange
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/components/ControlledVector2DInput/utils/vector2dMath";

export {
  fractionToValue,
  stepDecimals,
  valueToFraction
};

export type Vector3DValue = {
  x: number;
  y: number;
  z: number;
};

/**
 * What the three numbers mean. It does not change the stored shape — always a
 * cartesian `{ x, y, z }` — only which view the control opens on and how the
 * views talk about the value (a direction has an azimuth and an elevation, a
 * position has a floor to cast a shadow on).
 */
export type Vector3DKind = "position" | "direction";

/**
 * The presentations the control can switch between. Every view edits the same
 * `{ x, y, z }`; they differ in the gesture that moves it:
 *  - `gizmo`     — an orbitable axonometric box with the vector as an arrow;
 *                  drag the tip in the screen plane, Shift for depth, hold
 *                  x / y / z for one axis.
 *  - `planes`    — two orthographic pads, front (x·y) and top (x·z).
 *  - `pad-depth` — the 2D pad for x·y beside a vertical strip for z.
 *  - `orbit`     — a virtual trackball: drag rotates the vector about the
 *                  origin, a strip sets its length.
 */
export type Vector3DView = "gizmo" | "planes" | "pad-depth" | "orbit";

export const VECTOR3D_VIEWS: readonly Vector3DView[] = [
  "gizmo",
  "planes",
  "pad-depth",
  "orbit"
];

/**
 * Subset of the field config understood by the 3D control. Kept independent
 * from `FieldConfig` (like the 2D pad's) so the maths stays importable from
 * non-React callers — the settings randomizer, the breakdown's range lookup.
 */
export interface Vector3DInputConfig {
  /** Defaults to true: a centred [-1, 1] cube. False → [0, max] on every axis. */
  allowNegative?: boolean;
  /** Shared lower bound. Defaults to -1 (or 0 when `allowNegative` is false). */
  min?: number;
  /** Shared upper bound. Defaults to 1. */
  max?: number;
  /** Shared snapping increment. Defaults to 0.01. */
  step?: number;
  /** Per-axis overrides, merged over the shared min/max/step. */
  xAxis?: Partial<AxisRange>;
  yAxis?: Partial<AxisRange>;
  zAxis?: Partial<AxisRange>;
  /**
   * Draw the vertical axis with its minimum at the top. p5's WEBGL canvas has
   * +y pointing DOWN on screen (unlike Three.js), so a p5 sketch sets this to
   * keep "up in the control" meaning "up on the canvas". Rendering only: the
   * stored value is the same either way.
   */
  yDown?: boolean;
  /** What the value means; picks the default view. Defaults to "position". */
  kind?: Vector3DKind;
  /** The view the control opens on. Defaults to `orbit` for a direction, `gizmo` otherwise. */
  view?: Vector3DView;
}

export interface Axes3D {
  xAxis: AxisRange;
  yAxis: AxisRange;
  zAxis: AxisRange;
}

export type AxisName = "x" | "y" | "z";

export const AXIS_NAMES: readonly AxisName[] = [
  "x",
  "y",
  "z"
];

/**
 * Turns the config into three concrete axis ranges: shared defaults first,
 * `allowNegative` next, per-axis overrides on top — the same ladder as the 2D
 * pad's `resolveAxes`, extended to z.
 */
export function resolveAxes3D( config: Vector3DInputConfig ): Axes3D {
  const allowNegative = config.allowNegative ?? true;
  const min = config.min ?? ( allowNegative ? -1 : 0 );
  const max = config.max ?? 1;
  const step = config.step ?? 0.01;

  const resolve = ( axis: Partial<AxisRange> | undefined ): AxisRange => ( {
    min: axis?.min ?? min,
    max: axis?.max ?? max,
    step: axis?.step ?? step
  } );

  return {
    xAxis: resolve( config.xAxis ),
    yAxis: resolve( config.yAxis ),
    zAxis: resolve( config.zAxis )
  };
}

export function axisRange(
  axes: Axes3D, axis: AxisName
): AxisRange {
  return axis === "x" ? axes.xAxis : axis === "y" ? axes.yAxis : axes.zAxis;
}

/** The view a config opens on: explicit, else by kind. */
export function defaultViewFor( config: Vector3DInputConfig ): Vector3DView {
  return config.view ?? ( config.kind === "direction" ? "orbit" : "gizmo" );
}

/**
 * Value-space counterpart of `fractionToValue`: clamps into the axis and snaps
 * to its step (measured from `min`), free of floating-point noise.
 */
export function snapToAxis(
  value: number, {
    min, max, step
  }: AxisRange
): number {
  let snapped = value;

  if ( step && step > 0 ) {
    snapped = Number( ( min + Math.round( ( value - min ) / step ) * step ).toFixed( stepDecimals( step ) ) );
  }

  return clamp(
    snapped,
    min,
    max
  );
}

/** Clamps and snaps every component into its own axis. */
export function snapVector(
  v: Vector3DValue, axes: Axes3D
): Vector3DValue {
  return {
    x: snapToAxis(
      v.x,
      axes.xAxis
    ),
    y: snapToAxis(
      v.y,
      axes.yAxis
    ),
    z: snapToAxis(
      v.z,
      axes.zAxis
    )
  };
}

/** Fills a partial / undefined value with each axis' minimum, like the 2D pad. */
export function completeVector(
  value: Partial<Vector3DValue> | undefined, axes: Axes3D
): Vector3DValue {
  return {
    x: typeof value?.x === "number" ? value.x : axes.xAxis.min,
    y: typeof value?.y === "number" ? value.y : axes.yAxis.min,
    z: typeof value?.z === "number" ? value.z : axes.zAxis.min
  };
}

/**
 * A uniformly random point inside the box, snapped per axis — what the
 * randomize action assigns to a vector3d field. Three independent draws, in
 * x, y, z order, so the result covers the whole volume.
 */
export function randomVector3D(
  config: Vector3DInputConfig, random: () => number = Math.random
): Vector3DValue {
  const axes = resolveAxes3D( config );

  return {
    x: fractionToValue(
      random(),
      axes.xAxis
    ),
    y: fractionToValue(
      random(),
      axes.yAxis
    ),
    z: fractionToValue(
      random(),
      axes.zAxis
    )
  };
}

/* ───────────────────────── plain vector algebra ───────────────────────── */

export function length3( v: Vector3DValue ): number {
  return Math.hypot(
    v.x,
    v.y,
    v.z
  );
}

export function scale3(
  v: Vector3DValue, s: number
): Vector3DValue {
  return {
    x: v.x * s,
    y: v.y * s,
    z: v.z * s
  };
}

export function add3(
  a: Vector3DValue, b: Vector3DValue
): Vector3DValue {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z
  };
}

export function dot3(
  a: Vector3DValue, b: Vector3DValue
): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross3(
  a: Vector3DValue, b: Vector3DValue
): Vector3DValue {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

/** Unit vector, or `fallback` (default +z, "toward the viewer") for a zero vector. */
export function normalize3(
  v: Vector3DValue, fallback: Vector3DValue = {
    x: 0,
    y: 0,
    z: 1
  }
): Vector3DValue {
  const len = length3( v );

  return len > 1e-12 ? scale3(
    v,
    1 / len
  ) : fallback;
}

/** Rodrigues' rotation of `v` by `angle` radians about the unit `axis`. */
export function rotateAroundAxis(
  v: Vector3DValue, axis: Vector3DValue, angle: number
): Vector3DValue {
  const c = Math.cos( angle );
  const s = Math.sin( angle );
  const k = axis;
  const kCrossV = cross3(
    k,
    v
  );
  const kDotV = dot3(
    k,
    v
  );

  return {
    x: v.x * c + kCrossV.x * s + k.x * kDotV * ( 1 - c ),
    y: v.y * c + kCrossV.y * s + k.y * kDotV * ( 1 - c ),
    z: v.z * c + kCrossV.z * s + k.z * kDotV * ( 1 - c )
  };
}

/* ─────────────────────────── spherical form ───────────────────────────── */

/**
 * Azimuth is the turn about +y measured from +z toward +x, in (-π, π];
 * elevation the lift from the x·z plane toward +y, in [-π/2, π/2]. The zero
 * vector reads as azimuth 0, elevation 0, length 0.
 */
export interface Spherical {
  azimuth: number;
  elevation: number;
  length: number;
}

export function toSpherical( v: Vector3DValue ): Spherical {
  const length = length3( v );

  if ( length < 1e-12 ) {
    return {
      azimuth: 0,
      elevation: 0,
      length: 0
    };
  }

  return {
    azimuth: Math.atan2(
      v.x,
      v.z
    ),
    elevation: Math.atan2(
      v.y,
      Math.hypot(
        v.x,
        v.z
      )
    ),
    length
  };
}

export function fromSpherical( {
  azimuth, elevation, length
}: Spherical ): Vector3DValue {
  const flat = Math.cos( elevation ) * length;

  return {
    x: flat * Math.sin( azimuth ),
    y: Math.sin( elevation ) * length,
    z: flat * Math.cos( azimuth )
  };
}

/* ───────────────────────── virtual trackball ──────────────────────────── */

/**
 * Bell's virtual trackball (the variant Holroyd formalised): a point of the
 * disc, in [-1, 1]² with y up, lifted onto the unit sphere inside r² ≤ ½ and
 * onto the hyperbolic sheet z = 1 / (2r) outside it. The blend is C¹ at the
 * seam, so a drag that crosses the rim keeps rotating smoothly instead of
 * clamping the way Shoemake's pure arcball does.
 */
export function trackballPoint(
  fx: number, fy: number
): Vector3DValue {
  const r2 = fx * fx + fy * fy;
  const z = r2 <= 0.5 ? Math.sqrt( 1 - r2 ) : 0.5 / Math.sqrt( r2 );

  return normalize3( {
    x: fx,
    y: fy,
    z
  } );
}

/**
 * Applies to `v` the rotation carrying unit `from` onto unit `to` — the
 * incremental step of a trackball drag. Coincident points leave `v` as is.
 */
export function rotateBetween(
  v: Vector3DValue, from: Vector3DValue, to: Vector3DValue
): Vector3DValue {
  const axis = cross3(
    from,
    to
  );
  const sine = length3( axis );

  if ( sine < 1e-9 ) {
    return v;
  }

  const cosine = clamp(
    dot3(
      from,
      to
    ),
    -1,
    1
  );

  return rotateAroundAxis(
    v,
    scale3(
      axis,
      1 / sine
    ),
    Math.atan2(
      sine,
      cosine
    )
  );
}

/* ───────────────────────── the gizmo's camera ─────────────────────────── */

/** The orbitable view's orientation: yaw about +y, then pitch about the screen's x. */
export interface ViewOrientation {
  yaw: number;
  pitch: number;
}

/** A pleasant three-quarter view: +x right and slightly toward the viewer, +z left and toward, +y up. */
export const DEFAULT_VIEW: ViewOrientation = {
  yaw: -Math.PI / 6,
  pitch: Math.PI / 7
};

/** Row-major 3×3. */
export type Mat3 = readonly [
  number, number, number,
  number, number, number,
  number, number, number
];

/**
 * World → view rotation. View space is the screen: x right, y up, z toward
 * the viewer (depth). Positive pitch lifts the camera above the x·z plane,
 * positive yaw swings it toward +x.
 */
export function viewMatrix( {
  yaw, pitch
}: ViewOrientation ): Mat3 {
  const cy = Math.cos( yaw );
  const sy = Math.sin( yaw );
  const cp = Math.cos( pitch );
  const sp = Math.sin( pitch );

  // Rx( pitch ) · Ry( yaw )
  return [
    cy,
    0,
    sy,
    sp * sy,
    cp,
    -sp * cy,
    -cp * sy,
    sp,
    cp * cy
  ];
}

export function applyMat3(
  m: Mat3, v: Vector3DValue
): Vector3DValue {
  return {
    x: m[ 0 ] * v.x + m[ 1 ] * v.y + m[ 2 ] * v.z,
    y: m[ 3 ] * v.x + m[ 4 ] * v.y + m[ 5 ] * v.z,
    z: m[ 6 ] * v.x + m[ 7 ] * v.y + m[ 8 ] * v.z
  };
}

/** For a rotation the transpose is the inverse. */
export function transposeMat3( m: Mat3 ): Mat3 {
  return [
    m[ 0 ],
    m[ 3 ],
    m[ 6 ],
    m[ 1 ],
    m[ 4 ],
    m[ 7 ],
    m[ 2 ],
    m[ 5 ],
    m[ 8 ]
  ];
}

/**
 * Cube space: each axis' [min, max] mapped to [-1, 1], so the drawn box is a
 * cube whatever the ranges, and `yDown` mirrors y so the top of the box is the
 * canvas's top. Everything the gizmo projects and drags lives in this space.
 */
export function toCube(
  v: Vector3DValue, axes: Axes3D, yDown = false
): Vector3DValue {
  const y = valueToFraction(
    v.y,
    axes.yAxis
  ) * 2 - 1;

  return {
    x: valueToFraction(
      v.x,
      axes.xAxis
    ) * 2 - 1,
    y: yDown ? -y : y,
    z: valueToFraction(
      v.z,
      axes.zAxis
    ) * 2 - 1
  };
}

/** Inverse of {@link toCube}: clamps to the box and snaps per axis. */
export function fromCube(
  c: Vector3DValue, axes: Axes3D, yDown = false
): Vector3DValue {
  const cy = yDown ? -c.y : c.y;

  return {
    x: fractionToValue(
      ( c.x + 1 ) / 2,
      axes.xAxis
    ),
    y: fractionToValue(
      ( cy + 1 ) / 2,
      axes.yAxis
    ),
    z: fractionToValue(
      ( c.z + 1 ) / 2,
      axes.zAxis
    )
  };
}

/** Orthographic projection of a cube-space point: screen x/y plus depth toward the viewer. */
export function projectPoint(
  c: Vector3DValue, view: ViewOrientation
): Vector3DValue {
  return applyMat3(
    viewMatrix( view ),
    c
  );
}

/**
 * A pointer displacement in the screen plane (y up) lifted back into cube
 * space, staying parallel to the screen — what a plain drag of the tip does.
 */
export function unprojectScreenDelta(
  dsx: number, dsy: number, view: ViewOrientation
): Vector3DValue {
  return applyMat3(
    transposeMat3( viewMatrix( view ) ),
    {
      x: dsx,
      y: dsy,
      z: 0
    }
  );
}

/** The world direction that points at the viewer, i.e. what a depth drag moves along. */
export function viewDepthAxis( view: ViewOrientation ): Vector3DValue {
  return applyMat3(
    transposeMat3( viewMatrix( view ) ),
    {
      x: 0,
      y: 0,
      z: 1
    }
  );
}

/**
 * How far along the cube-space `axis` a screen displacement reaches: the
 * least-squares fit of the displacement onto the axis' own projection. An
 * axis seen end-on projects to nothing and cannot be dragged (returns 0).
 */
export function axisDragAmount(
  dsx: number, dsy: number, axis: Vector3DValue, view: ViewOrientation
): number {
  const projected = projectPoint(
    axis,
    view
  );
  const len2 = projected.x * projected.x + projected.y * projected.y;

  if ( len2 < 1e-6 ) {
    return 0;
  }

  return ( dsx * projected.x + dsy * projected.y ) / len2;
}

export const UNIT_AXES: Record<AxisName, Vector3DValue> = {
  x: {
    x: 1,
    y: 0,
    z: 0
  },
  y: {
    x: 0,
    y: 1,
    z: 0
  },
  z: {
    x: 0,
    y: 0,
    z: 1
  }
};

/** Radians → degrees, rounded to the whole degree, for readouts. */
export function toDegrees( radians: number ): number {
  return Math.round( radians * 180 / Math.PI );
}
