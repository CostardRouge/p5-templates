/**
 * Shape library — the visual half of the motion-foley demo.
 *
 * Each gesture draws the single shape that best reads the action its sound
 * describes. A draw function receives the p5 instance and an `a` (animation)
 * bag:
 *
 *   - `progress`  the *deformation* amount, 0..1. It rises 0→1 while the gesture
 *                 happens (tension) and falls 1→0 as it resolves (release), so a
 *                 shape simply reads `progress` to know how far it is bent out of
 *                 its rest pose — the same value drives the round-trip.
 *   - `phase`     "tension" | "hold" | "release" | "rest" — for the few shapes
 *                 whose look differs on the way back (e.g. flashing settles).
 *   - `time`      sketch seconds, for continuous oscillation (shake / strobe)
 *                 that must keep a steady rate independent of `progress`.
 *   - `cx, cy`    item center in canvas pixels
 *   - `size`      nominal item diameter in pixels
 *   - `color`     [ r, g, b ] base color
 *   - `seed`      deterministic per-item seed
 *
 * `progress` is already eased by the engine with the globally-chosen tension /
 * release easing, and the audio onsets are scheduled against that very same
 * curve — so the shape is seen in the same proportions as the sound is heard.
 * Shapes therefore consume `progress` directly and add no easing of their own.
 *
 * Everything is a pure function of these inputs, so the visual stays locked to
 * the scheduled audio and a recording reproduces the live preview exactly.
 */

const TAU = Math.PI * 2;

function rng( seed ) {
  const x = Math.sin( seed * 91.731 + 17.31 ) * 43758.5453;

  return x - Math.floor( x );
}

/** Regular polygon path, centered, rotation in radians. */
function polygon(
  p, cx, cy, radius, sides, rotation
) {
  p.beginShape();

  for ( let i = 0; i < sides; i++ ) {
    const angle = rotation + ( i / sides ) * TAU;

    p.vertex(
      cx + Math.cos( angle ) * radius,
      cy + Math.sin( angle ) * radius
    );
  }

  p.endShape( p.CLOSE );
}

