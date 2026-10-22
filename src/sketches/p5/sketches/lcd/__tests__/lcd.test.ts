/**
 * The LCD category's raster layer and the handheld's scenes. What matters for
 * capture is that a scene is a pure function of its inputs (the same instant
 * paints the same bits, twice) and that a looping scene lands back on its
 * first frame; what matters for legibility is that every glyph is well formed.
 */
import {
  CHARACTERS,
  CAP_HEIGHT,
  DESCENT,
  drawText,
  glyphFor,
  textWidth,
  wrapText
} from "@/p5/sketches/lcd/_font.js";
import {
  XOR,
  createFrame,
  dissolveFrames,
  fillRoundRect,
  getPixel,
  hash01,
  line
} from "@/p5/sketches/lcd/_framebuffer.js";
import {
  SCENES,
  SCENE_ORDER,
  SCREEN_HEIGHT,
  SCREEN_WIDTH
} from "@/p5/sketches/lcd/lcd-v1-flipper-zero/scenes.js";
import {
  ICONS
} from "@/p5/sketches/lcd/lcd-v1-flipper-zero/icons.js";

const context = {
  seconds: 2,
  seed: 7,
  text: "Hack the planet!",
  scale: 2
};

function paint(
  scene: string, s: number, overrides = {}
) {
  const frame = createFrame(
    SCREEN_WIDTH,
    SCREEN_HEIGHT
  );

  ( SCENES as Record<string, ( ...args: unknown[] ) => void> )[ scene ](
    frame,
    s,
    {
      ...context,
      ...overrides
    }
  );

  return frame;
}

function differing(
  a: { bits: Uint8Array }, b: { bits: Uint8Array }
) {
  let count = 0;

  for ( let index = 0; index < a.bits.length; index++ ) {
    count += a.bits[ index ] === b.bits[ index ] ? 0 : 1;
  }

  return count;
}

function inked( frame: { bits: Uint8Array } ) {
  return frame.bits.reduce(
    (
      sum, bit
    ) => sum + bit,
    0
  );
}

