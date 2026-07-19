import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";

import colors from "@/p5/utils/colors.js";
import string from "@/p5/utils/string.js";
import animation from "@/p5/utils/animation.js";

import scripts from "@/p5/utils/scripts.js";
import Matter from "@/public/assets/libraries/matter.min.js";

// Matter's concave-decomposition dependency (loaded once); the letter bodies are
// plain rectangles, but this keeps parity with the other Matter sketches.
scripts.load( "/assets/libraries/decomp.min.js" );

const {
  Engine,
  Bodies,
  Composite,
  Body
} = Matter;

// ─────────────────────────────────────────────────────────────────────────────
// physics-type v1 — letter drop.
//
// The letters of a phrase rain down one by one under real gravity, tumble, and
// pile up on the floor — the endlessly re-watchable "dump the type" loop.
//
// Physics doesn't loop on its own, so the whole simulation is a pure function of
// the loop phase φ = animation.progression ∈ [0,1): φ maps to a step count, and
// the sketch advances the Matter world to exactly that many fixed-dt steps every
// frame. Because the layout is laid out from a fixed seed and Matter is
// deterministic, the same φ always yields the same frame — so the recorded clip
// is reproducible and the live preview, the scrubber and the export all agree.
//
// The stepping is cached and incremental: normal forward playback advances one
// step at a time (O(1) per frame); only a phase REWIND (the loop wrapping from
// ~1 back to 0, or a manual scrub backwards) rebuilds the world from zero and
// fast-forwards to the requested step. The loop reads as: empty → letters rain
// and settle into a pile → hold on the settled pile → cut back to empty.
// ─────────────────────────────────────────────────────────────────────────────

// Fixed physics timestep (ms). Matches Matter's tuned 60 Hz update so the fall
// feels natural and the sim stays stable regardless of the render framerate.
const DT = 1000 / 60;

// Safety cap on how many physics steps a single frame may run (only ever hit by
// a big backward scrub); keeps one frame from locking the tab.
const MAX_STEPS_PER_FRAME = 6000;

const state = {
  signature: null,
  engine: null,
  letters: [],
  builtSteps: 0
};

// Small deterministic PRNG (mulberry32) so the layout never touches — or is
// disturbed by — p5's global random stream.
function makeRandom( seed ) {
  let a = seed >>> 0;

  return function() {
    a |= 0;
    a = ( a + 0x6d2b79f5 ) | 0;
    let t = Math.imul(
      a ^ ( a >>> 15 ),
      1 | a
    );

    t = ( t + Math.imul(
      t ^ ( t >>> 7 ),
      61 | t
    ) ) ^ t;

    return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;
  };
}

sketch.setup(
  () => {},
  {}
);

sketch.draw( () => {
  const p = getP5();

  const o = options.sketch ?? {};
  const text = o.text ?? {};
  const physics = o.physics ?? {};
  const scene = o.scene ?? {};
  const background = scene.backgroundColor ?? [
    12,
    12,
    16
  ];

  p.clear();
  p.background( ...background );

  const params = resolveParams(
    p,
    text,
    physics,
    scene
  );

  ensureSim(
    p,
    params
  );

  const totalSteps = simLength( params );
  const targetSteps = Math.round( animation.progression * totalSteps );

  stepTo(
    p,
    params,
    targetSteps
  );

  drawFloor(
    p,
    params,
    scene
  );
  drawLetters(
    p,
    params,
    text
  );
} );

// Gather every value the simulation depends on, resolved against defaults, into
// one object — both the sim and the rebuild-signature read from it.
function resolveParams(
  p, text, physics, scene
) {
  const content = text.content ?? "DROP";
  const size = ( text.size ?? 0.14 ) * p.width;
  const chars = [
    ...content
  ].filter( ( char ) => char.trim() !== "" );

  return {
    content,
    chars,
    size,
    font: text.font ?? "martian",
    margin: ( scene.margin ?? 0.06 ) * p.width,
    floorY: p.height - ( scene.floor ?? 0.08 ) * p.height,
    gravity: physics.gravity ?? 1.1,
    restitution: physics.bounce ?? 0.35,
    friction: physics.friction ?? 0.35,
    dropSpread: Math.max(
      1,
      Math.round( physics.dropSpread ?? 7 )
    ),
    settleSteps: Math.max(
      1,
      Math.round( physics.settleSteps ?? 130 )
    ),
    spin: physics.spin ?? 0.25,
    seed: Math.round( physics.seed ?? 7 ),
    width: p.width,
    height: p.height
  };
}

// Total sim steps mapped across one loop: enough for the last letter to spawn
// and the whole pile to settle, so φ=1 lands on a resolved pile.
function simLength( params ) {
  return params.chars.length * params.dropSpread + params.settleSteps;
}

function signature( params ) {
  return [
    params.content,
    params.font,
    params.size,
    params.margin,
    params.floorY,
    params.gravity,
    params.restitution,
    params.friction,
    params.dropSpread,
    params.spin,
    params.seed,
    params.width,
    params.height
  ].join( ":" );
}

function ensureSim(
  p, params
) {
  const sig = signature( params );

  if ( sig !== state.signature ) {
    buildSim(
      p,
      params
    );
    state.signature = sig;
  }
}

