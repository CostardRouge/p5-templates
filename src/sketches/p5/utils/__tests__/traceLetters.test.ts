/**
 * Verifies that hoisting the glyph point-cloud build out of the per-step
 * generator (traceLetters.points + traceLetters.morph) is numerically identical
 * to the original inline `texts.map( string.getTextPoints )` rebuilt on every
 * step, for every mode the trace-vectors category uses:
 *   - static single glyph
 *   - multi-glyph morph (v7/v8/v13…)
 *   - animated sampleFactor (sf-height, sf-height-2, v5)
 *
 * The optimisation only changes WHEN/HOW OFTEN the clouds are built, never the
 * geometry, so the traced output must match the naive per-step reduction
 * exactly. Also checks that the cross-frame memo stays bounded (the leak that
 * animated sampleFactor used to cause).
 */

function p5map(
  n: number,
  start1: number,
  stop1: number,
  start2: number,
  stop2: number,
  withinBounds = false
): number {
  const value = ( ( n - start1 ) / ( stop1 - start1 ) ) * ( stop2 - start2 ) + start2;

  if ( !withinBounds ) {
    return value;
  }

  const lower = Math.min(
    start2,
    stop2
  );
  const upper = Math.max(
    start2,
    stop2
  );

  return Math.max(
    lower,
    Math.min(
      upper,
      value
    )
  );
}

// Minimal p5.Vector — copy()/lerp() are all mappers.lerpVector needs.
class V {
  x: number;
  y: number;
  z: number;
  constructor(
    x = 0, y = 0, z = 0
  ) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  copy() {
    return new V(
      this.x,
      this.y,
      this.z
    );
  }
  lerp(
    o: V, a: number
  ) {
    this.x += ( o.x - this.x ) * a;
    this.y += ( o.y - this.y ) * a;
    this.z += ( o.z - this.z ) * a;

    return this;
  }
}

// Deterministic fake font: point count grows as sampleFactor shrinks, geometry
// depends on (text, size, sampleFactor) so distinct params give distinct clouds.
// Mirrors the p5 v2 Font shape: readiness flag on `data`, family on `name`,
// and textToPoints reads the size from the renderer state (graphics.textSize)
// instead of a positional argument.
const font = {
  name: "test",
  data: {},
  textToPoints: (
    text: string,
    _x: number,
    _y: number,
    {
      sampleFactor,
      graphics
    }: { sampleFactor: number;
      graphics: { _textSize: number } }
  ) => {
    const size = graphics._textSize;
    const count = Math.max(
      2,
      Math.round( 5 / sampleFactor )
    );
    const base = text.charCodeAt( 0 );

    return Array.from(
      {
        length: count
      },
      (
        _, i
      ) => ( {
        x: base + i * size * 0.01,
        y: base - i * size * 0.02
      } )
    );
  }
};

const p = {
  createVector: (
    x: number, y: number, z = 0
  ) => new V(
    x,
    y,
    z
  ),
  map: p5map,
  abs: Math.abs,
  PI: Math.PI,
  TAU: Math.PI * 2,
  lerp: (
    a: number, b: number, t: number
  ) => a + ( b - a ) * t,
  // Renderer state stubs used by string.textToPoints' p5 v2 compat path.
  LEFT: "left",
  BASELINE: "alphabetic",
  _textSize: 0,
  push: () => {},
  pop: () => {},
  textFont: () => {},
  textAlign: () => {},
  textSize: ( v: number ) => {
    p._textSize = v;
  }
};

jest.mock(
  "../sketch.js",
  () => ( {
    __esModule: true,
    default: {
      sketchOptions: {
        animation: {
          duration: 10
        }
      }
    },
    getP5: () => p
  } )
);

jest.mock(
  "../time.js",
  () => ( {
    __esModule: true,
    default: {
      seconds: () => 0,
      isRecording: false
    }
  } )
);

import traceLetters from "../traceLetters.js";
import string from "../string.js";
import animation from "../animation.js";
import mappers from "../mappers.js";
import easing from "../easing.js";

type Pt = { x: number;
  y: number;
  z: number };

const flatten = ( cloud: V[] ): Pt[] => cloud.map( ( {
  x, y, z
} ) => ( {
  x,
  y,
  z
} ) );

// The original inline build: rebuild the cloud list on demand (per step).
function inlinePoints(
  texts: string[], size: number, sampleFactor: number
) {
  return texts.map( ( text ) => string.getTextPoints( {
    text,
    size,
    position: p.createVector(
      0,
      0
    ),
    sampleFactor,
    font: font as never
  } ) );
}

