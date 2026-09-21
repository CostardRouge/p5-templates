// ─────────────────────────────────────────────────────────────────────────────
// cameraRig — a tangible, bindable camera for raymarched sketches.
//
// Every camera in the shader sketches so far was either an orbit (yaw, pitch,
// distance — BRAID_CAMERA_MAIN_GLSL) or a scripted fly-through (rings v1, v5).
// Neither exposes the camera as PARAMETERS: the tilt, the spin, the distance,
// where the eye sits and what it looks at are all plain numbers here, one
// slider each, so each one can be driven by the binding system — an LFO on
// the distance is a breathing shot, the mouse on the position is parallax, a
// MIDI knob on the tilt is a hand on the crane.
//
// ── The model ────────────────────────────────────────────────────────────────
// The eye is placed on a sphere around `lookAt`: `tilt` degrees above the
// horizon (90 = straight down, 0 = at the horizon), `spin` degrees around the
// vertical axis, at `distance`. Then `position` is ADDED as a world offset —
// so the two vocabularies coexist: orbit the subject with tilt/spin, or push
// the eye around in x/y/z, or both. The eye always aims at `lookAt`, so an
// offset slides the viewpoint without losing the subject. `roll` turns the
// picture about the view axis.
//
// `fit` keeps every export framed: the distance is computed from the subject's
// bounding radius and the canvas aspect, so a 9:16 and a 1:1 export both hold
// the whole subject, and `distance` becomes a multiplier on that (1 = framed).
// Off, `distance` is the raw world distance.
//
// ── Loop-safe motion ─────────────────────────────────────────────────────────
// `motion` adds whole-cycle movement on top of the static pose: `spinTurns`
// full turns per loop (rounded), a `tiltSway` of ± degrees over `tiltCycles`,
// a `dolly` of ± a fraction of the distance, a vertical `bob`. All of them are
// sines of integer multiples of the loop progression, so progression 0 and 1
// give the same basis and a capture closes.
//
// The shader side is the CPU look-at basis rings v1 and v5 already use:
// uCamPos / uCamFwd / uCamRight / uCamUp (+ uFocal from BRAID_UNIFORMS_GLSL).
// CAMERA_RIG_MAIN_GLSL is the matching `main()`, with the family's optional
// chromatic aberration.
// ─────────────────────────────────────────────────────────────────────────────

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

// The eye can never sit exactly on the vertical axis: `tilt` is clamped just
// under 90° so the look-at basis stays well defined. At the clamp the picture
// is a top view to the pixel.
const MAX_TILT = 89.9;

export const cameraFormValues = {
  fit: true,
  distance: 1,
  tilt: 58,
  spin: 0,
  roll: 0,
  fov: 40,
  position: {
    x: 0,
    y: 0,
    z: 0
  },
  lookAt: {
    x: 0,
    y: 0,
    z: 0
  },
  motion: {
    spinTurns: 0,
    tiltSway: 0,
    tiltCycles: 1,
    dolly: 0,
    dollyCycles: 1,
    bob: 0,
    bobCycles: 1
  }
};

function axisFields(
  label, range
) {
  return {
    x: {
      label: `${ label } x`,
      component: "slider",
      min: -range,
      max: range,
      step: 0.01
    },
    y: {
      label: `${ label } y`,
      component: "slider",
      min: -range,
      max: range,
      step: 0.01
    },
    z: {
      label: `${ label } z`,
      component: "slider",
      min: -range,
      max: range,
      step: 0.01
    }
  };
}

