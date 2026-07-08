/**
 * Regression tests for the safe p5 draw-loop helpers.
 *
 * The bug these guard against: toggling p5's `noLoop()` / `loop()` faster
 * than one browser frame leaves a trailing `requestAnimationFrame(_draw)`
 * queued, which then spawns a *second* `_draw` chain once looping resumes.
 * Two chains == double the draw rate == FPS readout shooting past the
 * configured target. The helpers must keep at most one pending draw frame.
 */
import {
  pauseLoop, resumeLoop, isPaused
} from "../loopControl.js";

/**
 * Minimal stand-in that mirrors the parts of p5's loop machinery the helpers
 * touch: an internal `_loop` flag, the `_requestAnimId` handle, and a
 * synchronous `loop()` that schedules a frame (as p5 does via `_draw`).
 */
function createFakeP5() {
  let nextHandle = 1;
  const scheduled = new Set<number>();

  ( global as any ).cancelAnimationFrame = ( id: number ) => {
    scheduled.delete( id );
  };

  const p: any = {
    _loop: false,
    _requestAnimId: 0,
    isLooping() {
      return this._loop;
    },
    noLoop() {
      this._loop = false;
    },
    loop() {
      if ( !this._loop ) {
        this._loop = true;
        // p5's loop() synchronously kicks a draw which schedules the next rAF.
        this._requestAnimId = nextHandle++;
        scheduled.add( this._requestAnimId );
      }
    },
    // Test helper: how many draw frames are still queued in the browser.
    // p5 only ever *tracks* one (`_requestAnimId`), but a leaked trailing
    // frame stays queued even though nothing tracks it — that's the bug.
    _pendingFrames() {
      return scheduled.size;
    }
  };

  return p;
}

describe(
  "loopControl",
  () => {
    it(
      "pauseLoop stops the loop and clears the trailing frame",
      () => {
        const p = createFakeP5();

        p.loop();
        expect( p._pendingFrames() ).toBe( 1 );

        pauseLoop( p );

        expect( p.isLooping() ).toBe( false );
        expect( p._requestAnimId ).toBe( 0 );
        expect( p._pendingFrames() ).toBe( 0 );
      }
    );

    it(
      "resumeLoop after pauseLoop keeps a single draw chain",
      () => {
        const p = createFakeP5();

        p.loop();
        pauseLoop( p );
        resumeLoop( p );

        expect( p.isLooping() ).toBe( true );
        expect( p._pendingFrames() ).toBe( 1 );
      }
    );

    it(
      "raw p5 loop() leaks a second chain across a quick noLoop/loop toggle",
      () => {
        // Baseline that documents the bug the helper exists to prevent:
        // resuming with p5's own loop() before the trailing frame fires
        // leaves two frames queued — a doubled draw rate.
        const p = createFakeP5();

        p.loop();
        p.noLoop(); // trailing frame still queued, not cancelled
        p.loop(); // schedules a fresh frame on top of the trailing one

        expect( p._pendingFrames() ).toBe( 2 );
      }
    );

    it(
      "resumeLoop never spawns a second chain across a quick toggle",
      () => {
        const p = createFakeP5();

        p.loop();
        p.noLoop(); // trailing frame still queued when we resume

        resumeLoop( p );

        // The trailing frame must have been cancelled — exactly one chain.
        expect( p.isLooping() ).toBe( true );
        expect( p._pendingFrames() ).toBe( 1 );
      }
    );

    it(
      "resumeLoop is a no-op while already looping (no duplicate chain)",
      () => {
        const p = createFakeP5();

        p.loop();
        expect( p._pendingFrames() ).toBe( 1 );

        resumeLoop( p );
        resumeLoop( p );

        expect( p._pendingFrames() ).toBe( 1 );
      }
    );

    it(
      "survives rapid pause/resume cycles without leaking frames",
      () => {
        const p = createFakeP5();

        p.loop();

        for ( let i = 0; i < 50; i++ ) {
          pauseLoop( p );
          resumeLoop( p );
        }

        expect( p.isLooping() ).toBe( true );
        expect( p._pendingFrames() ).toBe( 1 );
      }
    );

    it(
      "tolerates a null p5 instance",
      () => {
        expect( () => pauseLoop( null ) ).not.toThrow();
        expect( () => resumeLoop( null ) ).not.toThrow();
      }
    );

    it(
      "isPaused distinguishes an explicit pause from a never-touched instance",
      () => {
        const p = createFakeP5();

        expect( isPaused( p ) ).toBe( false );

        pauseLoop( p );
        expect( isPaused( p ) ).toBe( true );

        resumeLoop( p );
        expect( isPaused( p ) ).toBe( false );
      }
    );

    it(
      "isPaused tolerates a null p5 instance",
      () => {
        expect( isPaused( null ) ).toBe( false );
      }
    );
  }
);
