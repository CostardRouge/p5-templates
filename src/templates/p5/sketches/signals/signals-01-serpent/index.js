import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";

import converters from "@/p5/utils/converters.js";
import animation from "@/p5/utils/animation.js";
import audio from "@/p5/utils/audio.js";
import string from "@/p5/utils/string.js";

// ─────────────────────────────────────────────────────────────────────────────
// SIGNALS — 01 / SERPENT  (hero piece, Demo Festival 2027)
//
// A rebirth of the very first "churros v5 — serpent": the flowing ribbon of
// rotating, coloured line-segments that threaded a horizontal sine wave. Here it
// is re-authored for a vertical 9:16 city screen and wrapped in a *diegetic
// instrument*: the piece appears to measure itself. A structural HUD (bounding
// box, corner ticks, crosshair reticle, monospace telemetry) frames the organism
// and reads its live parameters — amplitude, phase, frequency — straight off the
// maths driving the form. Motion makes sound: each time the head crosses the
// centre axis a soft, position-pitched tone fires.
//
// Identity rules for the whole SIGNALS series:
//   • pure black ground, one hero form, generous margins (glanceable from a
//     street at a distance);
//   • a *low-saturation* iridescent palette (oil-slick, not Instagram-rainbow);
//   • a structural monospace instrument frame;
//   • a seamless 10 s loop (250 frames @ 25 fps) driven by animation.angle so the
//     deterministic recorder closes the loop and the audio renders offline.
// ─────────────────────────────────────────────────────────────────────────────

// Track the head's signed offset from the centre axis between frames so we can
// fire a tone exactly on each zero-crossing (deterministic in capture mode).
let lastHeadSign = 0;

sketch.setup( () => {} );

/**
 * Low-saturation iridescent colour. Base is the IQ cosine "oil-slick" spectrum;
 * we then pull it toward its own luminance by (1 - saturation) so the palette
 * stays elegant and reads cleanly on outdoor screens instead of going garish.
 *
 * @returns {[number, number, number]} rgb in 0..255
 */
