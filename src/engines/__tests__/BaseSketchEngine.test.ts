/**
 * The engine base class: what every `SketchEngine` shares — the listener
 * map, the lifecycle of the `performance` sampling loop, and the capture
 * waits. The property that matters most is pinned last: a canvas engine's
 * `seekAndDraw` must resolve WITHOUT an animation frame, because a hidden
 * tab never delivers one and the export loop would hang on it.
 */

import {
  BaseSketchEngine,
  PERFORMANCE_EMIT_INTERVAL_MS
} from "../BaseSketchEngine";
import type {
  EnginePerformanceSample
} from "../types";
import {
  registerAnimationBridge,
  unregisterAnimationBridge
} from "@/lib/animationBridge";

class TestEngine extends BaseSketchEngine {
  readonly engineId = "test";

  calls: string[] = [];
  fps = 0;
  ticks: number[] = [];
  canvas: HTMLCanvasElement | null = null;

  async init(): Promise<void> {
    this.becomeReady();
  }

  protected teardown(): void {
    this.calls.push( "teardown" );
  }

  play(): void {
    this.reportPlaying();
  }

  pause(): void {
    this.reportPaused();
  }

  stop(): void {
    this.reportStopped();
  }

  redraw(): void {
    this.calls.push( "redraw" );
  }

  seek( frame: number ): void {
    this.calls.push( `seek:${ frame }` );
  }

  beginDeterministicCapture(): void {
    this.calls.push( "begin" );
  }

