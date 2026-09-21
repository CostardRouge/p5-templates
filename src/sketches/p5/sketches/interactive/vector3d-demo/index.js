// ── Vector3D control demo ───────────────────────────────────────────────────
// A small lit scene whose three 3D parameters are each edited with the
// `vector3d` control, one per kind: a position (the sphere, inside the box the
// control draws), a light direction (the sun and its ray) and a spin axis (the
// torus turns about it). The camera orbits with the loop clock so depth reads
// over time as well as from the sphere's dropped shadow. Everything is a pure
// function of `animation.progression` → seamless loop, headless-capturable.
//
// p5's WEBGL y points DOWN on screen, which is why the pads in options.ts set
// `yDown` and why the floor sits at the box's +y face.

import options from "@/p5/utils/options.js";
import animation from "@/p5/utils/animation.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";

sketch.setup(
  undefined,
  {
    type: "webgl"
  }
);

// Mirrors the `object.position` bounds declared in options.ts.
const POSITION_BOX = {
  x: [
    -1,
    1
  ],
  y: [
    -0.5,
    0.5
  ],
  z: [
    -1,
    1
  ]
};

const TAU = Math.PI * 2;

function numberOr(
  value, fallback
) {
  return typeof value === "number" && Number.isFinite( value ) ? value : fallback;
}

function vectorOr(
  value, fallback
) {
  return {
    x: numberOr(
      value?.x,
      fallback.x
    ),
    y: numberOr(
      value?.y,
      fallback.y
    ),
    z: numberOr(
      value?.z,
      fallback.z
    )
  };
}

function normalized(
  v, fallback
) {
  const length = Math.hypot(
    v.x,
    v.y,
    v.z
  );

  if ( length < 1e-9 ) {
    return fallback;
  }

  return {
    x: v.x / length,
    y: v.y / length,
    z: v.z / length
  };
}

function drawFloorGrid(
  p, floorY, scale
) {
  p.push();
  p.stroke(
    255,
    28
  );
  p.strokeWeight( 1 );

  for ( let i = -1; i <= 1.001; i += 0.25 ) {
    p.line(
      i * scale,
      floorY,
      -scale,
      i * scale,
      floorY,
      scale
    );
    p.line(
      -scale,
      floorY,
      i * scale,
      scale,
      floorY,
      i * scale
    );
  }

  p.pop();
}

