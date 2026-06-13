import {
  FrameRateMeter
} from "@/engines/frameRateMeter";

/**
 * Feed the meter rAF-style ticks (every ~16.7ms) while the frame counter
 * advances at `fps`, starting from `startTime`/`startFrame`. Returns the
 * last reading.
 */
function run(
  meter: FrameRateMeter,
  {
    fps,
    durationMs,
    startTime = 0,
    startFrame = 0,
    tickMs = 16.7
  }: {
    fps: number;
    durationMs: number;
    startTime?: number;
    startFrame?: number;
    tickMs?: number;
  }
) {
  let reading = 0;
  let time = startTime;

  while ( time <= startTime + durationMs ) {
    const frameCount = startFrame + Math.floor( ( time - startTime ) * fps / 1000 );

    reading = meter.sample(
      time,
      frameCount
    );
    time += tickMs;
  }

  return {
    reading,
    endTime: time,
    endFrame: startFrame + Math.floor( durationMs * fps / 1000 )
  };
}

describe(
  "FrameRateMeter",
  () => {
    test(
      "measures a steady rate",
      () => {
        const meter = new FrameRateMeter();
        const {
          reading
        } = run(
          meter,
          {
            fps: 60,
            durationMs: 2000
          }
        );

        expect( Math.round( reading ) ).toBe( 60 );
      }
    );

    test(
      "measures a low rate sampled at display frequency (no aliasing)",
      () => {
        const meter = new FrameRateMeter();
        const {
          reading
        } = run(
          meter,
          {
            fps: 5,
            durationMs: 3000
          }
        );

        // The synthetic feed floor-quantises frame counts, so allow ±1.
        expect( Math.abs( reading - 5 ) ).toBeLessThan( 1 );
      }
    );

    test(
      "converges within one window after a framerate change",
      () => {
        const meter = new FrameRateMeter( 1000 );
        const phase1 = run(
          meter,
          {
            fps: 60,
            durationMs: 2000
          }
        );

        const {
          reading
        } = run(
          meter,
          {
            fps: 24,
            durationMs: 1100,
            startTime: phase1.endTime,
            startFrame: phase1.endFrame
          }
        );

        expect( Math.round( reading ) ).toBe( 24 );
      }
    );

    test(
      "a rewound frame counter (seek/stop) restarts the window",
      () => {
        const meter = new FrameRateMeter();

        run(
          meter,
          {
            fps: 60,
            durationMs: 1000
          }
        );

        // Seek back to frame 0: the next reading must not mix pre-seek
        // samples into the window.
        const first = meter.sample(
          2000,
          0
        );

        expect( first ).toBe( 0 );

        const {
          reading
        } = run(
          meter,
          {
            fps: 30,
            durationMs: 1100,
            startTime: 2016,
            startFrame: 1
          }
        );

        // The synthetic feed floor-quantises frame counts, so allow ±1.
        expect( Math.abs( reading - 30 ) ).toBeLessThan( 1 );
      }
    );

    test(
      "a frozen counter (paused loop) reads 0 once the window fills",
      () => {
        const meter = new FrameRateMeter( 1000 );
        const phase1 = run(
          meter,
          {
            fps: 60,
            durationMs: 1500
          }
        );

        const {
          reading
        } = run(
          meter,
          {
            fps: 0,
            durationMs: 1500,
            startTime: phase1.endTime,
            startFrame: phase1.endFrame
          }
        );

        expect( reading ).toBe( 0 );
      }
    );

    test(
      "reset clears the window",
      () => {
        const meter = new FrameRateMeter();

        run(
          meter,
          {
            fps: 60,
            durationMs: 1000
          }
        );
        meter.reset();

        expect( meter.fps ).toBe( 0 );
      }
    );
  }
);