// The form block, ready to drop into a sketch's formConfiguration under the
// `camera` key. The four pose controls declare the first four abstract knobs
// (`binding: { control }`, see interaction/controllerMap.js): a connected
// controller drives them out of the box, nothing is written to the document,
// and a sketch that needs its knobs elsewhere overrides those entries.
export const cameraFormConfiguration = {
  component: "nested-object",
  label: "Camera",
  fields: {
    fit: {
      label: "Fit the subject (distance becomes a multiplier)",
      component: "checkbox"
    },
    distance: {
      label: "Distance (× fit, or world units)",
      component: "slider",
      min: 0.1,
      max: 12,
      step: 0.01,
      binding: {
        control: "knob.3"
      }
    },
    tilt: {
      label: "Tilt ° (90 = top view, 0 = horizon)",
      component: "slider",
      min: 0,
      max: 90,
      step: 0.1,
      binding: {
        control: "knob.1"
      }
    },
    spin: {
      label: "Spin ° (around the vertical axis)",
      component: "slider",
      min: -180,
      max: 180,
      step: 0.1,
      binding: {
        control: "knob.2"
      }
    },
    roll: {
      label: "Roll °",
      component: "slider",
      min: -180,
      max: 180,
      step: 0.1,
      binding: {
        control: "knob.4"
      }
    },
    fov: {
      label: "Field of view °",
      component: "slider",
      min: 15,
      max: 120,
      step: 1
    },
    position: {
      component: "nested-object",
      label: "Eye offset (world)",
      fields: axisFields(
        "Offset",
        4
      )
    },
    lookAt: {
      component: "nested-object",
      label: "Look at (world)",
      fields: axisFields(
        "Target",
        4
      )
    },
    motion: {
      component: "nested-object",
      label: "Motion (whole cycles per loop)",
      fields: {
        spinTurns: {
          label: "Spin turns per loop",
          component: "slider",
          min: -4,
          max: 4,
          step: 1
        },
        tiltSway: {
          label: "Tilt sway ± °",
          component: "slider",
          min: 0,
          max: 45,
          step: 0.5
        },
        tiltCycles: {
          label: "Tilt sway cycles per loop",
          component: "slider",
          min: 1,
          max: 8,
          step: 1
        },
        dolly: {
          label: "Dolly ± (fraction of the distance)",
          component: "slider",
          min: 0,
          max: 0.6,
          step: 0.01
        },
        dollyCycles: {
          label: "Dolly cycles per loop",
          component: "slider",
          min: 1,
          max: 8,
          step: 1
        },
        bob: {
          label: "Bob ± (world units, vertical)",
          component: "slider",
          min: 0,
          max: 2,
          step: 0.01
        },
        bobCycles: {
          label: "Bob cycles per loop",
          component: "slider",
          min: 1,
          max: 8,
          step: 1
        }
      }
    }
  }
};

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

function normalize( v ) {
  const l = Math.hypot(
    v[ 0 ],
    v[ 1 ],
    v[ 2 ]
  );

  return l > 1e-9
    ? [
      v[ 0 ] / l,
      v[ 1 ] / l,
      v[ 2 ] / l
    ]
    : [
      0,
      0,
      0
    ];
}

function cross(
  a, b
) {
  return [
    a[ 1 ] * b[ 2 ] - a[ 2 ] * b[ 1 ],
    a[ 2 ] * b[ 0 ] - a[ 0 ] * b[ 2 ],
    a[ 0 ] * b[ 1 ] - a[ 1 ] * b[ 0 ]
  ];
}

/**
 * Focal length of the pinhole camera for a vertical field of view.
 *
 * @param {number} fovDegrees
 * @returns {number}
 */
export function focalFromFov( fovDegrees ) {
  return 1 / Math.tan( ( fovDegrees * DEG ) / 2 );
}

/**
 * Distance at which a bounding sphere of `radius` fills the frame: the sphere
 * spans the full height on a portrait canvas and the full width on a
 * landscape one (the shader's uv is normalised by the height, so width is
 * `aspect` uv units wide).
 *
 * @param {number} radius  bounding radius of the subject (world)
 * @param {number} focal   focalFromFov( fov )
 * @param {number} aspect  canvas width / height
 * @returns {number}
 */
export function fitDistance(
  radius, focal, aspect
) {
  return ( 2 * radius * focal ) / Math.min(
    1,
    Math.max(
      aspect,
      1e-6
    )
  );
}

/**
 * The camera basis for one frame.
 *
 * @param {object} [camera]     the `camera` options block (cameraFormValues shape)
 * @param {object} [scene]
 * @param {number} [scene.radius=1] bounding radius of the subject, for `fit`
 * @param {number} [scene.aspect=1] canvas width / height
 * @param {number} [scene.progression=0] loop progression 0 → 1 (animation.progression)
 * @returns {{ ro: number[], fwd: number[], right: number[], up: number[],
 *   focal: number, distance: number, tilt: number, spin: number, roll: number,
 *   target: number[] }}
 *   `tilt` / `spin` / `roll` are the resolved angles in radians (motion included).
 */