describe(
  "font",
  () => {
    it.each( CHARACTERS )(
      "%s — rows of equal width, cap height plus at most the descent",
      ( character ) => {
        const glyph = glyphFor( character );

        expect( glyph.rows.length ).toBeGreaterThanOrEqual( CAP_HEIGHT );
        expect( glyph.rows.length ).toBeLessThanOrEqual( CAP_HEIGHT + DESCENT );
        glyph.rows.forEach( ( row: string ) => {
          expect( row ).toMatch( /^[#.]+$/ );
          expect( row.length ).toBe( glyph.width );
        } );
      }
    );

    it(
      "keeps digits at full width, trims letters, drops accents",
      () => {
        expect( glyphFor( "1" ).width ).toBe( 5 );
        expect( glyphFor( "i" ).width ).toBeLessThan( glyphFor( "m" ).width );
        expect( glyphFor( "é" ) ).toEqual( glyphFor( "e" ) );
      }
    );

    it(
      "draws exactly as wide as it measures",
      () => {
        const frame = createFrame(
          SCREEN_WIDTH,
          SCREEN_HEIGHT
        );
        const text = "Sub-GHz 433.92";
        const end = drawText(
          frame,
          text,
          0,
          0
        );
        let right = -1;

        for ( let x = 0; x < SCREEN_WIDTH; x++ ) {
          for ( let y = 0; y < SCREEN_HEIGHT; y++ ) {
            if ( getPixel(
              frame,
              x,
              y
            ) ) {
              right = x;
            }
          }
        }

        expect( right + 1 ).toBe( textWidth( text ) );
        expect( end ).toBe( textWidth( text ) + 1 );
      }
    );

    it(
      "wraps within the width and keeps every word",
      () => {
        const lines = wrapText(
          "Hack the planet, one pixel at a time",
          60,
          1
        );

        lines.forEach( ( text: string ) => expect( textWidth( text ) ).toBeLessThanOrEqual( 60 ) );
        expect( lines.join( " " ) ).toBe( "Hack the planet, one pixel at a time" );
      }
    );
  }
);

describe(
  "framebuffer",
  () => {
    it(
      "clips drawing outside the frame instead of wrapping it",
      () => {
        const frame = createFrame(
          8,
          4
        );

        line(
          frame,
          -10,
          1,
          20,
          1
        );
        expect( inked( frame ) ).toBe( 8 );
      }
    );

    it(
      "XOR twice restores the frame",
      () => {
        const frame = createFrame(
          16,
          16
        );

        fillRoundRect(
          frame,
          1,
          1,
          14,
          14,
          2,
          XOR
        );
        expect( inked( frame ) ).toBeGreaterThan( 0 );
        fillRoundRect(
          frame,
          1,
          1,
          14,
          14,
          2,
          XOR
        );
        expect( inked( frame ) ).toBe( 0 );
      }
    );

    it(
      "dissolves from the first frame at 0 to the second at 1, monotonically",
      () => {
        const from = createFrame(
          32,
          16
        );
        const to = createFrame(
          32,
          16
        );
        const out = createFrame(
          32,
          16
        );

        to.bits.fill( 1 );

        const coverage = [
          0,
          0.25,
          0.5,
          0.75,
          1
        ].map( ( amount ) => {
          dissolveFrames(
            from,
            to,
            amount,
            out
          );

          return inked( out );
        } );

        expect( coverage[ 0 ] ).toBe( 0 );
        expect( coverage[ 2 ] ).toBe( 256 );
        expect( coverage[ 4 ] ).toBe( 512 );
        expect( [
          ...coverage
        ].sort( (
          a, b
        ) => a - b ) ).toEqual( coverage );
      }
    );

    it(
      "hashes deterministically into [0, 1)",
      () => {
        expect( hash01(
          7,
          3,
          1
        ) ).toBe( hash01(
          7,
          3,
          1
        ) );
        expect( hash01(
          7,
          3,
          1
        ) ).not.toBe( hash01(
          7,
          3,
          2
        ) );

        for ( let index = 0; index < 200; index++ ) {
          const value = hash01(
            index,
            index * 3
          );

          expect( value ).toBeGreaterThanOrEqual( 0 );
          expect( value ).toBeLessThan( 1 );
        }
      }
    );
  }
);

describe(
  "scenes",
  () => {
    it.each( SCENE_ORDER )(
      "%s — paints something, and the same instant twice paints the same bits",
      ( scene ) => {
        [
          0,
          0.3,
          0.7,
          0.95
        ].forEach( ( s ) => {
          const first = paint(
            scene,
            s
          );

          expect( inked( first ) ).toBeGreaterThan( 0 );
          expect( differing(
            first,
            paint(
              scene,
              s
            )
          ) ).toBe( 0 );
        } );
      }
    );

    it.each( SCENE_ORDER )(
      "%s — actually moves over its segment",
      ( scene ) => {
        const frames = [
          0,
          0.2,
          0.45,
          0.8
        ].map( ( s ) => paint(
          scene,
          s
        ) );
        const changes = frames.slice( 1 ).map( ( frame ) => differing(
          frames[ 0 ],
          frame
        ) );

        expect( Math.max( ...changes ) ).toBeGreaterThan( 20 );
      }
    );

    it.each( [
      2,
      12,
      30
    ] )(
      "the menu's cursor is back on the first row as a %ds loop closes",
      ( seconds ) => {
        expect( differing(
          paint(
            "menu",
            0,
            {
              seconds
            }
          ),
          paint(
            "menu",
            1 - 1e-9,
            {
              seconds
            }
          )
        ) ).toBe( 0 );
      }
    );

    it(
      "the plasma lands back on its first frame",
      () => {
        const change = differing(
          paint(
            "plasma",
            0
          ),
          paint(
            "plasma",
            1 - 1e-6
          )
        );

        expect( change ).toBeLessThan( SCREEN_WIDTH * SCREEN_HEIGHT * 0.01 );
      }
    );
  }
);

describe(
  "icons",
  () => {
    it.each( Object.keys( ICONS ) )(
      "%s — ten columns, only ink and transparency",
      ( name ) => {
        ( ICONS as Record<string, string[]> )[ name ].forEach( ( row ) => {
          expect( row ).toMatch( /^[#.]{10}$/ );
        } );
      }
    );
  }
);
