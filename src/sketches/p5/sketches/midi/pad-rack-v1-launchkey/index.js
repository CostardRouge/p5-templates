import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";

import {
  LAYERS
} from "./options";

// ─────────────────────────────────────────────────────────────────────────────
// pad-rack v1 — Launchkey.
//
// The demonstration rig for playing a sketch from a pad controller. The picture
// is the controller's own layout: a top row of eight tiles, one per voice
// effect, the selected one raised and glowing; a bottom row of eight segments,
// one per layer, lit while the layer is on; between them a field of particles
// that the seed lays out and the glow knob brightens.
//
// Nothing in here knows about MIDI. The effect is a select rendered as a row of
// buttons, the layers are checkboxes, the seed is a slider with a Randomize
// button beside it — and options.ts declares which pad drives which. This
// sketch only reads values, which is what lets the same picture come out of a
// headless export where no controller exists.
//
// Every motion is a function of the loop phase φ = animation.progression, so
// the loop is seamless and a capture reproduces the preview.
// ─────────────────────────────────────────────────────────────────────────────

const TAU = Math.PI * 2;

const EFFECTS = [
  "muffled",
  "8bit",
  "vbr",
  "laggy",
  "reversed",
  "mute",
  "talkbox",
  "formant"
];

const EFFECT_LABELS = {
  muffled: "MUFFLED",
  "8bit": "8-BIT",
  vbr: "VBR",
  laggy: "LAGGY",
  reversed: "REVERSED",
  mute: "MUTE",
  talkbox: "TALKBOX",
  formant: "FORMANT"
};

// A cheap deterministic hash → 0..1, so the particle field is a pure function
// of (seed, index) rather than of p5's noise state.
function hash01(
  seed, index
) {
  let value = ( seed * 374761393 + index * 668265263 ) >>> 0;

  value = ( value ^ ( value >>> 13 ) ) * 1274126177 >>> 0;

  return ( ( value ^ ( value >>> 16 ) ) >>> 0 ) / 4294967296;
}

sketch.setup(
  () => {},
  {}
);

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const rack = o.rack ?? {};
  const layers = rack.layers ?? {};
  const look = o.look ?? {};

  const seed = Math.max(
    1,
    Math.round( look.seed ?? 3 )
  );
  const glow = Math.max(
    0,
    Math.min(
      1,
      look.glow ?? 0.6
    )
  );
  const active = Math.max(
    0,
    EFFECTS.indexOf( rack.effect )
  );
  const phase = animation.progression;

  p.clear();
  p.background(
    12,
    13,
    18
  );

  const margin = p.width * 0.06;
  const gap = p.width * 0.012;
  const cell = ( p.width - 2 * margin - 7 * gap ) / 8;
  const topY = p.height * 0.12;
  const bottomY = p.height * 0.84;

  drawParticles(
    p,
    seed,
    glow,
    phase,
    topY + cell * 1.2,
    bottomY - cell * 0.6,
    layers
  );

  // ── Top row: the effects ───────────────────────────────────────────────
  p.noStroke();
  p.textAlign(
    p.CENTER,
    p.CENTER
  );

  for ( let index = 0; index < 8; index++ ) {
    const x = margin + index * ( cell + gap );
    const isActive = index === active;
    const lift = isActive ? cell * 0.18 : 0;

    if ( isActive ) {
      // The glow: a few translucent halos breathing with the loop.
      const breath = 0.5 + 0.5 * Math.sin( phase * TAU * 2 );

      for ( let ring = 4; ring >= 1; ring-- ) {
        const spread = ring * cell * 0.12 * ( 0.6 + 0.4 * breath ) * glow;

        p.fill(
          255,
          150,
          60,
          22 * glow
        );
        p.rect(
          x - spread,
          topY - lift - spread,
          cell + 2 * spread,
          cell + 2 * spread,
          cell * 0.12
        );
      }

      p.fill(
        255,
        150,
        60
      );
    } else {
      p.fill(
        38,
        40,
        48
      );
    }

    p.rect(
      x,
      topY - lift,
      cell,
      cell,
      cell * 0.1
    );

    p.fill( isActive ? p.color(
      20,
      12,
      6
    ) : p.color(
      140,
      144,
      160
    ) );
    p.textSize( cell * 0.13 );
    p.text(
      EFFECT_LABELS[ EFFECTS[ index ] ],
      x + cell / 2,
      topY - lift + cell / 2
    );
  }

  // ── Bottom row: the layers ─────────────────────────────────────────────
  const segH = cell * 0.5;

  LAYERS.forEach( (
    [
      key,
      label
    ], index
  ) => {
    const x = margin + index * ( cell + gap );
    const on = layers[ key ] === true;

    p.fill( on ? p.color(
      255,
      106,
      90
    ) : p.color(
      30,
      32,
      40
    ) );
    p.rect(
      x,
      bottomY,
      cell,
      segH,
      segH * 0.2
    );

    p.fill( on ? p.color(
      30,
      10,
      8
    ) : p.color(
      92,
      96,
      112
    ) );
    p.textSize( cell * 0.11 );
    p.text(
      label.toUpperCase(),
      x + cell / 2,
      bottomY + segH / 2
    );
  } );
} );

// The field between the rows: particles laid out by the seed, drifting with
// the loop. Each lit layer adds its own signature so the picture answers the
// pads — a lit tape hiss scatters, a lit sub rumble slows the drift.
function drawParticles(
  p, seed, glow, phase, top, bottom, layers
) {
  const count = 160;
  const hiss = layers.tapeHiss === true ? 1 : 0;
  const rumble = layers.subRumble === true ? 0.35 : 1;
  const lit = LAYERS.reduce(
    (
      total, [
        key
      ]
    ) => total + ( layers[ key ] === true ? 1 : 0 ),
    0
  );

  p.noStroke();

  for ( let index = 0; index < count; index++ ) {
    const u = hash01(
      seed,
      index
    );
    const v = hash01(
      seed,
      index + 1000
    );
    const w = hash01(
      seed,
      index + 2000
    );

    // Integer cycles per loop keep every drift seamless at the seam.
    const cycles = 1 + Math.floor( w * 3 );
    const drift = Math.sin( ( phase * cycles + u ) * TAU ) * rumble;
    const jitter = hiss * ( hash01(
      seed,
      index + 3000 + Math.floor( phase * 60 )
    ) - 0.5 ) * 0.02;

    const x = p.width * ( 0.08 + 0.84 * ( ( u + drift * 0.06 + jitter ) % 1 ) );
    const y = top + ( bottom - top ) * v;
    const size = 2 + w * 6 * ( 0.5 + 0.5 * glow ) + lit * 0.4;

    p.fill(
      200 + 55 * glow,
      160 + 40 * ( 1 - glow ),
      120,
      90 + 120 * glow
    );
    p.circle(
      x,
      y,
      size
    );
  }
}