export function cameraBasis(
  camera = {}, {
    radius = 1,
    aspect = 1,
    progression = 0
  } = {}
) {
  const motion = camera.motion ?? {};
  const focal = focalFromFov( camera.fov ?? 40 );

  // Whole cycles only: the loop closes by construction.
  const spinTurns = Math.round( motion.spinTurns ?? 0 );
  const tiltCycles = Math.max(
    1,
    Math.round( motion.tiltCycles ?? 1 )
  );
  const dollyCycles = Math.max(
    1,
    Math.round( motion.dollyCycles ?? 1 )
  );
  const bobCycles = Math.max(
    1,
    Math.round( motion.bobCycles ?? 1 )
  );
  const phase = progression * TAU;

  const tiltDeg = ( camera.tilt ?? 58 ) + ( motion.tiltSway ?? 0 ) * Math.sin( tiltCycles * phase );
  const tilt = clamp(
    tiltDeg,
    0,
    MAX_TILT
  ) * DEG;
  const spin = ( camera.spin ?? 0 ) * DEG + spinTurns * phase;
  const roll = ( camera.roll ?? 0 ) * DEG;

  const base = camera.fit === false
    ? Math.max(
      camera.distance ?? 1,
      1e-3
    )
    : fitDistance(
      radius,
      focal,
      aspect
    ) * Math.max(
      camera.distance ?? 1,
      1e-3
    );
  const distance = base * ( 1 + ( motion.dolly ?? 0 ) * Math.sin( dollyCycles * phase ) );
  const bob = ( motion.bob ?? 0 ) * Math.sin( bobCycles * phase );

  const target = [
    camera.lookAt?.x ?? 0,
    camera.lookAt?.y ?? 0,
    camera.lookAt?.z ?? 0
  ];
  const ct = Math.cos( tilt );
  const st = Math.sin( tilt );
  const cs = Math.cos( spin );
  const ss = Math.sin( spin );

  // Same convention as the braid orbit camera: spin 0 puts the eye on the -z
  // side looking toward +z, and +x is screen right.
  const ro = [
    target[ 0 ] + distance * ct * ss + ( camera.position?.x ?? 0 ),
    target[ 1 ] + distance * st + ( camera.position?.y ?? 0 ) + bob,
    target[ 2 ] - distance * ct * cs + ( camera.position?.z ?? 0 )
  ];

  const fwd = normalize( [
    target[ 0 ] - ro[ 0 ],
    target[ 1 ] - ro[ 1 ],
    target[ 2 ] - ro[ 2 ]
  ] );

  // The limit of cross( worldUp, fwd ) as the eye reaches the vertical axis is
  // ( cos spin, 0, sin spin ): use it whenever the cross product degenerates,
  // so a top view keeps the framing a slight tilt would have.
  let right = cross(
    [
      0,
      1,
      0
    ],
    fwd
  );

  if ( Math.hypot(
    right[ 0 ],
    right[ 1 ],
    right[ 2 ]
  ) < 1e-4 ) {
    right = [
      cs,
      0,
      ss
    ];
  }

  right = normalize( right );

  let up = cross(
    fwd,
    right
  );

  if ( roll !== 0 ) {
    const cr = Math.cos( roll );
    const sr = Math.sin( roll );
    const rolledRight = [
      right[ 0 ] * cr + up[ 0 ] * sr,
      right[ 1 ] * cr + up[ 1 ] * sr,
      right[ 2 ] * cr + up[ 2 ] * sr
    ];

    up = [
      up[ 0 ] * cr - right[ 0 ] * sr,
      up[ 1 ] * cr - right[ 1 ] * sr,
      up[ 2 ] * cr - right[ 2 ] * sr
    ];
    right = rolledRight;
  }

  return {
    ro,
    fwd,
    right,
    up,
    focal,
    distance,
    tilt,
    spin,
    roll,
    target
  };
}

/**
 * The unit direction of the ray through canvas pixel ( x, y ) — the exact
 * inverse of what CAMERA_RIG_MAIN_GLSL traces, so a pointer can be dropped
 * into the scene (intersect it with a plane, pick a point).
 *
 * @param {object} basis   from cameraBasis
 * @param {number} x       canvas pixel, left → right
 * @param {number} y       canvas pixel, top → bottom
 * @param {number} width   canvas width
 * @param {number} height  canvas height
 * @returns {number[]}
 */
