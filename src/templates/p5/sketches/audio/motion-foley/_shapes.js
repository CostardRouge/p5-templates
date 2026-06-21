/**
 * Shape library — the visual half of the motion-foley demo.
 *
 * Each category draws the single shape that best reads the gesture its sound
 * describes. A draw function receives the p5 instance and an `a` (animation)
 * bag:
 *
 *   - `progress`  0..1 over the active phase ( 0 while the tile is resting )
 *   - `cx, cy`    item center in canvas pixels
 *   - `size`      nominal item diameter in pixels
 *   - `color`     [ r, g, b ] base color
 *   - `stroke`    stroke weight in pixels
 *   - `seed`      deterministic per-item seed ( for shake / shatter scatter )
 *
 * Shapes never read the clock directly: everything is a pure function of
 * `progress`, so the visual and the scheduled audio stay locked together and a
 * recording reproduces the live preview exactly.
 */

import easing from "@/p5/utils/easing.js";

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
  // A dot that springs into being with a soft overshoot.
  appearing: (
    p, a
  ) => {
    const e = easing.easeOutBack( a.progress );
    const diameter = Math.max(
      0,
      a.size * e
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

  // A square that scales up from nothing.
  growing: (
    p, a
  ) => {
    const e = easing.easeOutCubic( a.progress );
    const side = a.size * e;

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

  // A square that collapses inward, fading as it goes.
  reducing: (
    p, a
  ) => {
    const e = easing.easeInCubic( a.progress );
    const side = a.size * ( 1 - e );

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

  // A square that rattles in place, hardest in the middle of the gesture.
  shaking: (
    p, a
  ) => {
    const envelope = Math.sin( a.progress * Math.PI );
    const amp = a.size * 0.28 * envelope;
    const dx = Math.sin( a.progress * TAU * 9 + a.seed * 6.28 ) * amp;
    const dy = Math.cos( a.progress * TAU * 11 + a.seed * 3.14 ) * amp;
    const wobble = Math.sin( a.progress * TAU * 13 ) * 0.12 * envelope;

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

  // A rounded bar that slides across the tile, with a motion-trail ghost.
  sliding: (
    p, a
  ) => {
    const e = easing.easeInOutCubic( a.progress );
    const travel = a.size * 1.1;
    const x = a.cx - travel / 2 + travel * e;
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

  // A disc that breathes in and back out of visibility.
  fading: (
    p, a
  ) => {
    const alpha = Math.sin( a.progress * Math.PI ) * 255;

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

  // A star that strobes between a bright and a dim state.
  flashing: (
    p, a
  ) => {
    const flashes = 4;
    const on = a.progress > 0 && ( a.progress * flashes ) % 1 < 0.5;
    const alpha = on ? 255 : 45;
    const radius = a.size * 0.5;

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

  // A hexagon that twists, with a counter-rotating squash wobble.
  twisting: (
    p, a
  ) => {
    const rotation = a.progress * TAU + Math.sin( a.progress * Math.PI * 4 ) * 0.5;
    const squash = 1 + Math.sin( a.progress * Math.PI * 4 ) * 0.18;

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

  // An ellipse pulled wide then snapped back, volume-preserving.
  stretching: (
    p, a
  ) => {
    const pull = easing.easeOutElastic( a.progress );
    const sx = 1 + pull * 1.1;
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

  // A disc that bursts into wedge shards flying outward.
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
      const alpha = 255 * ( 1 - a.progress );

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
