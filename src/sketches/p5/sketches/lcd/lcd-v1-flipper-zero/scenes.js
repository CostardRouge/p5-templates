/**
 * The screens the handheld cycles through. Each scene is a pure function
 * `( frame, s, context )` that paints a whole 128 × 64 frame, where `s` in
 * [0, 1) is how far through its own segment of the loop the scene is and
 * `context.seconds` is how long that segment lasts in real seconds.
 *
 * Two rules keep every scene capturable. Nothing reads a clock or a random
 * generator: jitter comes from `hash01` of an integer tick. And every
 * repetition inside a scene — a blink, a scroll, a pulse — runs a whole number
 * of times per segment (`repeats`), so a scene shown alone closes its loop.
 * Rates are per real second rather than per segment, so a longer loop plays
 * more of the same thing instead of the same thing in slow motion.
 */
import {
  INK,
  PAPER,
  XOR,
  bayerThreshold,
  clearFrame,
  drawBitmap,
  fillRect,
  fillRoundRect,
  hash01,
  hline,
  setPixel,
  strokeArc,
  strokeRect,
  strokeRoundRect,
  vline
} from "../_framebuffer.js";
import {
  CAP_HEIGHT,
  LINE_HEIGHT,
  drawText,
  textWidth,
  wrapText
} from "../_font.js";
import {
  ICONS
} from "./icons.js";

export const SCREEN_WIDTH = 128;
export const SCREEN_HEIGHT = 64;

const clamp01 = ( value ) => Math.max(
  0,
  Math.min(
    1,
    value
  )
);
const smooth = ( value ) => value * value * ( 3 - 2 * value );

/** How many times something happening `perSecond` fits in the segment, at least once. */
export function repeats(
  seconds, perSecond
) {
  return Math.max(
    1,
    Math.round( seconds * perSecond )
  );
}

function drawTextRight(
  frame, text, right, y, options
) {
  return drawText(
    frame,
    text,
    right - textWidth(
      text,
      options?.scale ?? 1
    ),
    y,
    options
  );
}

/** A soft-key hint along the bottom edge: an inked tab with the label in paper. */
function softKey(
  frame, label, align
) {
  const width = textWidth( label ) + 7;
  const x = align === "left"
    ? 0
    : align === "right"
      ? SCREEN_WIDTH - width
      : Math.round( ( SCREEN_WIDTH - width ) / 2 );
  const y = SCREEN_HEIGHT - 11;

  fillRoundRect(
    frame,
    x,
    y,
    width,
    12,
    2
  );
  drawText(
    frame,
    label,
    x + 4,
    y + 2,
    {
      ink: PAPER
    }
  );
}

/* ------------------------------------------------------------------ */
/*  Main menu                                                          */
/* ------------------------------------------------------------------ */

const MENU = [
  {
    label: "Sub-GHz",
    icon: ICONS.subGhz
  },
  {
    label: "RFID",
    icon: ICONS.rfid
  },
  {
    label: "NFC",
    icon: ICONS.nfc
  },
  {
    label: "Infrared",
    icon: ICONS.infrared
  },
  {
    label: "GPIO",
    icon: ICONS.gpio
  },
  {
    label: "iButton",
    icon: ICONS.iButton
  },
  {
    label: "Bad USB",
    icon: ICONS.badUsb
  },
  {
    label: "U2F",
    icon: ICONS.u2f
  },
  {
    label: "Apps",
    icon: ICONS.apps
  },
  {
    label: "Settings",
    icon: ICONS.settings
  }
];
const MENU_ROW = 16;
const MENU_VISIBLE = 4;

/**
 * The cursor walks down the list and back up (a ping-pong closes the loop),
 * gliding between rows and dwelling on each; the list scrolls to keep the
 * cursor on the second row once it is past the first.
 */
