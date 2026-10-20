import {
  IDENTITY_CAMERA,
  buildTimeline,
  cameraTransform,
  resolveSequence,
  scenePhase,
  wrapUnit
} from "../timeline.js";
import {
  loaderProgress
} from "../loader.js";

const scene = (
  weight: number, duration = 1, easing = "linear"
) => ( {
  weight,
  transition: {
    duration,
    easing
  }
} );

describe(
  "sequence timeline",
  () => {
    it(
      "lays scenes out in proportion to their weight over the loop",
      () => {
        const timeline = buildTimeline(
          [
            scene( 1 ),
            scene( 3 )
          ],
          12,
          "cyclic"
        );

        expect( timeline.total ).toBe( 12 );
        expect( timeline.scenes.map( ( slot ) => [
          slot.start,
          slot.end
        ] ) ).toEqual( [
          [
            0,
            3
          ],
          [
            3,
            12
          ]
        ] );
      }
    );

    it(
      "clamps an entrance to the shorter of its slot and the slot it leaves",
      () => {
        const timeline = buildTimeline(
          [
            scene(
              1,
              5
            ),
            scene(
              9,
              5
            )
          ],
          10,
          "cyclic"
        );

        // Scene 0 lasts 1 s: its own entrance and the next one's are capped at 1.
        expect( timeline.scenes[ 0 ].transitionIn ).toBe( 1 );
        expect( timeline.scenes[ 1 ].transitionIn ).toBe( 1 );
      }
    );

    it(
      "cyclic: the first scene enters from the last across the loop boundary",
      () => {
        const scenes = [
          scene(
            1,
            2
          ),
          scene(
            1,
            2
          )
        ];
        const timeline = buildTimeline(
          scenes,
          10,
          "cyclic"
        );

        expect( timeline.scenes[ 0 ].from ).toBe( 1 );

        const cue = resolveSequence(
          timeline,
          0.5,
          scenes
        );

        expect( cue ).toMatchObject( {
          index: 0,
          local: 0.5,
          raw: 0.25
        } );
        // The outgoing scene's clock keeps running past its own 5 s slot.
        expect( cue?.from ).toMatchObject( {
          index: 1
        } );
        expect( cue?.from?.local ).toBeCloseTo(
          5.5,
          6
        );
      }
    );

    it(
      "once: the first scene simply starts and the last one holds",
      () => {
        const scenes = [
          scene(
            1,
            2
          ),
          scene(
            1,
            2
          )
        ];
        const timeline = buildTimeline(
          scenes,
          10,
          "once"
        );

        expect( timeline.scenes[ 0 ].from ).toBeNull();
        expect( timeline.scenes[ 0 ].transitionIn ).toBe( 0 );

        const start = resolveSequence(
          timeline,
          0.2,
          scenes
        );

        expect( start?.from ).toBeNull();
        expect( start?.mix ).toBe( 1 );

        const end = resolveSequence(
          timeline,
          9.9,
          scenes
        );

        expect( end?.index ).toBe( 1 );
        expect( end?.from ).toBeNull();
      }
    );

    it(
      "eases the transition progress with the entering scene's easing",
      () => {
        const scenes = [
          scene(
            1,
            2,
            "linear"
          ),
          scene(
            1,
            2,
            "easeInQuad"
          )
        ];
        const timeline = buildTimeline(
          scenes,
          10,
          "cyclic"
        );
        // 1 s into scene 1's 2 s entrance: raw 0.5, eased 0.25.
        const cue = resolveSequence(
          timeline,
          6,
          scenes
        );

        expect( cue?.index ).toBe( 1 );
        expect( cue?.raw ).toBeCloseTo(
          0.5,
          6
        );
        expect( cue?.mix ).toBeCloseTo(
          0.25,
          6
        );
      }
    );

    it(
      "wraps the time it is given and never leaves a gap at the end",
      () => {
        const scenes = [
          scene( 1 ),
          scene( 1 ),
          scene( 1 )
        ];
        const timeline = buildTimeline(
          scenes,
          9,
          "cyclic"
        );

        expect( resolveSequence(
          timeline,
          9,
          scenes
        )?.index ).toBe( 0 );
        expect( resolveSequence(
          timeline,
          8.999999,
          scenes
        )?.index ).toBe( 2 );
        expect( resolveSequence(
          timeline,
          -1,
          scenes
        )?.index ).toBe( 2 );
        expect( wrapUnit( 2.25 ) ).toBeCloseTo(
          0.25,
          9
        );
      }
    );

    it(
      "handles an empty reel",
      () => {
        const timeline = buildTimeline(
          [],
          10
        );

        expect( timeline.scenes ).toEqual( [] );
        expect( resolveSequence(
          timeline,
          1,
          []
        ) ).toBeNull();
      }
    );
  }
);