function iridescent(
  p, t, saturation
) {
  const r = 0.5 + 0.5 * p.cos( p.TAU * ( t + 0.00 ) );
  const g = 0.5 + 0.5 * p.cos( p.TAU * ( t + 0.33 ) );
  const b = 0.5 + 0.5 * p.cos( p.TAU * ( t + 0.67 ) );

  const lum = 0.30 * r + 0.59 * g + 0.11 * b;
  const s = saturation;

  return [
    ( lum + ( r - lum ) * s ) * 255,
    ( lum + ( g - lum ) * s ) * 255,
    ( lum + ( b - lum ) * s ) * 255
  ];
}

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};

  // ── parameters ──────────────────────────────────────────────────────────────
  const quality = o.shape?.quality ?? 520;
  const verticalMargin = ( o.shape?.verticalMargin ?? 0.12 ) * p.height;
  const amplitude = ( o.shape?.amplitude ?? 0.30 ) * p.width;
  const frequency = o.shape?.frequency ?? 2; // integer → seamless loop
  const breath = o.shape?.breath ?? 0.18;

  const maxLines = o.lines?.maxCount ?? 3;
  const changeLines = o.lines?.changeOverTime ?? true;
  const lineLength = ( o.lines?.length ?? 0.07 ) * p.width;
  const lineWeight = ( o.lines?.weight ?? 0.022 ) * p.width;
  const lineAngleSpan = o.lines?.angleSpan ?? p.PI;

  const saturation = o.palette?.saturation ?? 0.38;
  const hueSpeed = o.palette?.hueSpeed ?? 1; // integer → seamless loop
  const hueSpread = o.palette?.hueSpread ?? 1.4;

  const rotationSpeed = o.rotation?.speed ?? 1; // integer → seamless loop
  const rotationCount = o.rotation?.count ?? 1;

  // ── clock ─────────────────────────────────────────────────────────────────
  // animation.angle is TAU·progression: it sweeps 0 → TAU across the loop, so any
  // integer multiple of it closes seamlessly at the recording boundary.
  const time = animation.angle;
  const centerX = p.width / 2;

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    0,
    0,
    0,
    255
  ] ) );

  // ── trace the spine, sampling geometry for the instrument as we go ──────────
  const lerpMin = -p.PI;
  const lerpMax = p.PI;
  const lerpStep = ( lerpMax - lerpMin ) / quality;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let headX = centerX, headY = verticalMargin;
  let liveAmp = 0;

  p.push();

  for ( let s = lerpMin; s <= lerpMax; s += lerpStep ) {
    // Travel down the long (vertical) axis; undulate across the short axis.
    const y = p.map(
      s,
      lerpMin,
      lerpMax,
      verticalMargin,
      p.height - verticalMargin
    );

    // A breathing wave: the amplitude itself swells and recedes over the loop.
    const swell = 1 - breath + breath * p.cos( s * 2 - time );
    const x = centerX + p.sin( s * frequency + time ) * amplitude * swell;

    if ( x < minX ) {
      minX = x;
    }
    if ( x > maxX ) {
      maxX = x;
    }
    if ( y < minY ) {
      minY = y;
    }
    if ( y > maxY ) {
      maxY = y;
    }

    // The "head" leads the spine — the point the instrument locks its reticle on.
    if ( s <= lerpMin + lerpStep ) {
      headX = x;
      headY = y;
      liveAmp = ( x - centerX ) / amplitude;
    }

    // How many segments fan out of this rib (the churros texture).
    let linesCount = maxLines;

    if ( changeLines ) {
      linesCount = p.map(
        p.cos( s / 2 - time ),
        -1,
        1,
        1,
        maxLines,
        true
      );
    }

    const lineStep = lineAngleSpan / linesCount;

    p.push();
    p.translate(
      x,
      y
    );
    p.rotate( time * rotationSpeed + s * rotationCount );

    for ( let a = 0; a < lineAngleSpan; a += lineStep ) {
      const v = converters.polar.vector(
        a,
        lineLength
      );

      const hue = ( ( hueSpeed * time ) / p.TAU + s * hueSpread / p.TAU ) % 1;
      const [
        r,
        g,
        b
      ] = iridescent(
        p,
        hue,
        saturation
      );

      p.stroke(
        r,
        g,
        b,
        210
      );
      p.strokeWeight( lineWeight );
      p.line(
        v.x,
        v.y,
        -v.x,
        -v.y
      );
    }

    p.pop();
  }

  p.pop();

  // ── structural instrument frame ─────────────────────────────────────────────
  if ( o.hud?.show ?? true ) {
    drawInstrument(
      p,
      {
        box: {
          minX,
          minY,
          maxX,
          maxY
        },
        head: {
          x: headX,
          y: headY
        },
        amp: liveAmp,
        frequency,
        maxLines,
        hudColor: o.hud?.color ?? [
          180,
          230,
          210
        ],
        label: o.hud?.label ?? "SIGNALS"
      }
    );
  }

  // ── motion → sound: fire on each centre-axis crossing of the head ───────────
  if ( o.audio?.enabled ?? false ) {
    const sign = Math.sign( headX - centerX );

    if ( sign !== 0 && lastHeadSign !== 0 && sign !== lastHeadSign ) {
      const base = o.audio?.baseFreq ?? 220;
      const span = o.audio?.freqSpan ?? 660;
      const freq =
        base + span * ( 1 - ( headY - verticalMargin ) / ( p.height - 2 * verticalMargin ) );

      audio.trigger(
        "bounce",
        {
          freq,
          duration: o.audio?.duration ?? 0.22,
          gain: o.audio?.gain ?? 0.28,
          attack: 0.003
        }
      );
    }

    if ( sign !== 0 ) {
      lastHeadSign = sign;
    }
  }
} );

/**
 * The diegetic instrument: a bounding box with corner ticks around the organism,
 * a crosshair + rotating reticle locked on the head, and monospace telemetry that
 * reads the live parameters of the form.
 */