function menu(
  frame, s, {
    seconds
  }
) {
  const last = MENU.length - 1;
  const reach = Math.max(
    1,
    Math.min(
      last,
      Math.round( seconds * 0.9 )
    )
  );
  const moves = 2 * reach;
  const steps = s * moves;
  const step = Math.floor( steps );
  const glide = smooth( clamp01( ( steps - step ) / 0.35 ) );
  const indexAt = ( k ) => {
    const wrapped = ( ( k % moves ) + moves ) % moves;

    return wrapped <= reach ? wrapped : moves - wrapped;
  };
  const position = indexAt( step ) + ( indexAt( step + 1 ) - indexAt( step ) ) * glide;
  const top = Math.max(
    0,
    Math.min(
      MENU.length - MENU_VISIBLE,
      position - 1
    )
  );

  clearFrame( frame );

  MENU.forEach( (
    item, index
  ) => {
    const y = Math.round( ( index - top ) * MENU_ROW );

    if ( y <= -MENU_ROW || y >= SCREEN_HEIGHT ) {
      return;
    }

    drawBitmap(
      frame,
      item.icon,
      4,
      y + 3
    );
    drawText(
      frame,
      item.label,
      19,
      y + 4
    );
  } );

  fillRoundRect(
    frame,
    1,
    Math.round( ( position - top ) * MENU_ROW ) + 1,
    118,
    14,
    2,
    XOR
  );

  // Scrollbar: a dotted track and a thumb sized to the visible share.
  for ( let y = 0; y < SCREEN_HEIGHT; y += 2 ) {
    setPixel(
      frame,
      124,
      y
    );
  }

  const thumb = Math.round( SCREEN_HEIGHT * MENU_VISIBLE / MENU.length );
  const thumbY = Math.round( top / ( MENU.length - MENU_VISIBLE ) * ( SCREEN_HEIGHT - thumb ) );

  fillRect(
    frame,
    123,
    thumbY,
    3,
    thumb
  );
}

/* ------------------------------------------------------------------ */
/*  Frequency analyzer                                                 */
/* ------------------------------------------------------------------ */

const BAND = {
  min: 300,
  max: 928
};
const EMITTERS = [
  315.0,
  433.92,
  868.35
];
const BINS = 62;
const SPECTRUM_BASE = 52;
const SPECTRUM_HEIGHT = 34;

const binOf = ( mhz ) => ( mhz - BAND.min ) / ( BAND.max - BAND.min ) * ( BINS - 1 );
const xOfBin = ( bin ) => 2 + Math.round( bin ) * 2;

/**
 * A spectrum sweeping the band: a noise floor re-rolled every tick, and
 * emitters that key up in bursts. The readout locks onto the strongest one.
 */
