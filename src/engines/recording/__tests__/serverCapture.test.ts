import {
  captureTiming
} from "../serverCapture";

describe(
  "captureTiming",
  () => {
    it(
      "reads the global animation when no slide is given",
      () => {
        expect( captureTiming( {
          animation: {
            framerate: 30,
            duration: 4
          }
        } ) ).toEqual( {
          frameRate: 30,
          duration: 4,
          totalFrames: 120
        } );
      }
    );

    it(
      "falls back to the shared defaults",
      () => {
        expect( captureTiming( {} ) ).toEqual( {
          frameRate: 60,
          duration: 12,
          totalFrames: 720
        } );
      }
    );

    it(
      "lets a slide's own animation win",
      () => {
        expect( captureTiming(
          {
            animation: {
              framerate: 60,
              duration: 12
            },
            slides: [
              {
                animation: {
                  framerate: 24,
                  duration: 2
                }
              }
            ]
          },
          0
        ).totalFrames ).toBe( 48 );
      }
    );
  }
);