function drawInstrument(
  p, data
) {
  const {
    box, head, amp, frequency, maxLines, hudColor, label
  } = data;

  const [
    hr,
    hg,
    hb
  ] = hudColor;
  const font = string.fonts.spaceMonoRegular;
  const pad = p.width * 0.04;

  const x0 = box.minX - pad;
  const y0 = box.minY - pad;
  const x1 = box.maxX + pad;
  const y1 = box.maxY + pad;

  p.push();

  // crosshair through the head — thin, full-bleed
  p.stroke(
    hr,
    hg,
    hb,
    60
  );
  p.strokeWeight( Math.max(
    1,
    p.width * 0.0012
  ) );
  p.line(
    0,
    head.y,
    p.width,
    head.y
  );
  p.line(
    head.x,
    0,
    head.x,
    p.height
  );

  // bounding box (faint) + corner ticks (bright)
  const tick = p.width * 0.03;

  p.noFill();
  p.stroke(
    hr,
    hg,
    hb,
    40
  );
  p.rect(
    x0,
    y0,
    x1 - x0,
    y1 - y0
  );

  p.stroke(
    hr,
    hg,
    hb,
    220
  );
  p.strokeWeight( Math.max(
    1.5,
    p.width * 0.0022
  ) );
  corner(
    p,
    x0,
    y0,
    tick,
    tick
  ); // top-left
  corner(
    p,
    x1,
    y0,
    -tick,
    tick
  ); // top-right
  corner(
    p,
    x0,
    y1,
    tick,
    -tick
  ); // bottom-left
  corner(
    p,
    x1,
    y1,
    -tick,
    -tick
  ); // bottom-right

  // rotating reticle on the head
  p.push();
  p.translate(
    head.x,
    head.y
  );
  p.rotate( animation.angle );
  p.noFill();
  p.stroke(
    hr,
    hg,
    hb,
    230
  );
  const r = p.width * 0.022;

  p.rect(
    -r,
    -r,
    r * 2,
    r * 2
  );
  p.pop();

  // ── telemetry text ──────────────────────────────────────────────────────────
  const big = p.width * 0.034;
  const small = p.width * 0.020;
  const margin = p.width * 0.06;
  const frames = Math.round( animation.progression * 250 ) % 250;
  const phaseDeg = Math.round( ( animation.progression * 360 ) % 360 );

  // header, top-left
  string.write(
    label,
    margin,
    p.height * 0.085,
    {
      size: big,
      font,
      fill: [
        hr,
        hg,
        hb
      ],
      stroke: false,
      strokeWeight: 0,
      textAlign: [
        p.LEFT,
        p.BASELINE
      ]
    }
  );
  string.write(
    "SPEC.01 / SERPENT",
    margin,
    p.height * 0.085 + small * 1.6,
    {
      size: small,
      font,
      fill: [
        hr,
        hg,
        hb
      ],
      stroke: false,
      strokeWeight: 0,
      textAlign: [
        p.LEFT,
        p.BASELINE
      ]
    }
  );

  // live readouts, bottom band
  const rows = [
    `AMP   ${ amp >= 0 ? "+" : "" }${ amp.toFixed( 2 ) }`,
    `PHASE ${ String( phaseDeg ).padStart(
      3,
      "0"
    ) }°`,
    `FREQ  ${ frequency.toFixed( 2 ) } Hz`,
    `FANS  ${ maxLines.toFixed( 1 ) }`
  ];

  rows.forEach( (
    rowText, i
  ) => {
    string.write(
      rowText,
      margin,
      p.height * ( 0.90 + i * 0.026 ),
      {
        size: small,
        font,
        fill: [
          hr,
          hg,
          hb
        ],
        stroke: false,
        strokeWeight: 0,
        textAlign: [
          p.LEFT,
          p.BASELINE
        ]
      }
    );
  } );

  // resolution / frame counter, bottom-right
  string.write(
    "1080×1920 · 25FPS",
    p.width - margin,
    p.height * 0.90,
    {
      size: small,
      font,
      fill: [
        hr,
        hg,
        hb
      ],
      stroke: false,
      strokeWeight: 0,
      textAlign: [
        p.RIGHT,
        p.BASELINE
      ]
    }
  );
  string.write(
    `FRM ${ String( frames ).padStart(
      3,
      "0"
    ) }/250`,
    p.width - margin,
    p.height * 0.90 + small * 1.6,
    {
      size: small,
      font,
      fill: [
        hr,
        hg,
        hb
      ],
      stroke: false,
      strokeWeight: 0,
      textAlign: [
        p.RIGHT,
        p.BASELINE
      ]
    }
  );

  p.pop();
}

/** Draw an L-shaped corner tick anchored at (x, y), arms running by (dx, dy). */
function corner(
  p, x, y, dx, dy
) {
  p.line(
    x,
    y,
    x + dx,
    y
  );
  p.line(
    x,
    y,
    x,
    y + dy
  );
}