function drawPositionBox(
  p, scale
) {
  const [
    x0,
    x1
  ] = POSITION_BOX.x;
  const [
    y0,
    y1
  ] = POSITION_BOX.y;
  const [
    z0,
    z1
  ] = POSITION_BOX.z;

  p.push();
  p.noFill();
  p.stroke(
    255,
    70
  );
  p.strokeWeight( 1 );
  p.translate(
    ( x0 + x1 ) / 2 * scale,
    ( y0 + y1 ) / 2 * scale,
    ( z0 + z1 ) / 2 * scale
  );
  p.box(
    ( x1 - x0 ) * scale,
    ( y1 - y0 ) * scale,
    ( z1 - z0 ) * scale
  );
  p.pop();

  // The axes through the origin, dimmer than the box.
  p.push();
  p.stroke(
    255,
    45
  );
  p.line(
    x0 * scale,
    0,
    0,
    x1 * scale,
    0,
    0
  );
  p.line(
    0,
    y0 * scale,
    0,
    0,
    y1 * scale,
    0
  );
  p.line(
    0,
    0,
    z0 * scale,
    0,
    0,
    z1 * scale
  );
  p.pop();
}

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const scale = numberOr(
    o.worldScale,
    220
  );
  const progression = animation.progression;

  const background = o.backgroundColor ?? [
    12,
    12,
    16
  ];
  const object = o.object ?? {};
  const light = o.light ?? {};
  const spin = o.spin ?? {};
  const camera = o.camera ?? {};

  const position = vectorOr(
    object.position,
    {
      x: 0,
      y: 0,
      z: 0
    }
  );
  const lightDirection = normalized(
    vectorOr(
      light.direction,
      {
        x: -0.5,
        y: 0.6,
        z: -0.6
      }
    ),
    {
      x: 0,
      y: 1,
      z: 0
    }
  );
  const spinAxis = normalized(
    vectorOr(
      spin.axis,
      {
        x: 0,
        y: 1,
        z: 0
      }
    ),
    {
      x: 0,
      y: 1,
      z: 0
    }
  );
  const lightColor = light.color ?? [
    255,
    236,
    214
  ];
  const floorY = POSITION_BOX.y[ 1 ] * scale;

  p.clear();
  p.background( ...background );

  // ── Camera: an orbit driven by the loop clock ─────────────────────────────
  const distance = numberOr(
    camera.distance,
    3.2
  ) * scale;
  const elevation = numberOr(
    camera.elevation,
    0.45
  );
  const orbit = TAU * progression * Math.round( numberOr(
    camera.turnsPerLoop,
    1
  ) ) - Math.PI / 5;

  p.perspective(
    Math.PI / 3,
    p.width / p.height,
    scale * 0.05,
    scale * 40
  );
  p.camera(
    distance * Math.cos( elevation ) * Math.sin( orbit ),
    -distance * Math.sin( elevation ),
    distance * Math.cos( elevation ) * Math.cos( orbit ),
    0,
    0,
    0,
    0,
    1,
    0
  );

  // ── Lights ────────────────────────────────────────────────────────────────
  p.ambientLight( numberOr(
    light.ambient,
    0.22
  ) * 255 );
  p.directionalLight(
    lightColor[ 0 ],
    lightColor[ 1 ],
    lightColor[ 2 ],
    lightDirection.x,
    lightDirection.y,
    lightDirection.z
  );

  drawFloorGrid(
    p,
    floorY,
    scale
  );
  drawPositionBox(
    p,
    scale
  );

  // ── The sun: where the light comes from, and its ray toward the origin ────
  const sunDistance = 1.7 * scale;
  const sun = {
    x: -lightDirection.x * sunDistance,
    y: -lightDirection.y * sunDistance,
    z: -lightDirection.z * sunDistance
  };

  p.push();
  p.stroke(
    lightColor[ 0 ],
    lightColor[ 1 ],
    lightColor[ 2 ],
    140
  );
  p.strokeWeight( 1.5 );
  p.line(
    sun.x,
    sun.y,
    sun.z,
    sun.x * 0.45,
    sun.y * 0.45,
    sun.z * 0.45
  );
  p.translate(
    sun.x,
    sun.y,
    sun.z
  );
  p.noStroke();
  p.emissiveMaterial(
    lightColor[ 0 ],
    lightColor[ 1 ],
    lightColor[ 2 ]
  );
  p.sphere(
    0.06 * scale,
    16,
    12
  );
  p.pop();

  // ── The torus, spinning about its axis ───────────────────────────────────
  const turns = Math.round( numberOr(
    spin.turnsPerLoop,
    1
  ) );

  p.push();
  p.stroke(
    255,
    110
  );
  p.strokeWeight( 1 );
  p.line(
    -spinAxis.x * 0.95 * scale,
    -spinAxis.y * 0.95 * scale,
    -spinAxis.z * 0.95 * scale,
    spinAxis.x * 0.95 * scale,
    spinAxis.y * 0.95 * scale,
    spinAxis.z * 0.95 * scale
  );
  p.rotate(
    TAU * progression * turns,
    [
      spinAxis.x,
      spinAxis.y,
      spinAxis.z
    ]
  );
  // Lay the torus perpendicular to its axis: p5 draws it in the x·z plane,
  // so rotate y onto the axis.
  const tilt = Math.acos( Math.max(
    -1,
    Math.min(
      1,
      spinAxis.y
    )
  ) );
  const tiltAxis = Math.hypot(
    spinAxis.z,
    spinAxis.x
  ) < 1e-6
    ? [
      1,
      0,
      0
    ]
    : [
      spinAxis.z,
      0,
      -spinAxis.x
    ];

  p.rotate(
    tilt,
    tiltAxis
  );
  p.noStroke();
  p.fill(
    190,
    196,
    210
  );
  p.specularMaterial( 60 );
  p.shininess( 24 );
  p.torus(
    0.5 * scale,
    0.11 * scale,
    40,
    20
  );
  p.pop();

  // ── The sphere at `position`, with its shadow dropped onto the floor ──────
  const radius = numberOr(
    object.radius,
    0.16
  ) * scale;
  const px = position.x * scale;
  const py = position.y * scale;
  const pz = position.z * scale;

  p.push();
  p.stroke(
    255,
    90
  );
  p.strokeWeight( 1 );
  p.line(
    px,
    py,
    pz,
    px,
    floorY,
    pz
  );
  p.pop();

  p.push();
  p.translate(
    px,
    floorY - 0.5,
    pz
  );
  p.rotateX( Math.PI / 2 );
  p.noStroke();
  p.fill(
    0,
    150
  );
  p.circle(
    0,
    0,
    radius * 1.8
  );
  p.pop();

  p.push();
  p.translate(
    px,
    py,
    pz
  );
  p.noStroke();
  p.fill( ...( object.color ?? [
    235,
    240,
    255
  ] ) );
  p.specularMaterial( 80 );
  p.shininess( 40 );
  p.sphere(
    radius,
    28,
    18
  );
  p.pop();
} );
