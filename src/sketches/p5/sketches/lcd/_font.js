/**
 * A proportional 5 × 7 bitmap font with descenders, for 1-bit LCD scenes.
 *
 * Browser text rasterised at 7 px and thresholded is mush; a small hand-drawn
 * font is what a real monochrome LCD shows. Each glyph is its rows joined by
 * spaces: 7 rows from the cap line to the baseline, plus up to 2 descender
 * rows below it. Letters and punctuation are trimmed to their inked columns so
 * the font is proportional (an "i" is narrower than an "m"); digits keep their
 * full width so a changing number does not make the text beside it jitter.
 */
import {
  INK, setPixel
} from "./_framebuffer.js";

/** Rows above the baseline, rows below it, and the gap between two lines. */
export const CAP_HEIGHT = 7;
export const DESCENT = 2;
export const LINE_HEIGHT = CAP_HEIGHT + DESCENT + 1;

const SPACE_WIDTH = 3;

const GLYPHS = {
  A: ".###. #...# #...# ##### #...# #...# #...#",
  B: "####. #...# #...# ####. #...# #...# ####.",
  C: ".###. #...# #.... #.... #.... #...# .###.",
  D: "####. #...# #...# #...# #...# #...# ####.",
  E: "##### #.... #.... ####. #.... #.... #####",
  F: "##### #.... #.... ####. #.... #.... #....",
  G: ".###. #...# #.... #.### #...# #...# .####",
  H: "#...# #...# #...# ##### #...# #...# #...#",
  I: "### .#. .#. .#. .#. .#. ###",
  J: "..### ...#. ...#. ...#. ...#. #..#. .##..",
  K: "#...# #..#. #.#.. ##... #.#.. #..#. #...#",
  L: "#.... #.... #.... #.... #.... #.... #####",
  M: "#...# ##.## #.#.# #.#.# #...# #...# #...#",
  N: "#...# #...# ##..# #.#.# #..## #...# #...#",
  O: ".###. #...# #...# #...# #...# #...# .###.",
  P: "####. #...# #...# ####. #.... #.... #....",
  Q: ".###. #...# #...# #...# #.#.# #..#. .##.#",
  R: "####. #...# #...# ####. #.#.. #..#. #...#",
  S: ".#### #.... #.... .###. ....# ....# ####.",
  T: "##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..",
  U: "#...# #...# #...# #...# #...# #...# .###.",
  V: "#...# #...# #...# #...# #...# .#.#. ..#..",
  W: "#...# #...# #...# #.#.# #.#.# #.#.# .#.#.",
  X: "#...# #...# .#.#. ..#.. .#.#. #...# #...#",
  Y: "#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..",
  Z: "##### ....# ...#. ..#.. .#... #.... #####",
  a: "..... ..... .###. ....# .#### #...# .####",
  b: "#.... #.... #.##. ##..# #...# #...# ####.",
  c: "..... ..... .###. #.... #.... #...# .###.",
  d: "....# ....# .##.# #..## #...# #...# .####",
  e: "..... ..... .###. #...# ##### #.... .###.",
  f: "..##. .#..# .#... ###.. .#... .#... .#...",
  g: "..... ..... .#### #...# #...# #...# .#### ....# .###.",
  h: "#.... #.... #.##. ##..# #...# #...# #...#",
  i: ".#. ... ##. .#. .#. .#. ###",
  j: "...# .... ..## ...# ...# ...# ...# #..# .##.",
  k: "#... #... #..# #.#. ##.. #.#. #..#",
  l: "##. .#. .#. .#. .#. .#. ###",
  m: "..... ..... ##.#. #.#.# #.#.# #.#.# #.#.#",
  n: "..... ..... #.##. ##..# #...# #...# #...#",
  o: "..... ..... .###. #...# #...# #...# .###.",
  p: "..... ..... ####. #...# #...# #...# ####. #.... #....",
  q: "..... ..... .#### #...# #...# #...# .#### ....# ....#",
  r: "..... ..... #.##. ##..# #.... #.... #....",
  s: "..... ..... .#### #.... .###. ....# ####.",
  t: ".#... .#... ####. .#... .#... .#..# ..##.",
  u: "..... ..... #...# #...# #...# #..## .##.#",
  v: "..... ..... #...# #...# #...# .#.#. ..#..",
  w: "..... ..... #...# #...# #.#.# #.#.# .#.#.",
  x: "..... ..... #...# .#.#. ..#.. .#.#. #...#",
  y: "..... ..... #...# #...# #...# #...# .#### ....# .###.",
  z: "..... ..... ##### ...#. ..#.. .#... #####",
  0: ".###. #...# #..## #.#.# ##..# #...# .###.",
  1: "..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.",
  2: ".###. #...# ....# ...#. ..#.. .#... #####",
  3: "####. ....# ....# .###. ....# ....# ####.",
  4: "...#. ..##. .#.#. #..#. ##### ...#. ...#.",
  5: "##### #.... ####. ....# ....# #...# .###.",
  6: "..##. .#... #.... ####. #...# #...# .###.",
  7: "##### ....# ...#. ..#.. .#... .#... .#...",
  8: ".###. #...# #...# .###. #...# #...# .###.",
  9: ".###. #...# #...# .#### ....# ...#. .##..",
  ".": ". . . . . . #",
  ",": ".. .. .. .. .. .# .# #.",
  ":": ". . # . . # .",
  ";": ".. .. .# .. .. .# .# #.",
  "!": "# # # # # . #",
  "?": ".###. #...# ....# ...#. ..#.. ..... ..#..",
  "-": "... ... ... ### ... ... ...",
  "+": "..... ..#.. ..#.. ##### ..#.. ..#.. .....",
  "=": "..... ..... ##### ..... ##### ..... .....",
  "/": "....# ....# ...#. ..#.. .#... #.... #....",
  "\\": "#.... #.... .#... ..#.. ...#. ....# ....#",
  "(": "..# .#. #.. #.. #.. .#. ..#",
  ")": "#.. .#. ..# ..# ..# .#. #..",
  "[": "## #. #. #. #. #. ##",
  "]": "## .# .# .# .# .# ##",
  "<": "...#. ..#.. .#... #.... .#... ..#.. ...#.",
  ">": ".#... ..#.. ...#. ....# ...#. ..#.. .#...",
  "'": "# # . . . . .",
  "\"": "#.# #.# ... ... ... ... ...",
  "%": "##..# ##..# ...#. ..#.. .#... #..## #..##",
  "#": ".#.#. ##### .#.#. .#.#. .#.#. ##### .#.#.",
  "*": "..... #.#.# .###. ##### .###. #.#.# .....",
  _: "..... ..... ..... ..... ..... ..... #####",
  "@": ".###. #...# #.### #.#.# #.### #.... .###.",
  "&": ".##.. #..#. #.#.. .#... #.#.# #..#. .##.#",
  $: "..#.. .#### #.#.. .###. ..#.# ####. ..#..",
  "^": "..#.. .#.#. #...# ..... ..... ..... .....",
  "~": "..... ..... .#... #.#.# ...#. ..... .....",
  "|": "# # # # # # #",
  "°": ".#. #.# .#. ... ... ... ..."
};

