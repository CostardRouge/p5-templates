import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import {
  disposeInteraction,
  getAudio,
  getPointers,
  initInteraction
} from "@/p5/utils/interaction/index.js";

const BAND_ORDER = [
  "subBass",
  "bass",
  "lowMid",
  "mid",
  "highMid",
  "presence",
  "brilliance"
];

const BAND_LABELS = {
  subBass: "sub",
  bass: "bass",
  lowMid: "lo-mid",
  mid: "mid",
  highMid: "hi-mid",
  presence: "pres",
  brilliance: "brill"
};

sketch.setup( async() => {
  await initInteraction( options.sketch?.interaction ?? {} );
} );

sketch.draw( () => {
  const p = getP5();
  const interaction = options.sketch?.interaction ?? {};
  const showLabels = options.sketch?.showLabels !== false;
  const bg = options.sketch?.backgroundColor ?? [
    8,
    8,
    14
  ];

  // Pump the interaction system so audio features are computed this frame.
  getPointers( interaction );

  const audio = getAudio();

  // ── Background: hue follows spectral centroid (0–8 kHz → 0–360°) ─────────
  if ( audio.enabled && audio.spectral ) {
    p.push();
    p.colorMode(
      p.HSB,
      360,
      100,
      100,
      255
    );
    const hue = p.map(
      Math.min(
        8000,
        audio.spectral.centroid ?? 0
      ),
      0,
      8000,
      220,
      360,
      true
    );

    p.background(
      hue,
      18,
      8
    );
    p.pop();
  } else {
    p.background( ...bg );
  }

  // ── Microphone-not-ready hint ─────────────────────────────────────────────
  if ( !audio.enabled ) {
    p.noStroke();
    p.fill(
      230,
      230,
      230,
      180
    );
    p.textAlign(
      p.CENTER,
      p.CENTER
    );
    p.textSize( 18 );
    p.text(
      "click the canvas and allow microphone access",
      p.width / 2,
      p.height / 2
    );

    return;
  }

  _drawBands(
    p,
    audio,
    showLabels
  );
  _drawKick(
    p,
    audio
  );
  _drawOnset(
    p,
    audio
  );
  _drawPitch(
    p,
    audio,
    showLabels
  );

  if ( showLabels ) {
    _drawLabels(
      p,
      audio
    );
  }
} );

sketch.cleanup?.( () => {
  disposeInteraction();
} );

// ── Visual modules ─────────────────────────────────────────────────────────

function _drawBands(
  p, audio, showLabels
) {
  if ( !audio.bands ) {
    return;
  }

  const margin = 24;
  const slotW = ( p.width * 0.45 ) / BAND_ORDER.length;
  const maxH = p.height * 0.6;
  const baseY = p.height - margin;

  p.noStroke();

  BAND_ORDER.forEach( (
    name, i
  ) => {
    const v = audio.bands[ name ] ?? 0;
    const h = v * maxH;
    const x = margin + i * slotW;

    p.fill(
      255,
      255,
      255,
      40
    );
    p.rect(
      x,
      baseY - maxH,
      slotW - 6,
      maxH
    );
    p.fill(
      255,
      255,
      255,
      220
    );
    p.rect(
      x,
      baseY - h,
      slotW - 6,
      h
    );

    if ( showLabels ) {
      p.fill(
        220,
        220,
        220,
        220
      );
      p.textAlign(
        p.LEFT,
        p.TOP
      );
      p.textSize( 10 );
      p.text(
        BAND_LABELS[ name ],
        x,
        baseY + 4
      );
    }
  } );
}

function _drawKick(
  p, audio
) {
  const k = audio.kick ?? {};
  const baseR = Math.min(
    p.width,
    p.height
  ) * 0.18;
  const pulse = ( k.strength ?? 0 ) * baseR;
  const r = baseR + pulse;
  const alpha = 60 + ( k.strength ?? 0 ) * 195;

  p.noFill();
  p.stroke(
    255,
    90,
    120,
    alpha
  );
  p.strokeWeight( 4 + pulse * 0.15 );
  p.circle(
    p.width / 2,
    p.height / 2,
    r * 2
  );
}

function _drawOnset(
  p, audio
) {
  const o = audio.onset ?? {};
  const s = o.strength ?? 0;

  if ( s <= 0.01 ) {
    return;
  }

  const r = Math.min(
    p.width,
    p.height
  ) * ( 0.28 + s * 0.12 );

  p.noFill();
  p.stroke(
    180,
    230,
    255,
    s * 200
  );
  p.strokeWeight( 2 );
  p.circle(
    p.width / 2,
    p.height / 2,
    r * 2
  );
}

function _drawPitch(
  p, audio, showLabels
) {
  const pt = audio.pitch ?? {};
  const conf = pt.confidence ?? 0;

  if ( conf < 0.25 ) {
    return;
  }

  const midi = pt.midi ?? 0;
  const y = p.map(
    midi,
    24,
    96,
    p.height - 40,
    40,
    true
  );

  p.stroke(
    255,
    230,
    120,
    50 + conf * 180
  );
  p.strokeWeight( 1 );
  p.line(
    0,
    y,
    p.width,
    y
  );

  if ( showLabels ) {
    p.noStroke();
    p.fill(
      255,
      230,
      120,
      220
    );
    p.textAlign(
      p.RIGHT,
      p.CENTER
    );
    p.textSize( 11 );
    p.text(
      `${ pt.hz.toFixed( 0 ) } Hz · midi ${ midi.toFixed( 1 ) }`,
      p.width - 12,
      y - 10
    );
  }
}

function _drawLabels(
  p, audio
) {
  const v = audio.voice ?? {};
  const sp = audio.spectral ?? {};
  const inst = audio.instruments ?? {};
  const lineH = 16;
  let y = 18;

  p.noStroke();
  p.textAlign(
    p.LEFT,
    p.CENTER
  );
  p.textSize( 11 );

  const lines = [
    v.active ? `VOICE  conf=${ v.confidence.toFixed( 2 ) }` : `voice  conf=${ v.confidence.toFixed( 2 ) }`,
    `centroid  ${ Math.round( sp.centroid ?? 0 ) } Hz`,
    `flatness  ${ ( sp.flatness ?? 0 ).toFixed( 2 ) }`,
    `kick=${ inst.kick.toFixed( 2 ) }  hat=${ inst.hat.toFixed( 2 ) }  snare=${ inst.snare.toFixed( 2 ) }  sustained=${ inst.sustained.toFixed( 2 ) }`
  ];

  lines.forEach( (
    line, i
  ) => {
    const isVoice = i === 0;
    const active = isVoice && v.active;

    p.fill( active ? [
      120,
      255,
      150,
      230
    ] : [
      220,
      220,
      220,
      200
    ] );
    p.text(
      line,
      14,
      y
    );
    y += lineH;
  } );
}
