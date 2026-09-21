// ── Vector3D control demo — options ─────────────────────────────────────────
// Three 3D parameters, one per way the `vector3d` control is used:
//   object.position  — a position inside a box with asymmetric bounds
//   light.direction  — a unit-ish direction (opens on the trackball sphere)
//   spin.axis        — an axis of rotation (a direction, opened on the 3D box)
// p5's WEBGL canvas has +y pointing DOWN, so every pad sets `yDown` — "up in
// the control" then means "up on the canvas". The position bounds below are
// mirrored by `POSITION_BOX` in index.js, which draws them.

export const formValues = {
  backgroundColor: [
    12,
    12,
    16
  ],
  worldScale: 220,
  object: {
    position: {
      x: 0.45,
      y: -0.2,
      z: 0.35
    },
    radius: 0.16,
    color: [
      235,
      240,
      255
    ]
  },
  light: {
    direction: {
      x: -0.5,
      y: 0.6,
      z: -0.6
    },
    color: [
      255,
      236,
      214
    ],
    ambient: 0.22
  },
  spin: {
    axis: {
      x: 0.3,
      y: 1,
      z: 0.2
    },
    turnsPerLoop: 1
  },
  camera: {
    distance: 3.2,
    elevation: 0.45,
    turnsPerLoop: 1
  }
};

export const formConfiguration: Record<string, any> = {
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
  worldScale: {
    component: "slider",
    label: "World scale (px per unit)",
    min: 80,
    max: 400,
    step: 1
  },
  object: {
    component: "nested-object",
    label: "Object",
    fields: {
      position: {
        component: "vector3d",
        label: "Position",
        kind: "position",
        min: -1,
        max: 1,
        step: 0.01,
        yAxis: {
          min: -0.5,
          max: 0.5
        },
        yDown: true
      },
      radius: {
        component: "slider",
        label: "Radius",
        min: 0.04,
        max: 0.4,
        step: 0.01
      },
      color: {
        component: "color",
        label: "Color"
      }
    }
  },
  light: {
    component: "nested-object",
    label: "Light",
    fields: {
      direction: {
        component: "vector3d",
        label: "Direction (the way the light travels)",
        kind: "direction",
        min: -1,
        max: 1,
        step: 0.01,
        yDown: true
      },
      color: {
        component: "color",
        label: "Color"
      },
      ambient: {
        component: "slider",
        label: "Ambient",
        min: 0,
        max: 1,
        step: 0.01
      }
    }
  },
  spin: {
    component: "nested-object",
    label: "Torus spin",
    fields: {
      axis: {
        component: "vector3d",
        label: "Spin axis",
        kind: "direction",
        view: "gizmo",
        min: -1,
        max: 1,
        step: 0.01,
        yDown: true
      },
      turnsPerLoop: {
        component: "slider",
        label: "Turns per loop",
        min: 0,
        max: 4,
        step: 1
      }
    }
  },
  camera: {
    component: "nested-object",
    label: "Camera",
    fields: {
      distance: {
        component: "slider",
        label: "Distance (units)",
        min: 1.5,
        max: 6,
        step: 0.05
      },
      elevation: {
        component: "slider",
        label: "Elevation (rad)",
        min: -1.2,
        max: 1.2,
        step: 0.01
      },
      turnsPerLoop: {
        component: "slider",
        label: "Orbit turns per loop (0 = still)",
        min: 0,
        max: 3,
        step: 1
      }
    }
  }
};