describe(
  "scenePhase",
  () => {
    it(
      "turns `loops` times over the slot, from `progression`",
      () => {
        expect( scenePhase(
          {
            loops: 1,
            progression: 0
          },
          1,
          4
        ) ).toBeCloseTo(
          0.25,
          9
        );
        expect( scenePhase(
          {
            loops: 2,
            progression: 0.5
          },
          1,
          4
        ) ).toBeCloseTo(
          0,
          9
        );
        // Past its slot (the outgoing scene) it keeps turning.
        expect( scenePhase(
          {
            loops: 1,
            progression: 0
          },
          5,
          4
        ) ).toBeCloseTo(
          0.25,
          9
        );
      }
    );

    it(
      "follows the host when loops is 0",
      () => {
        expect( scenePhase(
          {
            loops: 0
          },
          1,
          4
        ) ).toBeNull();
      }
    );
  }
);

describe(
  "cameraTransform",
  () => {
    it(
      "is the identity when the camera is still",
      () => {
        expect( cameraTransform(
          {
            move: "none",
            amount: 0.5
          },
          0.5
        ) ).toEqual( IDENTITY_CAMERA );
      }
    );

    it(
      "pushes in over the scene and pans within its overscan",
      () => {
        const start = cameraTransform(
          {
            move: "push-in",
            amount: 1
          },
          0
        );
        const end = cameraTransform(
          {
            move: "push-in",
            amount: 1
          },
          1
        );

        expect( start[ 0 ] ).toBe( 1 );
        expect( end[ 0 ] ).toBeCloseTo(
          1.6,
          9
        );

        const pan = cameraTransform(
          {
            move: "pan-right",
            amount: 1
          },
          1
        );

        // The pan travels 0.3 of the frame and overscans by the same amount,
        // so the edge of the buffer never shows.
        expect( pan[ 0 ] ).toBeCloseTo(
          1.3,
          9
        );
        expect( Math.abs( pan[ 2 ] ) ).toBeLessThanOrEqual( 0.15 + 1e-9 );
      }
    );

    it(
      "rolls to the asked angle and shakes deterministically",
      () => {
        const rolled = cameraTransform(
          {
            move: "none",
            roll: 45
          },
          1
        );

        expect( rolled[ 1 ] ).toBeCloseTo(
          Math.PI / 4,
          9
        );

        const a = cameraTransform(
          {
            move: "none",
            shake: 1
          },
          0.3,
          2.5
        );
        const b = cameraTransform(
          {
            move: "none",
            shake: 1
          },
          0.3,
          2.5
        );

        expect( a ).toEqual( b );
        expect( a[ 2 ] !== 0 || a[ 3 ] !== 0 ).toBe( true );
      }
    );
  }
);

describe(
  "loaderProgress",
  () => {
    it(
      "reaches 100 % before the scene ends and holds, stutter or not",
      () => {
        expect( loaderProgress( 0 ) ).toBe( 0 );
        expect( loaderProgress( 0.95 ) ).toBe( 1 );
        expect( loaderProgress( 1 ) ).toBe( 1 );
        expect( loaderProgress(
          0.95,
          1
        ) ).toBe( 1 );

        for ( let t = 0; t <= 1; t += 0.01 ) {
          const p = loaderProgress(
            t,
            1
          );

          expect( p ).toBeGreaterThanOrEqual( 0 );
          expect( p ).toBeLessThanOrEqual( 1 );
        }
      }
    );
  }
);
