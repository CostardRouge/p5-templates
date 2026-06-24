// ── Interactive binding demo ────────────────────────────────────────────────
// Proves the interactive-bindings MVP end to end. This sketch contains NO
// interaction code: it just reads plain parameters off `options.sketch`. The
// bindings declared in options.ts (resolved inside the options proxy) modulate
// those parameters live from interaction channels:
//
//   position     ← mouse           (vector2d passthrough — ring follows cursor)
//   strokeWeight ← mouse.y         (thicker toward the bottom)
//   count        ← mouse.x         (more dots toward the right)
//   radius       ← oscillator      (sine; pulses on its own, no input needed)
//   spin         ← oscillator      (sawtooth; always rotating)
//
// Move the mouse over the canvas to drive it; leave it idle and the oscillator
// keeps the ring breathing and spinning.

import options from "@/p5/utils/options.js";
import sketch from "@/p5/utils/sketch.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

function numberOr(
  value, fallback
) {
  return typeof value === "number" && Number.isFinite( value ) ? value : fallback;
}

sketch.draw( () => {
  const p = getP5();
  const s = options.sketch ?? {};

  const background = s.backgroundColor ?? [
    12,
    12,
    16
  ];
  const dotColor = s.dotColor ?? [
    235,
    240,
    255
  ];

  const radius = numberOr(
    s.radius,
    160
  );
  const strokeWeight = numberOr(
    s.strokeWeight,
    6
  );
  const count = Math.max(
    1,
    Math.round( numberOr(
      s.count,
      8
    ) )
  );
  const spin = numberOr(
    s.spin,
    0
  );

  const position = s.position ?? {};
  const cx = numberOr(
    position.x,
    0.5
  ) * p.width;
  const cy = numberOr(
    position.y,
    0.5
  ) * p.height;

  p.clear();
  p.background( ...background );

  // ── Ring of dots ──────────────────────────────────────────────────────────
  p.push();
  p.translate(
    cx,
    cy
  );
  p.rotate( spin );

  const dotSize = strokeWeight * 2 + 6;

  p.noFill();
  p.stroke( ...dotColor );
  p.strokeWeight( Math.max(
    0.5,
    strokeWeight * 0.5
  ) );
  p.beginShape();

  for ( let i = 0; i < count; i++ ) {
    const angle = ( i / count ) * Math.PI * 2;

    p.vertex(
      Math.cos( angle ) * radius,
      Math.sin( angle ) * radius
    );
  }

  p.endShape( p.CLOSE );

  p.noStroke();
  p.fill( ...dotColor );

  for ( let i = 0; i < count; i++ ) {
    const angle = ( i / count ) * Math.PI * 2;

    p.circle(
      Math.cos( angle ) * radius,
      Math.sin( angle ) * radius,
      dotSize
    );
  }

  p.pop();

  // ── Live readout so the modulation is legible ───────────────────────────────
  const lines = [
    "interactive bindings — live values",
    "",
    `position      ${ numberOr(
      position.x,
      0.5
    ).toFixed( 2 ) }, ${ numberOr(
      position.y,
      0.5
    ).toFixed( 2 ) }   ← mouse`,
    `strokeWeight  ${ strokeWeight.toFixed( 1 ) }   ← mouse.y`,
    `count         ${ count }   ← mouse.x`,
    `radius        ${ radius.toFixed( 0 ) }   ← oscillator (sine)`,
    `spin          ${ spin.toFixed( 2 ) }   ← oscillator (saw)`
  ];

  p.push();
  p.noStroke();
  p.fill( ...dotColor );
  p.textSize( 15 );
  p.textFont( "monospace" );
  p.textAlign(
    p.LEFT,
    p.TOP
  );

  lines.forEach( (
    line, i
  ) => {
    p.text(
      line,
      24,
      24 + i * 20
    );
  } );

  p.pop();
} );