// (Re)create the world and the letter layout from the fixed seed. Bodies are NOT
// added here — each letter is spawned when its drop step is reached, so the same
// build + step sequence always reproduces the same frames.
function buildSim(
  p, params
) {
  const engine = Engine.create();

  engine.gravity = {
    x: 0,
    y: params.gravity,
    scale: 0.001
  };
  engine.enableSleeping = true;

  const thickness = 200;
  const inset = params.margin;

  addStatic(
    engine,
    params.width / 2,
    params.floorY + thickness / 2,
    params.width * 2,
    thickness
  );
  addStatic(
    engine,
    inset - thickness / 2,
    params.height / 2,
    thickness,
    params.height * 3
  );
  addStatic(
    engine,
    params.width - inset + thickness / 2,
    params.height / 2,
    thickness,
    params.height * 3
  );

  state.engine = engine;
  state.letters = layoutLetters(
    p,
    params
  );
  state.builtSteps = 0;
}

function layoutLetters(
  p, params
) {
  const random = makeRandom( params.seed );
  const font = string.fonts?.[ params.font ] ?? string.fonts.martian;
  const fontReady = Boolean( font?.data );

  if ( fontReady ) {
    p.push();
    p.textFont( font );
    p.textSize( params.size );
  }

  const letters = params.chars.map( (
    char, index
  ) => {
    const measured = fontReady ? p.textWidth( char ) : params.size * 0.6;
    const w = Math.min(
      Math.max(
        measured + params.size * 0.12,
        params.size * 0.35
      ),
      params.size * 1.5
    );
    const h = params.size;

    const minX = params.margin + w / 2 + 6;
    const maxX = params.width - params.margin - w / 2 - 6;
    const spawnX = minX + random() * Math.max(
      1,
      maxX - minX
    );

    return {
      char,
      index,
      w,
      h,
      spawnX,
      spawnStep: index * params.dropSpread,
      angle: ( random() - 0.5 ) * 0.6,
      angularVelocity: ( random() - 0.5 ) * params.spin,
      driftX: ( random() - 0.5 ) * 2,
      body: null
    };
  } );

  if ( fontReady ) {
    p.pop();
  }

  return letters;
}

// Advance the world to exactly `target` steps. Forward playback steps one at a
// time; any rewind rebuilds from zero first so the result is identical to having
// played straight through.
function stepTo(
  p, params, target
) {
  if ( target < state.builtSteps ) {
    buildSim(
      p,
      params
    );
  }

  let budget = MAX_STEPS_PER_FRAME;

  while ( state.builtSteps < target && budget-- > 0 ) {
    const step = state.builtSteps;

    for ( const letter of state.letters ) {
      if ( letter.spawnStep === step && !letter.body ) {
        spawnLetter(
          params,
          letter
        );
      }
    }

    Engine.update(
      state.engine,
      DT
    );
    state.builtSteps++;
  }
}

function spawnLetter(
  params, letter
) {
  const body = Bodies.rectangle(
    letter.spawnX,
    -letter.h,
    letter.w,
    letter.h,
    {
      restitution: params.restitution,
      friction: params.friction,
      frictionStatic: params.friction + 0.2,
      chamfer: {
        radius: Math.min(
          letter.w,
          letter.h
        ) * 0.12
      }
    }
  );

  Body.setAngle(
    body,
    letter.angle
  );
  Body.setVelocity(
    body,
    {
      x: letter.driftX,
      y: 0
    }
  );
  Body.setAngularVelocity(
    body,
    letter.angularVelocity
  );

  Composite.add(
    state.engine.world,
    body
  );

  letter.body = body;
}

function drawFloor(
  p, params, scene
) {
  if ( !( scene.showFloor ?? true ) ) {
    return;
  }

  p.push();
  p.stroke( ...( scene.floorColor ?? [
    60,
    60,
    70
  ] ) );
  p.strokeWeight( scene.floorWeight ?? 3 );
  p.line(
    params.margin,
    params.floorY,
    params.width - params.margin,
    params.floorY
  );
  p.pop();
}

function drawLetters(
  p, params, text
) {
  const font = string.fonts?.[ params.font ] ?? string.fonts.martian;
  const rainbow = ( text.colorMode ?? "rainbow" ) === "rainbow";
  const fill = text.fill ?? [
    245,
    240,
    230
  ];
  const total = Math.max(
    1,
    state.letters.length
  );

  p.push();

  if ( font?.data ) {
    p.textFont( font );
  }

  p.textSize( params.size );
  p.textAlign(
    p.CENTER,
    p.CENTER
  );
  p.noStroke();

  for ( const letter of state.letters ) {
    if ( !letter.body ) {
      continue;
    }

    const {
      x, y
    } = letter.body.position;

    if ( rainbow ) {
      p.fill( colors.rainbow( {
        hueOffset: 0,
        hueIndex: ( letter.index / total ) * Math.PI * 2 * ( text.hueSpread ?? 1 )
      } ) );
    } else {
      p.fill( ...fill );
    }

    p.push();
    p.translate(
      x,
      y
    );
    p.rotate( letter.body.angle );
    p.text(
      letter.char,
      0,
      0
    );
    p.pop();
  }

  p.pop();
}

function addStatic(
  engine, x, y, w, h
) {
  Composite.add(
    engine.world,
    Bodies.rectangle(
      x,
      y,
      w,
      h,
      {
        isStatic: true
      }
    )
  );
}