beforeEach( () => traceLetters.clearMemo() );

describe(
  "traceLetters.points",
  () => {
    test.each( [
      {
        name: "static single glyph",
        texts: [
          "a"
        ],
        sampleFactor: 0.2
      },
      {
        name: "multi-glyph morph",
        texts: "abc".split( "" ),
        sampleFactor: 0.15
      },
      {
        name: "long word",
        texts: [
          "rainbow",
          "curves"
        ],
        sampleFactor: 0.1
      }
    ] )(
      "hoisted clouds equal the per-step inline build — $name",
      ( {
        texts, sampleFactor
      } ) => {
        const size = 400;
        const steps = 33;

        const hoisted = traceLetters.points( {
          texts,
          size,
          sampleFactor,
          font: font as never
        } );

        // Every step used to rebuild the list inline; assert each rebuild
        // matches the single hoisted list element-for-element.
        for ( let step = 0; step < steps; step++ ) {
          const inline = inlinePoints(
            texts,
            size,
            sampleFactor
          );

          expect( inline.length ).toBe( hoisted.length );
          inline.forEach( (
            cloud, i
          ) => expect( flatten( cloud ) ).toEqual( flatten( hoisted[ i ] ) ) );
        }
      }
    );

    test(
      "returns the same memoised reference across frames",
      () => {
        const args = {
          texts: "xyz".split( "" ),
          size: 300,
          sampleFactor: 0.12,
          font: font as never
        };

        expect( traceLetters.points( args ) ).toBe( traceLetters.points( args ) );
      }
    );
  }
);

describe(
  "traceLetters.morph vs naive per-step reduction",
  () => {
    test(
      "traced output is identical whether clouds are hoisted or rebuilt per step",
      () => {
        const texts = "123".split( "" );
        const size = 500;
        const sampleFactor = 0.1;
        const steps = 40;
        const easingFn = easing.easeInOutExpo;

        const hoistedValues = traceLetters.points( {
          texts,
          size,
          sampleFactor,
          font: font as never
        } );

        for ( let step = 0; step < steps; step++ ) {
          const progression = step / ( steps - 1 );
          const currentTime = p5map(
            progression,
            0,
            1,
            0,
            texts.length - 1
          );

          // OPTIMISED: hoist once, morph.
          const optimised = traceLetters.morph( {
            values: hoistedValues,
            currentTime,
            easingFn
          } );

          // NAIVE: rebuild inline, then the exact animation.ease the sketches used.
          const naive = animation.ease( {
            values: inlinePoints(
              texts,
              size,
              sampleFactor
            ),
            duration: 1,
            lerpFn: mappers.lerpPoints,
            easingFn,
            currentTime
          } );

          expect( flatten( optimised ) ).toEqual( flatten( naive ) );
        }
      }
    );
  }
);

describe(
  "animated sampleFactor (sf-height family)",
  () => {
    test(
      "per-step clouds still match the inline build when sampleFactor varies",
      () => {
        const texts = "ab".split( "" );
        const size = 350;
        const steps = 26;

        for ( let step = 0; step < steps; step++ ) {
          // sampleFactor animated, constant across glyphs within a step.
          const sampleFactor = p5map(
            Math.sin( step ),
            -1,
            1,
            0.025,
            0.1
          );

          const hoisted = traceLetters.points( {
            texts,
            size,
            sampleFactor,
            font: font as never
          } );
          const inline = inlinePoints(
            texts,
            size,
            sampleFactor
          );

          inline.forEach( (
            cloud, i
          ) => expect( flatten( cloud ) ).toEqual( flatten( hoisted[ i ] ) ) );
        }
      }
    );

    test(
      "memo stays bounded under a fresh sampleFactor every frame",
      () => {
        const texts = [
          "a"
        ];

        for ( let frame = 0; frame < 1000; frame++ ) {
          traceLetters.points( {
            texts,
            size: 300,
            // a distinct float every frame → a new key every frame
            sampleFactor: 0.02 + frame * 0.0001,
            font: font as never
          } );
        }

        expect( traceLetters._memo.size ).toBeLessThanOrEqual( 256 );
      }
    );
  }
);

describe(
  "traceLetters.sweep",
  () => {
    test(
      "sweeps the whole list `speed` times across one loop",
      () => {
        expect( traceLetters.sweep(
          0,
          9,
          1
        ) ).toBe( 0 );
        expect( traceLetters.sweep(
          1,
          9,
          1
        ) ).toBe( 9 );
        expect( traceLetters.sweep(
          0.5,
          9,
          2
        ) ).toBe( 9 );
      }
    );
  }
);
