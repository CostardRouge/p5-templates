import string from "@/p5/utils/string.js";
import animation from "@/p5/utils/animation.js";

// ─────────────────────────────────────────────────────────────────────────────
// SIGNALS — shared instrument frame.
//
// The diegetic HUD that wraps every specimen in the series: a bounding box with
// bright corner ticks around the organism, a faint full-bleed crosshair plus a
// rotating reticle locked on a tracked point, and monospace telemetry that reads
// the live parameters of the form. Keeping it in one module is the whole point —
// it is the visual identity that ties the 5–10 videos into one designed series.
//
// The host canvas is P2D (screen space, top-left origin) for every specimen,
// including the shader-based ones, which composite their WebGL buffer onto the
// 2D canvas before this runs.
// ─────────────────────────────────────────────────────────────────────────────

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

/**
 * @param {object} p p5 instance
 * @param {object} cfg
 * @param {{minX,minY,maxX,maxY}} cfg.box   organism bounds in screen px
 * @param {{x,y}} cfg.head                  point the reticle locks onto
 * @param {number[]} [cfg.hudColor]         rgb
 * @param {string} [cfg.label]              big header (series name)
 * @param {string} [cfg.spec]               small header (specimen id)
 * @param {string[]} [cfg.rows]             telemetry lines, bottom-left
 * @param {number} [cfg.totalFrames]        loop length for the frame counter
 * @param {string} [cfg.format]             bottom-right format readout
 */
export default function drawInstrument(
  p, cfg
) {
  const {
    box,
    head,
    hudColor = [
      180,
      230,
      210
    ],
    label = "SIGNALS",
    spec = "",
    rows = [],
    totalFrames = 250,
    format = "1080×1920 · 25FPS"
  } = cfg;

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
  );
  corner(
    p,
    x1,
    y0,
    -tick,
    tick
  );
  corner(
    p,
    x0,
    y1,
    tick,
    -tick
  );
  corner(
    p,
    x1,
    y1,
    -tick,
    -tick
  );

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
  const frames = Math.round( animation.progression * totalFrames ) % totalFrames;
  const textFill = [
    hr,
    hg,
    hb
  ];

  const writeLine = (
    str, x, y, size, align
  ) => {
    string.write(
      str,
      x,
      y,
      {
        size,
        font,
        fill: textFill,
        stroke: false,
        strokeWeight: 0,
        textAlign: align
      }
    );
  };

  // header, top-left
  writeLine(
    label,
    margin,
    p.height * 0.085,
    big,
    [
      p.LEFT,
      p.BASELINE
    ]
  );

  if ( spec ) {
    writeLine(
      spec,
      margin,
      p.height * 0.085 + small * 1.6,
      small,
      [
        p.LEFT,
        p.BASELINE
      ]
    );
  }

  // live readouts, bottom band
  rows.forEach( (
    rowText, i
  ) => {
    writeLine(
      rowText,
      margin,
      p.height * ( 0.90 + i * 0.026 ),
      small,
      [
        p.LEFT,
        p.BASELINE
      ]
    );
  } );

  // format / frame counter, bottom-right
  writeLine(
    format,
    p.width - margin,
    p.height * 0.90,
    small,
    [
      p.RIGHT,
      p.BASELINE
    ]
  );
  writeLine(
    `FRM ${ String( frames ).padStart(
      3,
      "0"
    ) }/${ totalFrames }`,
    p.width - margin,
    p.height * 0.90 + small * 1.6,
    small,
    [
      p.RIGHT,
      p.BASELINE
    ]
  );

  p.pop();
}