function scanner(
  frame, s, {
    seconds, seed
  }
) {
  const ticks = repeats(
    seconds,
    12
  );
  const tick = Math.floor( s * ticks ) % ticks;
  const active = EMITTERS.map( (
    mhz, index
  ) => {
    const burst = Math.floor( tick / 7 );

    return {
      mhz,
      bin: binOf( mhz ),
      on: hash01(
        seed,
        index,
        burst,
        11
      ) > 0.42,
      strength: 0.6 + 0.4 * hash01(
        seed,
        index,
        tick,
        23
      )
    };
  } ).filter( ( emitter ) => emitter.on );
  const locked = active.reduce(
    (
      best, emitter
    ) => ( !best || emitter.strength > best.strength ? emitter : best ),
    null
  );

  clearFrame( frame );

  // Readout.
  const readout = locked ? locked.mhz.toFixed( 2 ) : "---.--";
  const end = drawText(
    frame,
    readout,
    2,
    1,
    {
      scale: 2
    }
  );

  drawText(
    frame,
    "MHz",
    end + 3,
    8
  );

  // Signal strength: five rising bars, lit up to the locked emitter's level.
  const level = locked ? Math.round( locked.strength * 5 ) : 0;

  for ( let bar = 0; bar < 5; bar++ ) {
    const height = 3 + bar * 2;
    const x = 110 + bar * 3;

    if ( bar < level ) {
      fillRect(
        frame,
        x,
        14 - height,
        2,
        height
      );
    } else {
      hline(
        frame,
        x,
        x + 1,
        13
      );
    }
  }

  // Spectrum.
  for ( let bin = 0; bin < BINS; bin++ ) {
    let amplitude = 1 + hash01(
      seed,
      bin,
      tick
    ) * 4;

    for ( const emitter of active ) {
      const distance = ( bin - emitter.bin ) / 1.3;

      amplitude += emitter.strength * SPECTRUM_HEIGHT * Math.exp( -distance * distance );
    }

    const height = Math.min(
      SPECTRUM_HEIGHT,
      Math.round( amplitude )
    );

    vline(
      frame,
      xOfBin( bin ),
      SPECTRUM_BASE - height + 1,
      SPECTRUM_BASE
    );
  }

  // Marker over the locked peak.
  if ( locked ) {
    const x = xOfBin( locked.bin );
    const peak = Math.min(
      SPECTRUM_HEIGHT,
      Math.round( 1 + locked.strength * SPECTRUM_HEIGHT )
    );
    const y = SPECTRUM_BASE - peak - 4;

    hline(
      frame,
      x - 2,
      x + 2,
      y
    );
    hline(
      frame,
      x - 1,
      x + 1,
      y + 1
    );
    setPixel(
      frame,
      x,
      y + 2
    );
  }

  // Axis, a tick every 100 MHz, and the band's ends.
  hline(
    frame,
    0,
    SCREEN_WIDTH - 1,
    SPECTRUM_BASE + 1
  );

  for ( let mhz = 300; mhz <= 900; mhz += 100 ) {
    vline(
      frame,
      xOfBin( binOf( mhz ) ),
      SPECTRUM_BASE + 2,
      SPECTRUM_BASE + 3
    );
  }

  drawText(
    frame,
    String( BAND.min ),
    0,
    SCREEN_HEIGHT - CAP_HEIGHT
  );
  drawTextRight(
    frame,
    String( BAND.max ),
    SCREEN_WIDTH,
    SCREEN_HEIGHT - CAP_HEIGHT
  );
}

/* ------------------------------------------------------------------ */
/*  Raw signal capture                                                 */
/* ------------------------------------------------------------------ */

const CODE_BITS = 24;
const UNIT = 2;

/**
 * One transmission of a fixed-code remote, as on/off levels, one per pixel:
 * pulse-width coding (a long high for 1, a short high for 0) followed by a
 * sync gap. The code is drawn from the seed, so each seed is its own remote.
 */
function pulseTrain( seed ) {
  const levels = [];
  const push = (
    level, units
  ) => {
    for ( let index = 0; index < units * UNIT; index++ ) {
      levels.push( level );
    }
  };

  for ( let bit = 0; bit < CODE_BITS; bit++ ) {
    const one = hash01(
      seed,
      bit,
      41
    ) > 0.5;

    push(
      1,
      one ? 3 : 1
    );
    push(
      0,
      one ? 1 : 3
    );
  }

  push(
    1,
    1
  );
  push(
    0,
    14
  );

  return levels;
}

const WAVE_HIGH = 15;
const WAVE_LOW = 42;