const SHAPE_LIBRARY = {
  // A dot that grows into being, then shrinks away on release.
  appearing: (
    p, a
  ) => {
    const diameter = Math.max(
      0,
      a.size * a.progress
    );

    p.noStroke();
    p.fill(
      a.color[ 0 ],
      a.color[ 1 ],
      a.color[ 2 ],
      255 * Math.min(
        1,
        a.progress * 4
      )
    );
    p.circle(
      a.cx,
      a.cy,
      diameter
    );
  },

  // A square that scales up, then back down on release.
  growing: (
    p, a
  ) => {
    const side = a.size * a.progress;

    p.noStroke();
    p.fill(
      a.color[ 0 ],
      a.color[ 1 ],
      a.color[ 2 ],
      255
    );
    p.rectMode( p.CENTER );
    p.rect(
      a.cx,
      a.cy,
      side,
      side,
      side * 0.12
    );
  },

  // A square that collapses inward, then grows back on release.
  reducing: (
    p, a
  ) => {
    const side = a.size * ( 1 - a.progress );

    p.noStroke();
    p.fill(
      a.color[ 0 ],
      a.color[ 1 ],
      a.color[ 2 ],
      255 * ( 1 - a.progress * 0.6 )
    );
    p.rectMode( p.CENTER );
    p.rect(
      a.cx,
      a.cy,
      side,
      side,
      side * 0.12
    );
  },

  // A square that rattles in place; the amplitude follows `progress` so it
  // builds up and then damps down as the gesture resolves.
  shaking: (
    p, a
  ) => {
    const amp = a.size * 0.28 * a.progress;
    const dx = Math.sin( a.time * 38 + a.seed * 6.28 ) * amp;
    const dy = Math.cos( a.time * 44 + a.seed * 3.14 ) * amp;
    const wobble = Math.sin( a.time * 30 ) * 0.12 * a.progress;

    p.push();
    p.translate(
      a.cx + dx,
      a.cy + dy
    );
    p.rotate( wobble );
    p.noStroke();
    p.fill(
      a.color[ 0 ],
      a.color[ 1 ],
      a.color[ 2 ],
      255
    );
    p.rectMode( p.CENTER );
    p.rect(
      0,
      0,
      a.size * 0.8,
      a.size * 0.8,
      a.size * 0.1
    );
    p.pop();
  },

  // A rounded bar that slides across the tile, then slides home on release.
  sliding: (
    p, a
  ) => {
    const travel = a.size * 1.1;
    const x = a.cx - travel / 2 + travel * a.progress;
    const w = a.size * 1.1;
    const h = a.size * 0.5;

    p.noStroke();
    p.rectMode( p.CENTER );

    if ( a.progress > 0 && a.progress < 1 ) {
      p.fill(
        a.color[ 0 ],
        a.color[ 1 ],
        a.color[ 2 ],
        70
      );
      p.rect(
        x - travel * 0.08,
        a.cy,
        w,
        h,
        h * 0.5
      );
    }

    p.fill(
      a.color[ 0 ],
      a.color[ 1 ],
      a.color[ 2 ],
      255
    );
    p.rect(
      x,
      a.cy,
      w,
      h,
      h * 0.5
    );
  },

  // A disc whose opacity follows `progress`: it fades in on tension and fades
  // out on release.
  fading: (
    p, a
  ) => {
    const alpha = a.progress * 255;

    p.noStroke();
    p.fill(
      a.color[ 0 ],
      a.color[ 1 ],
      a.color[ 2 ],
      alpha
    );
    p.circle(
      a.cx,
      a.cy,
      a.size
    );
  },

  // A star that strobes during the action, then settles to a steady glow that
  // fades out as it resolves.
  flashing: (
    p, a
  ) => {
    const radius = a.size * 0.5;
    let alpha;

    if ( a.phase === "release" ) {
      alpha = a.progress * 255;
    } else {
      const on = a.progress > 0.08 && Math.sin( a.time * 42 ) > 0;

      alpha = on
        ? 255 * Math.min(
          1,
          a.progress * 1.5
        )
        : 45;
    }

    p.push();
    p.translate(
      a.cx,
      a.cy
    );
    p.noStroke();
    p.fill(
      a.color[ 0 ],
      a.color[ 1 ],
      a.color[ 2 ],
      alpha
    );
    p.beginShape();

    const points = 5;

    for ( let i = 0; i < points * 2; i++ ) {
      const angle = -Math.PI / 2 + ( i / ( points * 2 ) ) * TAU;
      const r = i % 2 === 0 ? radius : radius * 0.45;

      p.vertex(
        Math.cos( angle ) * r,
        Math.sin( angle ) * r
      );
    }

    p.endShape( p.CLOSE );
    p.pop();
  },

  // A hexagon that twists; `progress` drives the twist, so it winds up and then
  // unwinds back to rest on release.
  twisting: (
    p, a
  ) => {
    const rotation = a.progress * TAU * 0.75 + Math.sin( a.time * 8 ) * 0.1 * a.progress;
    const squash = 1 + Math.sin( a.progress * Math.PI ) * 0.18;

    p.push();
    p.translate(
      a.cx,
      a.cy
    );
    p.rotate( rotation );
    p.scale(
      squash,
      1 / squash
    );
    p.noStroke();
    p.fill(
      a.color[ 0 ],
      a.color[ 1 ],
      a.color[ 2 ],
      255
    );
    polygon(
      p,
      0,
      0,
      a.size * 0.5,
      6,
      0
    );
    p.pop();
  },

  // An ellipse pulled wide, then snapped back to a circle on release.
  stretching: (
    p, a
  ) => {
    const sx = 1 + a.progress * 1.1;
    const sy = 1 / sx;

    p.push();
    p.translate(
      a.cx,
      a.cy
    );
    p.scale(
      sx,
      sy
    );
    p.noStroke();
    p.fill(
      a.color[ 0 ],
      a.color[ 1 ],
      a.color[ 2 ],
      255
    );
    p.circle(
      0,
      0,
      a.size
    );
    p.pop();
  },

  // A disc that bursts into wedge shards, then draws them back together on
  // release — the object reassembles itself.
  breaking: (
    p, a
  ) => {
    const shards = 9;
    const radius = a.size * 0.5;

    p.push();
    p.translate(
      a.cx,
      a.cy
    );
    p.noStroke();

    for ( let i = 0; i < shards; i++ ) {
      const j = rng( i + a.seed * 10 + 1 );
      const angle = ( i / shards ) * TAU;
      const fly = a.progress * a.size * ( 0.4 + j * 0.8 );
      const spin = a.progress * ( j - 0.5 ) * 3;
      const alpha = 255 * ( 1 - a.progress * 0.7 );

      p.push();
      p.translate(
        Math.cos( angle ) * fly,
        Math.sin( angle ) * fly
      );
      p.rotate( spin );
      p.fill(
        a.color[ 0 ],
        a.color[ 1 ],
        a.color[ 2 ],
        alpha
      );
      p.beginShape();
      p.vertex(
        0,
        0
      );
      p.vertex(
        Math.cos( angle - 0.35 ) * radius,
        Math.sin( angle - 0.35 ) * radius
      );
      p.vertex(
        Math.cos( angle + 0.35 ) * radius,
        Math.sin( angle + 0.35 ) * radius
      );
      p.endShape( p.CLOSE );
      p.pop();
    }

    p.pop();
  }
};

export default SHAPE_LIBRARY;
