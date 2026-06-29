import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import {
  renderScribe
} from "@/p5/sketches/letter-trace/_shared.js";
import drawInstrument from "../_instrument.js";

// ─────────────────────────────────────────────────────────────────────────────
// SIGNALS — 06 / SCRIBE
//
// The author's own `letter-trace` engine (renderScribe): a single pen travels
// the outlines of a word letter by letter while the camera tracks the tip, then
// pulls back to reveal the whole word — the cinematic "writing" POV. Here it is
// wrapped in the SIGNALS identity, and the instrument frame becomes the most
// literal it has been in the series: a viewfinder / scope that the pen is being
// tracked inside, its telemetry reading the write progress as the glyph is
// plotted. Where 04/DECODE resolves a signal into a glyph and 05/FIELD scans a
// terrain, 06/SCRIBE *draws* — the instrument watching the pen.
//
// The engine owns the seamless loop (assemble → hold → dissolve envelope); we
// only mirror that envelope here to drive the telemetry readout.
// ─────────────────────────────────────────────────────────────────────────────

function clamp(
  value, min, max
) {
  return Math.min(
    max,
    Math.max(
      min,
      value
    )
  );
}

// Mirror of the engine's loopEnvelope, used only for the instrument telemetry.
function loopEnvelope(
  progression, assemble, hold
) {
  const a = clamp(
    assemble,
    0.01,
    1
  );
  const h = clamp(
    hold,
    0,
    Math.max(
      0,
      1 - a
    )
  );

  if ( progression < a ) {
    return {
      phase: "WRITE",
      amount: progression / a
    };
  }

  if ( progression < a + h ) {
    return {
      phase: "HOLD",
      amount: 1
    };
  }

  return {
    phase: "REVEAL",
    amount: 1
  };
}

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    0,
    0,
    0,
    255
  ] ) );

  renderScribe( o );

  // ── structural instrument frame (a scope tracking the pen) ──────────────────
  if ( o.hud?.show ?? true ) {
    const loop = o.loop ?? {};
    const env = loopEnvelope(
      animation.progression,
      loop.assemble ?? 0.7,
      loop.hold ?? 0.18
    );

    const text = ( o.text?.value ?? "" ).toString().toUpperCase();
    const letterCount = Math.max(
      1,
      text.replace(
        /\s/g,
        ""
      ).length
    );
    const current = clamp(
      Math.floor( env.amount * letterCount ),
      0,
      letterCount - 1
    ) + 1;
    const writePct = Math.round( env.amount * 100 );

    const margin = o.hud?.viewfinder ?? 0.12;

    drawInstrument(
      p,
      {
        box: {
          minX: p.width * margin,
          minY: p.height * 0.2,
          maxX: p.width * ( 1 - margin ),
          maxY: p.height * 0.8
        },
        head: {
          x: p.width / 2,
          y: p.height / 2
        },
        hudColor: o.hud?.color ?? [
          180,
          230,
          210
        ],
        label: o.hud?.label ?? "SIGNALS",
        spec: "SPEC.06 / SCRIBE",
        rows: [
          `PEN   ${ env.phase }`,
          `WRITE ${ String( writePct ).padStart(
            3,
            "0"
          ) }%`,
          `CHAR  ${ current }/${ letterCount }`,
          `PHASE ${ String( Math.round( ( animation.progression * 360 ) % 360 ) ).padStart(
            3,
            "0"
          ) }°`
        ]
      }
    );
  }
} );