function signal(
  frame, s, {
    seconds, seed
  }
) {
  const train = pulseTrain( seed );
  const passes = repeats(
    seconds * 50,
    1 / train.length
  );
  const offset = Math.floor( s * passes * train.length );
  const blinks = repeats(
    seconds,
    1
  );

  clearFrame( frame );

  const end = drawText(
    frame,
    "433.92",
    1,
    1
  );

  drawText(
    frame,
    "AM650",
    end + 4,
    1
  );

  if ( Math.floor( s * blinks * 2 ) % 2 === 0 ) {
    fillRoundRect(
      frame,
      102,
      2,
      5,
      5,
      1
    );
  }

  drawTextRight(
    frame,
    "REC",
    SCREEN_WIDTH - 1,
    1
  );
  hline(
    frame,
    0,
    SCREEN_WIDTH - 1,
    10
  );

  // Dotted mid-line, then the trace, scrolling right to left.
  for ( let x = 0; x < SCREEN_WIDTH; x += 4 ) {
    setPixel(
      frame,
      x,
      Math.round( ( WAVE_HIGH + WAVE_LOW ) / 2 )
    );
  }

  let previous = null;

  for ( let x = 0; x < SCREEN_WIDTH; x++ ) {
    const level = train[ ( x + offset ) % train.length ];

    setPixel(
      frame,
      x,
      level ? WAVE_HIGH : WAVE_LOW
    );

    if ( previous !== null && level !== previous ) {
      vline(
        frame,
        x,
        WAVE_HIGH,
        WAVE_LOW
      );
    }

    previous = level;
  }

  softKey(
    frame,
    "Erase",
    "left"
  );
  softKey(
    frame,
    "Stop",
    "center"
  );
  softKey(
    frame,
    "Save",
    "right"
  );
}

/* ------------------------------------------------------------------ */
/*  Card reader                                                        */
/* ------------------------------------------------------------------ */

const READING_SHARE = 0.55;

function hexByte(
  seed, index
) {
  return Math.floor( hash01(
    seed,
    index,
    97
  ) * 256 ).toString( 16 )
    .toUpperCase()
    .padStart(
      2,
      "0"
    );
}

/**
 * Waiting for a card — waves pulsing out of it — then the read: a header,
 * and the card's details typed out line by line.
 */
function reader(
  frame, s, {
    seconds, seed
  }
) {
  clearFrame( frame );

  if ( s < READING_SHARE ) {
    const local = s / READING_SHARE;
    const pulses = repeats(
      seconds * READING_SHARE,
      1.2
    );
    const lit = Math.floor( local * pulses * 4 ) % 4;

    // The card, its chip and two lines of print.
    strokeRoundRect(
      frame,
      4,
      20,
      28,
      20,
      3
    );
    strokeRect(
      frame,
      8,
      25,
      8,
      7
    );
    hline(
      frame,
      12,
      15,
      28
    );
    hline(
      frame,
      19,
      27,
      26
    );
    hline(
      frame,
      19,
      25,
      29
    );
    hline(
      frame,
      8,
      27,
      35
    );

    for ( let wave = 0; wave < lit; wave++ ) {
      strokeArc(
        frame,
        33,
        30,
        5 + wave * 6,
        INK,
        -0.8,
        0.8
      );
    }

    const end = drawText(
      frame,
      "Reading",
      58,
      12
    );

    for ( let dot = 0; dot < lit; dot++ ) {
      setPixel(
        frame,
        end + 1 + dot * 3,
        12 + CAP_HEIGHT - 1
      );
    }

    drawText(
      frame,
      "Hold card",
      58,
      30
    );
    drawText(
      frame,
      "next to back",
      58,
      30 + LINE_HEIGHT
    );
    return;
  }

  const local = ( s - READING_SHARE ) / ( 1 - READING_SHARE );
  const uid = [
    0,
    1,
    2,
    3
  ].map( ( index ) => hexByte(
    seed,
    index
  ) ).join( " " );
  const lines = [
    `UID: 04 ${ uid.slice( 3 ) }`,
    `ATQA: 00 ${ hexByte(
      seed,
      8
    ) }`,
    `SAK: ${ hexByte(
      seed,
      9
    ) }`
  ];
  const total = lines.reduce(
    (
      sum, text
    ) => sum + text.length,
    0
  );
  let revealed = Math.floor( clamp01( local / 0.5 ) * total );

  fillRect(
    frame,
    0,
    0,
    SCREEN_WIDTH,
    11
  );
  drawText(
    frame,
    "Card detected",
    3,
    2,
    {
      ink: PAPER
    }
  );
  drawBitmap(
    frame,
    ICONS.check,
    SCREEN_WIDTH - 13,
    2,
    PAPER
  );

  lines.forEach( (
    text, index
  ) => {
    const shown = text.slice(
      0,
      Math.max(
        0,
        revealed
      )
    );

    revealed -= text.length;
    drawText(
      frame,
      shown,
      3,
      14 + index * LINE_HEIGHT
    );
  } );

  softKey(
    frame,
    "Retry",
    "left"
  );
  softKey(
    frame,
    "More",
    "right"
  );
}

