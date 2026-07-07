/**
 * Demo Three.js template — a rotating torus knot.
 *
 * Shows the engine contract end to end:
 *   • `sketch.setup( ctx )` builds the scene once — geometry, material, lights.
 *   • `sketch.draw( time, ctx )` runs every frame; it drives rotation off the
 *     loop phase (`ctx.phase`, 0 → 1 over one loop) so the animation is
 *     seamless and frame-perfect in the live preview AND in a recording.
 *
 * The context object carries the live `THREE` namespace plus the `renderer`,
 * `scene` and `camera` the engine owns, so a sketch never imports three
 * itself or manages the render loop.
 */
import sketch from "@/threejs/utils/sketch.js";
import options from "@/threejs/utils/options.js";

const TWO_PI = Math.PI * 2;

// Convert an [r, g, b] option value (0–255) to a THREE.Color.
function toColor(
  THREE, value, fallback
) {
  const rgb = Array.isArray( value ) ? value : fallback;

  return new THREE.Color(
    ( rgb[ 0 ] ?? 0 ) / 255,
    ( rgb[ 1 ] ?? 0 ) / 255,
    ( rgb[ 2 ] ?? 0 ) / 255
  );
}

let knot = null;
let keyLight = null;
let rimLight = null;

// Geometry is the one thing too expensive to rebuild every frame (220x32
// segments), so it's only reconstructed when knotP/knotQ actually change —
// everything else (material, lights, transform) is cheap enough to just
// re-apply from the live options on every draw call.
let currentKnotP = null;
let currentKnotQ = null;

function rebuildKnotGeometry(
  THREE, knotP, knotQ
) {
  knot.geometry.dispose();
  knot.geometry = new THREE.TorusKnotGeometry(
    1,
    0.32,
    220,
    32,
    knotP,
    knotQ
  );
  currentKnotP = knotP;
  currentKnotQ = knotQ;
}

sketch.setup( ( {
  THREE, scene
} ) => {
  const o = options.sketch;

  currentKnotP = o.knotP ?? 2;
  currentKnotQ = o.knotQ ?? 3;

  const geometry = new THREE.TorusKnotGeometry(
    1,
    0.32,
    220,
    32,
    currentKnotP,
    currentKnotQ
  );

  const material = new THREE.MeshStandardMaterial( {
    color: toColor(
      THREE,
      o.color,
      [
        124,
        92,
        255
      ]
    ),
    metalness: o.metalness ?? 0.4,
    roughness: o.roughness ?? 0.25,
    wireframe: Boolean( o.wireframe )
  } );

  knot = new THREE.Mesh(
    geometry,
    material
  );
  scene.add( knot );

  keyLight = new THREE.DirectionalLight(
    0xffffff,
    2.4
  );
  keyLight.position.set(
    4,
    5,
    6
  );
  scene.add( keyLight );

  rimLight = new THREE.DirectionalLight(
    toColor(
      THREE,
      o.accentColor,
      [
        80,
        170,
        255
      ]
    ),
    1.6
  );

  rimLight.position.set(
    -6,
    -2,
    -4
  );
  scene.add( rimLight );

  scene.add( new THREE.AmbientLight(
    0xffffff,
    0.35
  ) );
} );

sketch.draw( (
  time, ctx
) => {
  const {
    THREE, scene, camera, phase
  } = ctx;
  const o = options.sketch;

  // Background — clear color follows the option (transparent alpha kept so the
  // canvas composites over the app surface when no colour is set; the engine
  // forces an opaque backdrop for the duration of a recording so exports
  // never show that transparency as solid black).
  const bg = o.backgroundColor;

  if ( Array.isArray( bg ) ) {
    scene.background = toColor(
      THREE,
      bg,
      [
        11,
        11,
        18
      ]
    );
  } else {
    scene.background = null;
  }

  if ( !knot ) {
    return;
  }

  camera.position.set(
    0,
    0,
    o.cameraDistance ?? 5
  );

  const knotP = o.knotP ?? 2;
  const knotQ = o.knotQ ?? 3;

  if ( knotP !== currentKnotP || knotQ !== currentKnotQ ) {
    rebuildKnotGeometry(
      THREE,
      knotP,
      knotQ
    );
  }

  // Rotate a whole number of turns across one loop so the motion is seamless
  // when the loop wraps. `spin` scales how many turns per loop.
  const spin = o.spin ?? 1;

  knot.rotation.x = phase * TWO_PI * spin;
  knot.rotation.y = phase * TWO_PI * spin * 1.5;

  // Gentle breathing scale, also loop-synced (sin over a full period).
  const pulse = 1 + Math.sin( phase * TWO_PI ) * ( o.pulse ?? 0.08 );

  knot.scale.setScalar( pulse );

  // Keep every material/light property live so form edits show instantly.
  knot.material.color = toColor(
    THREE,
    o.color,
    [
      124,
      92,
      255
    ]
  );
  knot.material.metalness = o.metalness ?? 0.4;
  knot.material.roughness = o.roughness ?? 0.25;
  knot.material.wireframe = Boolean( o.wireframe );

  rimLight.color = toColor(
    THREE,
    o.accentColor,
    [
      80,
      170,
      255
    ]
  );
} );