export function screenRay(
  basis, x, y, width, height
) {
  const ux = ( x - width / 2 ) / height;
  const uy = ( height / 2 - y ) / height;
  const {
    fwd,
    right,
    up,
    focal
  } = basis;

  return normalize( [
    fwd[ 0 ] * focal + right[ 0 ] * ux + up[ 0 ] * uy,
    fwd[ 1 ] * focal + right[ 1 ] * ux + up[ 1 ] * uy,
    fwd[ 2 ] * focal + right[ 2 ] * ux + up[ 2 ] * uy
  ] );
}

/**
 * Where the ray from the eye along `rd` meets the horizontal plane y = `planeY`,
 * or null when it never does (parallel, or the plane is behind the eye).
 *
 * @param {object} basis   from cameraBasis
 * @param {number[]} rd    unit direction (screenRay)
 * @param {number} [planeY=0]
 * @returns {number[]|null}
 */
export function hitPlaneY(
  basis, rd, planeY = 0
) {
  if ( Math.abs( rd[ 1 ] ) < 1e-6 ) {
    return null;
  }

  const t = ( planeY - basis.ro[ 1 ] ) / rd[ 1 ];

  if ( t <= 0 ) {
    return null;
  }

  return [
    basis.ro[ 0 ] + rd[ 0 ] * t,
    planeY,
    basis.ro[ 2 ] + rd[ 2 ] * t
  ];
}

/**
 * The uniforms a fragment using CAMERA_RIG_MAIN_GLSL reads, from a basis.
 * `uFocal` is declared by BRAID_UNIFORMS_GLSL; the four vectors by
 * CAMERA_RIG_UNIFORMS_GLSL.
 *
 * @param {object} basis from cameraBasis
 * @returns {object}
 */
export function cameraUniforms( basis ) {
  return {
    uCamPos: basis.ro,
    uCamFwd: basis.fwd,
    uCamRight: basis.right,
    uCamUp: basis.up,
    uFocal: basis.focal
  };
}

// The basis, as uniforms. Declared here so a sketch fragment does not repeat
// them (GLSL forbids duplicate declarations).
export const CAMERA_RIG_UNIFORMS_GLSL = `
  uniform vec3 uCamPos;
  uniform vec3 uCamFwd;
  uniform vec3 uCamRight;
  uniform vec3 uCamUp;
`;

// A look-at pinhole camera fed by the CPU basis, with the braid family's
// chromatic aberration (R/B re-traced along slightly offset rays). Same uv
// convention as BRAID_CAMERA_MAIN_GLSL — and as screenRay above.
export const CAMERA_RIG_MAIN_GLSL = `
  void main() {
    vec2 frag = vec2(vUv.x * uResolution.x, vUv.y * uResolution.y);
    vec2 uv = (frag - 0.5 * uResolution) / uResolution.y;

    vec3 ro = uCamPos;

    if (uAberration < 0.5) {
      vec3 rd = normalize(uCamFwd * uFocal + uCamRight * uv.x + uCamUp * uv.y);
      gl_FragColor = traceRay(ro, rd);
      return;
    }

    vec2 dir = uAberrationMode == 1
      ? vec2(1.0, 0.0)
      : normalize(uv + vec2(1e-4));
    vec2 off = dir * (uAberration / uResolution.y);

    vec3 rdR = normalize(uCamFwd * uFocal + uCamRight * (uv.x + off.x) + uCamUp * (uv.y + off.y));
    vec3 rdG = normalize(uCamFwd * uFocal + uCamRight * uv.x + uCamUp * uv.y);
    vec3 rdB = normalize(uCamFwd * uFocal + uCamRight * (uv.x - off.x) + uCamUp * (uv.y - off.y));

    vec4 cr4 = traceRay(ro, rdR);
    vec4 cg4 = traceRay(ro, rdG);
    vec4 cb4 = traceRay(ro, rdB);

    gl_FragColor = vec4(cr4.r, cg4.g, cb4.b, max(cr4.a, max(cg4.a, cb4.a)));
  }
`;