const FALLBACK = "##### #...# #...# #...# #...# #...# #####";

function parseGlyph(
  source, trim
) {
  const rows = source.trim().split( /\s+/ );
  let left = 0;
  let right = rows[ 0 ].length - 1;

  if ( trim ) {
    const inked = ( column ) => rows.some( ( row ) => row[ column ] === "#" );

    while ( left < right && !inked( left ) ) {
      left++;
    }

    while ( right > left && !inked( right ) ) {
      right--;
    }
  }

  return {
    width: right - left + 1,
    rows: rows.map( ( row ) => row.slice(
      left,
      right + 1
    ) )
  };
}

const parsed = new Map();

/** The parsed glyph for one character: `{ width, rows }`. */
export function glyphFor( character ) {
  if ( parsed.has( character ) ) {
    return parsed.get( character );
  }

  let glyph;

  if ( character === " " ) {
    glyph = {
      width: SPACE_WIDTH,
      rows: []
    };
  } else {
    // "é" draws as "e": the accent is dropped rather than the letter boxed.
    const bare = character.normalize( "NFD" )[ 0 ];
    const source = GLYPHS[ character ]
      ?? GLYPHS[ bare ]
      ?? GLYPHS[ bare.toUpperCase() ]
      ?? FALLBACK;

    glyph = parseGlyph(
      source,
      !/[0-9]/.test( character )
    );
  }

  parsed.set(
    character,
    glyph
  );

  return glyph;
}

/** Every character the font draws with its own glyph (the rest fall back). */
export const CHARACTERS = Object.keys( GLYPHS );

/** Width in pixels of a single line of text, tracking included. */
export function textWidth(
  text, scale = 1
) {
  let width = 0;

  for ( const character of String( text ) ) {
    width += ( glyphFor( character ).width + 1 ) * scale;
  }

  return Math.max(
    0,
    width - scale
  );
}

/**
 * Draws one line of text with its cap line at `y`. Returns the x just past
 * the last glyph, so a caller can keep writing on the same line.
 */
export function drawText(
  frame, text, x, y, {
    scale = 1, ink = INK
  } = {}
) {
  let cursor = Math.round( x );

  y = Math.round( y );

  for ( const character of String( text ) ) {
    const glyph = glyphFor( character );

    for ( let row = 0; row < glyph.rows.length; row++ ) {
      const line = glyph.rows[ row ];

      for ( let column = 0; column < line.length; column++ ) {
        if ( line[ column ] !== "#" ) {
          continue;
        }

        for ( let sy = 0; sy < scale; sy++ ) {
          for ( let sx = 0; sx < scale; sx++ ) {
            setPixel(
              frame,
              cursor + column * scale + sx,
              y + row * scale + sy,
              ink
            );
          }
        }
      }
    }

    cursor += ( glyph.width + 1 ) * scale;
  }

  return cursor;
}

/**
 * Greedy word wrap to `maxWidth` pixels. Explicit newlines are kept; a word
 * longer than a whole line is broken by characters rather than overflowing.
 */
export function wrapText(
  text, maxWidth, scale = 1
) {
  const lines = [];

  for ( const paragraph of String( text ).split( "\n" ) ) {
    let current = "";

    for ( const word of paragraph.split( /\s+/ ).filter( Boolean ) ) {
      const candidate = current ? `${ current } ${ word }` : word;

      if ( textWidth(
        candidate,
        scale
      ) <= maxWidth ) {
        current = candidate;
        continue;
      }

      if ( current ) {
        lines.push( current );
        current = "";
      }

      let piece = "";

      for ( const character of word ) {
        if ( piece && textWidth(
          piece + character,
          scale
        ) > maxWidth ) {
          lines.push( piece );
          piece = "";
        }

        piece += character;
      }

      current = piece;
    }

    lines.push( current );
  }

  return lines;
}
