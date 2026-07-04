/**
 * Regression tests for the async-loop (deterministic) browser recorder.
 *
 * The bug these guard against: browser async-loop capture used to step the
 * frame *index* through the encoder while letting the sketch clock free-run on
 * wall-clock time, so the captured animation finished before (fast machines) or
 * after (slow machines) the loop. The recorder must now switch the host into
 * deterministic, frame-stepped time for the *entire* capture — entered before
 * the first draw and left only on teardown.
 */

import {
  AsyncLoopRecorder
} from "../strategies/AsyncLoopRecorder";
import type {
  CaptureSource,
  FrameEncoder,
  FrameEncoderFactory,
  RecorderHost
} from "../types";

function makeSource(): CaptureSource {
  return {
    width: 100,
    height: 100,
    getStreamCanvas: () => null,
    readFrame: async() => ( {} as unknown as CanvasImageSource ),
    beginRealtime: () => undefined,
    endRealtime: () => undefined
  };
}

function makeHost(
  totalFrames: number,
  frameRate: number,
  calls: string[]
): RecorderHost {
  const source = makeSource();

  return {
    getCaptureSource: () => source,
    getCanvas: () => null,
    seekAndDraw: async( frame: number ) => {
      calls.push( `seek:${ frame }` );
    },
    resetToStart: async() => {
      calls.push( "reset" );
    },
    pause: () => calls.push( "pause" ),
    resume: () => calls.push( "resume" ),
    beginDeterministicCapture: () => calls.push( "begin" ),
    endDeterministicCapture: () => calls.push( "end" ),
    totalFrames,
    frameRate
  };
}

function makeEncoderFactory(
  addFrameCounter: { count: number },
  receivedParams: { value: Parameters<FrameEncoderFactory>[ 0 ] | null }
): FrameEncoderFactory {
  return ( params ) => {
    receivedParams.value = params;

    const encoder: FrameEncoder = {
      format: "webm",
      mimeType: "video/webm",
      fileExtension: "webm",
      hasAudioTrack: false,
      addFrame: async() => {
        addFrameCounter.count += 1;
      },
      finalize: async() => ( {} as unknown as Blob ),
      dispose: () => undefined
    };

    return encoder;
  };
}

describe(
  "AsyncLoopRecorder deterministic capture",
  () => {
    test(
      "enters deterministic mode before any draw and captures every frame",
      async() => {
        const totalFrames = 4;
        const calls: string[] = [];
        const host = makeHost(
          totalFrames,
          30,
          calls
        );
        const addFrameCounter = {
          count: 0
        };
        const receivedParams = {
          value: null as Parameters<FrameEncoderFactory>[ 0 ] | null
        };
        const recorder = new AsyncLoopRecorder(
          host,
          "webm",
          makeEncoderFactory(
            addFrameCounter,
            receivedParams
          )
        );

        await recorder.start();
        await recorder.stop();

        // Encoder is built with the host's resolved cadence + frame count.
        expect( receivedParams.value?.totalFrames ).toBe( totalFrames );
        expect( receivedParams.value?.frameRate ).toBe( 30 );

        // Every frame index was stepped + encoded.
        expect( addFrameCounter.count ).toBe( totalFrames );
        const seeks = calls.filter( ( c ) => c.startsWith( "seek:" ) );

        expect( seeks ).toEqual( [
          "seek:0",
          "seek:1",
          "seek:2",
          "seek:3"
        ] );

        // Deterministic mode is entered exactly once, before reset + all seeks.
        expect( calls.filter( ( c ) => c === "begin" ) ).toHaveLength( 1 );
        expect( calls.filter( ( c ) => c === "end" ) ).toHaveLength( 1 );

        const beginIdx = calls.indexOf( "begin" );
        const resetIdx = calls.indexOf( "reset" );
        const firstSeekIdx = calls.indexOf( "seek:0" );

        expect( beginIdx ).toBeGreaterThanOrEqual( 0 );
        expect( beginIdx ).toBeLessThan( resetIdx );
        expect( resetIdx ).toBeLessThan( firstSeekIdx );

        // Teardown leaves deterministic mode before resuming the live loop.
        const endIdx = calls.indexOf( "end" );
        const resumeIdx = calls.indexOf( "resume" );

        expect( endIdx ).toBeGreaterThan( firstSeekIdx );
        expect( endIdx ).toBeLessThan( resumeIdx );
      }
    );

    test(
      "resumes the host before emitting \"stop\", so a listener's own play/pause call has the last word",
      async() => {
        const totalFrames = 2;
        const calls: string[] = [];
        const host = makeHost(
          totalFrames,
          30,
          calls
        );
        const addFrameCounter = {
          count: 0
        };
        const receivedParams = {
          value: null as Parameters<FrameEncoderFactory>[ 0 ] | null
        };
        const recorder = new AsyncLoopRecorder(
          host,
          "webm",
          makeEncoderFactory(
            addFrameCounter,
            receivedParams
          )
        );

        recorder.on(
          "stop",
          () => {
            // Simulates the browser-recorder hook's cleanup(), which decides
            // the final playback state from its own snapshot and must not be
            // clobbered by a resume() firing after this listener returns.
            calls.push( "listener-pause-decision" );
            host.pause();
          }
        );

        await recorder.start();
        await recorder.stop();

        const resumeIdx = calls.indexOf( "resume" );
        const stopListenerIdx = calls.indexOf( "listener-pause-decision" );

        expect( resumeIdx ).toBeGreaterThanOrEqual( 0 );
        expect( stopListenerIdx ).toBeGreaterThanOrEqual( 0 );
        expect( resumeIdx ).toBeLessThan( stopListenerIdx );

        // The listener's decision, made after resume(), must be the final
        // call — not overwritten by a later resume().
        expect( calls[ calls.length - 1 ] ).toBe( "pause" );
      }
    );

    test(
      "leaves deterministic mode + resumes the host when setup fails",
      async() => {
        const calls: string[] = [];
        const host = makeHost(
          4,
          30,
          calls
        );

        // Force a setup failure after deterministic mode is entered.
        host.resetToStart = async() => {
          calls.push( "reset" );
          throw new Error( "boom" );
        };

        const addFrameCounter = {
          count: 0
        };
        const receivedParams = {
          value: null as Parameters<FrameEncoderFactory>[ 0 ] | null
        };
        const recorder = new AsyncLoopRecorder(
          host,
          "webm",
          makeEncoderFactory(
            addFrameCounter,
            receivedParams
          )
        );

        await expect( recorder.start() ).rejects.toThrow( "boom" );

        // The host must not be left paused or stuck in recording mode.
        expect( calls ).toContain( "begin" );
        expect( calls ).toContain( "end" );
        expect( calls ).toContain( "resume" );
        expect( calls.indexOf( "end" ) ).toBeLessThan( calls.indexOf( "resume" ) );
      }
    );
  }
);
