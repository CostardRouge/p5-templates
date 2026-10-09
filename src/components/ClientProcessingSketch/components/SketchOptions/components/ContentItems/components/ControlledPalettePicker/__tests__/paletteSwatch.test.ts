import {
  paperGradient,
  rampGradient,
  resolveRelativePath,
  transitionHalfWidth
} from "../paletteSwatch";

const RED = [
  255,
  0,
  0
];
const BLUE = [
  0,
  0,
  255
];
const GREEN = [
  0,
  128,
  0
];

describe(
  "rampGradient",
  () => {
    it(
      "draws nothing without stops",
      () => {
        expect( rampGradient(
          undefined,
          0.5
        ) ).toBeNull();
        expect( rampGradient(
          [],
          0.5
        ) ).toBeNull();
      }
    );

    it(
      "loops: starts and ends on the first stop",
      () => {
        const css = rampGradient(
          [
            RED,
            BLUE,
            GREEN
          ],
          0.5
        ) as string;

        expect( css.startsWith( "linear-gradient(90deg, rgb(255, 0, 0) 0%" ) ).toBe( true );
        expect( css.endsWith( "rgb(255, 0, 0) 100%)" ) ).toBe( true );
      }
    );

    it(
      "centres each transition half-way through its segment, as the bake does",
      () => {
        // Two stops, soft: segment 0 blends red → blue around 25 %, segment 1
        // blue → red around 75 %, each a full segment wide at hardness 0.
        const css = rampGradient(
          [
            RED,
            BLUE
          ],
          0
        ) as string;

        expect( css ).toContain( "rgb(255, 0, 0) 0.00%" );
        expect( css ).toContain( "rgb(0, 0, 255) 50.00%" );
        expect( css ).toContain( "rgb(255, 0, 0) 100.00%" );
      }
    );

    it(
      "narrows the transitions with the hardness, to flat bands at 1",
      () => {
        expect( transitionHalfWidth( 0 ) ).toBeCloseTo( 0.5 );
        expect( transitionHalfWidth( 1 ) ).toBeCloseTo( 0.02 );

        const css = rampGradient(
          [
            RED,
            BLUE
          ],
          1
        ) as string;

        // Red holds until just before 25 %, blue starts just after it.
        expect( css ).toContain( "rgb(255, 0, 0) 24.00%" );
        expect( css ).toContain( "rgb(0, 0, 255) 26.00%" );
      }
    );

    it(
      "clamps out-of-range channels instead of emitting invalid CSS",
      () => {
        const css = rampGradient(
          [
            [
              300,
              -5,
              12.6
            ],
            BLUE
          ],
          0.5
        ) as string;

        expect( css ).toContain( "rgb(255, 0, 13)" );
      }
    );
  }
);

describe(
  "paperGradient",
  () => {
    it(
      "runs top to bottom, and borrows the missing end",
      () => {
        expect( paperGradient( {
          top: RED,
          bottom: BLUE
        } ) ).toBe( "linear-gradient(180deg, rgb(255, 0, 0), rgb(0, 0, 255))" );
        expect( paperGradient( {
          top: RED
        } ) ).toBe( "linear-gradient(180deg, rgb(255, 0, 0), rgb(255, 0, 0))" );
        expect( paperGradient( undefined ) ).toBeNull();
      }
    );
  }
);

describe(
  "resolveRelativePath",
  () => {
    it(
      "resolves a sibling",
      () => {
        expect( resolveRelativePath(
          "sketch.material.ramp.palette",
          "stops"
        ) ).toBe( "sketch.material.ramp.stops" );
      }
    );

    it(
      "climbs to the sketch scope, inside a slide too",
      () => {
        expect( resolveRelativePath(
          "sketch.material.ramp.palette",
          "../../background"
        ) ).toBe( "sketch.background" );
        expect( resolveRelativePath(
          "slides.2.sketch.material.ramp.palette",
          "../../background"
        ) ).toBe( "slides.2.sketch.background" );
      }
    );

    it(
      "refuses to climb past the root",
      () => {
        expect( resolveRelativePath(
          "palette",
          "../stops"
        ) ).toBeNull();
      }
    );
  }
);