  endDeterministicCapture(): void {
    this.calls.push( "end" );
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  protected onPerformanceTick( now: number ): void {
    this.ticks.push( now );
  }

  protected measureFps(): number {
    return this.fps;
  }
}

type FrameCallback = ( now: number ) => void;

/**
 * A hand-cranked `requestAnimationFrame`: callbacks are collected and only
 * run when the test says so, which is also how a hidden tab behaves.
 */
function installFakeAnimationFrames() {
  const pending = new Map<number, FrameCallback>();
  const cancelled: number[] = [];
  let nextId = 1;

  ( globalThis as any ).requestAnimationFrame = ( cb: FrameCallback ) => {
    const id = nextId++;

    pending.set(
      id,
      cb
    );

    return id;
  };

  ( globalThis as any ).cancelAnimationFrame = ( id: number ) => {
    cancelled.push( id );
    pending.delete( id );
  };

  return {
    pending,
    cancelled,
    /** Run every pending frame callback once, at `now`. */
    frame( now: number ) {
      const callbacks = Array.from( pending.values() );

      pending.clear();
      callbacks.forEach( ( cb ) => cb( now ) );
    },
    uninstall() {
      delete ( globalThis as any ).requestAnimationFrame;
      delete ( globalThis as any ).cancelAnimationFrame;
    }
  };
}

describe(
  "BaseSketchEngine",
  () => {
    let frames: ReturnType<typeof installFakeAnimationFrames>;
    let nowSpy: jest.SpyInstance<number, []>;

    beforeEach( () => {
      frames = installFakeAnimationFrames();
      nowSpy = jest.spyOn(
        performance,
        "now"
      ).mockReturnValue( 0 );
    } );

    afterEach( () => {
      frames.uninstall();
      nowSpy.mockRestore();
      unregisterAnimationBridge();
    } );

    describe(
      "events",
      () => {
        it(
          "delivers to every listener of an event and to no other event",
          async() => {
            const engine = new TestEngine();
            const ready: string[] = [];
            const errors: Error[] = [];

            engine.on(
              "ready",
              () => ready.push( "a" )
            );
            engine.on(
              "ready",
              () => ready.push( "b" )
            );
            engine.on(
              "error",
              ( error ) => errors.push( error )
            );

            await engine.init();

            expect( ready ).toEqual( [
              "a",
              "b"
            ] );
            expect( errors ).toEqual( [] );
            expect( engine.isReady ).toBe( true );
          }
        );

        it(
          "stops delivering to a listener once it is removed",
          async() => {
            const engine = new TestEngine();
            const seen: string[] = [];
            const handler = () => seen.push( "ready" );

            engine.on(
              "ready",
              handler
            );
            engine.off(
              "ready",
              handler
            );

            await engine.init();

            expect( seen ).toEqual( [] );
          }
        );
      }
    );

    describe(
      "performance loop",
      () => {
        it(
          "runs only while someone listens, and reports at the emit interval",
          async() => {
            const engine = new TestEngine();
            const samples: EnginePerformanceSample[] = [];
            const handler = ( sample: EnginePerformanceSample ) => samples.push( sample );

            await engine.init();

            expect( frames.pending.size ).toBe( 0 );

            engine.on(
              "performance",
              handler
            );

            // Subscribing emits the current reading at once and starts a loop.
            expect( samples ).toHaveLength( 1 );
            expect( samples[ 0 ] ).toMatchObject( {
              fps: 0,
              paused: false
            } );
            expect( frames.pending.size ).toBe( 1 );

            engine.fps = 60;

            // Ticks before the interval feed the engine but emit nothing.
            frames.frame( PERFORMANCE_EMIT_INTERVAL_MS / 2 );
            expect( samples ).toHaveLength( 1 );
            expect( engine.ticks ).toEqual( [
              PERFORMANCE_EMIT_INTERVAL_MS / 2
            ] );

            frames.frame( PERFORMANCE_EMIT_INTERVAL_MS );
            expect( samples ).toHaveLength( 2 );
            expect( samples[ 1 ].fps ).toBe( 60 );

            // The loop keeps itself alive as long as the listener is there…
            expect( frames.pending.size ).toBe( 1 );

            engine.off(
              "performance",
              handler
            );

            // …and the last unsubscribe cancels the pending frame.
            expect( frames.cancelled ).toHaveLength( 1 );
            expect( frames.pending.size ).toBe( 0 );
          }
        );

        it(
          "does not sample before the engine is ready",
          () => {
            const engine = new TestEngine();

            engine.on(
              "performance",
              () => undefined
            );
            frames.frame( PERFORMANCE_EMIT_INTERVAL_MS * 2 );

            expect( engine.ticks ).toEqual( [] );
          }
        );

        it(
          "reports playback state changes immediately",
          async() => {
            const engine = new TestEngine();
            const samples: EnginePerformanceSample[] = [];

            await engine.init();
            engine.on(
              "performance",
              ( sample ) => samples.push( sample )
            );

            engine.fps = 30;
            frames.frame( PERFORMANCE_EMIT_INTERVAL_MS );

            engine.pause();
            expect( samples[ samples.length - 1 ] ).toMatchObject( {
              fps: 30,
              paused: true
            } );

            engine.play();
            expect( samples[ samples.length - 1 ] ).toMatchObject( {
              fps: 30,
              paused: false
            } );

            // Stop discards the reading: the loop is rewound, nothing is
            // being drawn at 30 fps any more.
            engine.stop();
            expect( samples[ samples.length - 1 ] ).toMatchObject( {
              fps: 0,
              paused: true
            } );
          }
        );
      }
    );

    describe(
      "destroy",
      () => {
        it(
          "stops the loop, tears the runtime down and drops every listener",
          async() => {
            const engine = new TestEngine();
            const samples: EnginePerformanceSample[] = [];

            await engine.init();
            engine.on(
              "performance",
              ( sample ) => samples.push( sample )
            );

            engine.destroy();

            expect( engine.isReady ).toBe( false );
            expect( engine.calls ).toEqual( [
              "teardown"
            ] );
            expect( frames.cancelled ).toHaveLength( 1 );

            // A listener that survived would hear this.
            const before = samples.length;

            engine.pause();
            expect( samples ).toHaveLength( before );
          }
        );
      }
    );

    describe(
      "capture waits",
      () => {
        beforeEach( () => {
          jest.useFakeTimers();
        } );

        afterEach( () => {
          jest.useRealTimers();
        } );

        it(
          "seekAndDraw resolves without an animation frame ever arriving",
          async() => {
            const engine = new TestEngine();

            await engine.init();

            let settled = false;
            const wait = engine.seekAndDraw( 7 ).then( () => {
              settled = true;
            } );

            // The seek itself is synchronous…
            expect( engine.calls ).toContain( "seek:7" );

            // …and no frame callback is ever run: only the timers advance.
            await jest.advanceTimersByTimeAsync( 0 );
            await wait;

            expect( settled ).toBe( true );
            expect( frames.pending.size ).toBe( 0 );
          }
        );

        it(
          "resetToStart rewinds the animation bridge before seeking frame 0",
          async() => {
            const engine = new TestEngine();
            const order: string[] = [];

            registerAnimationBridge( {
              getProgression: () => 0.5,
              setProgression: ( value ) => order.push( `progression:${ value }` ),
              pause: () => undefined,
              resume: () => undefined,
              redraw: () => undefined,
              subscribe: () => () => undefined
            } );

            await engine.init();

            const wait = engine.resetToStart();

            await jest.advanceTimersByTimeAsync( 0 );
            await wait;

            expect( [
              ...order,
              ...engine.calls.filter( ( call ) => call.startsWith( "seek" ) )
            ] ).toEqual( [
              "progression:0",
              "seek:0"
            ] );
          }
        );

        it(
          "captureFrame reads the capture source after the seek",
          async() => {
            const engine = new TestEngine();

            engine.canvas = {
              width: 2,
              height: 2,
              toDataURL: () => "data:image/png;base64,frame"
            } as unknown as HTMLCanvasElement;

            await engine.init();

            const wait = engine.captureFrame( 3 );

            await jest.advanceTimersByTimeAsync( 0 );

            await expect( wait ).resolves.toBe( "data:image/png;base64,frame" );
            expect( engine.calls ).toContain( "seek:3" );
          }
        );

        it(
          "captureFrame fails loudly when there is no canvas to read",
          async() => {
            const engine = new TestEngine();

            await engine.init();

            const wait = engine.captureFrame( 0 );

            // Attach the rejection handler before the timers run so the
            // rejection is never unhandled.
            const outcome = expect( wait ).rejects.toThrow( "no canvas available" );

            await jest.advanceTimersByTimeAsync( 0 );
            await outcome;
          }
        );
      }
    );
  }
);