/* ------------------------------------------------------------------ */
/*  Typed message                                                      */
/* ------------------------------------------------------------------ */

/**
 * The message typed out character by character, then held with a blinking
 * block cursor. The largest scale that fits is used, up to the one asked for.
 */
function message(
  frame, s, {
    seconds, text, scale
  }
) {
  const content = String( text ?? "" ).trim() || " ";
  let size = Math.max(
    1,
    Math.round( scale ?? 2 )
  );
  let lines = wrapText(
    content,
    SCREEN_WIDTH - 8,
    size
  );

  while ( size > 1 && lines.length * LINE_HEIGHT * size - size > SCREEN_HEIGHT - 4 ) {
    size--;
    lines = wrapText(
      content,
      SCREEN_WIDTH - 8,
      size
    );
  }

  const total = lines.reduce(
    (
      sum, line
    ) => sum + line.length,
    0
  );
  const typing = clamp01( s / 0.6 );
  let revealed = Math.floor( typing * total + 0.999 );
  const blinks = repeats(
    seconds,
    2
  );
  const cursorOn = typing < 1 || Math.floor( s * blinks * 2 ) % 2 === 0;
  const blockHeight = LINE_HEIGHT * size * lines.length - size;
  const top = Math.round( ( SCREEN_HEIGHT - blockHeight ) / 2 );
  let cursor = null;

  clearFrame( frame );

  lines.forEach( (
    line, index
  ) => {
    if ( revealed < 0 ) {
      return;
    }

    const shown = line.slice(
      0,
      revealed
    );
    const y = top + index * LINE_HEIGHT * size;
    const end = drawText(
      frame,
      shown,
      4,
      y,
      {
        scale: size
      }
    );

    if ( revealed <= line.length ) {
      cursor = {
        x: shown.length ? end + size : 4,
        y
      };
    }

    revealed -= line.length;
  } );

  if ( cursor && cursorOn ) {
    fillRect(
      frame,
      cursor.x,
      cursor.y,
      5 * size,
      CAP_HEIGHT * size
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Dithered plasma                                                    */
/* ------------------------------------------------------------------ */

/**
 * The idle screen: a sum of travelling sines, ordered-dithered to one bit.
 * Every term turns a whole number of times per segment, so it closes.
 */
function plasma(
  frame, s, {
    seconds
  }
) {
  const turn = 2 * Math.PI * s * repeats(
    seconds,
    0.25
  );
  const cx = SCREEN_WIDTH / 2 + 34 * Math.cos( turn );
  const cy = SCREEN_HEIGHT / 2 + 14 * Math.sin( 2 * turn );

  for ( let y = 0; y < SCREEN_HEIGHT; y++ ) {
    for ( let x = 0; x < SCREEN_WIDTH; x++ ) {
      const value = Math.sin( x * 0.09 + 2 * turn )
        + Math.sin( y * 0.16 - turn )
        + Math.sin( ( x + 2 * y ) * 0.045 + 3 * turn )
        + Math.sin( Math.hypot(
          x - cx,
          ( y - cy ) * 1.4
        ) * 0.16 - 2 * turn );
      // Folding the sum through a sine turns it into bands, so the dither
      // draws contours rather than a flat mid-grey.
      const level = 0.5 + 0.5 * Math.sin( value * 1.6 );

      setPixel(
        frame,
        x,
        y,
        level > bayerThreshold(
          x,
          y
        ) ? INK : PAPER
      );
    }
  }
}

/** Scenes in the order the cycle plays them. */
export const SCENES = {
  menu,
  scanner,
  signal,
  reader,
  message,
  plasma
};

export const SCENE_ORDER = Object.keys( SCENES );
