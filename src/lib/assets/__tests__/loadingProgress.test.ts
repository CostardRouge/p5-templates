/**
 * Unit tests for the asset-loading progress reporter: step lifecycle,
 * snapshot counters, subscriber notification, reset semantics, and the
 * pendingMedia integration that gates deterministic capture on in-flight
 * asset loads.
 */
import {
  beginLoadingStep,
  reportAssetLoading,
  subscribeLoadingProgress,
  getLoadingProgressSnapshot,
  resetLoadingProgress,
  planLoadingSteps,
  finishLoadingProgress
} from "../loadingProgress";
import {
  awaitPendingMedia
} from "../pendingMedia";

beforeEach( () => {
  resetLoadingProgress();
} );

describe(
  "beginLoadingStep",
  () => {
    it(
      "opens a pending step and settles it as loaded",
      async() => {
        const handle = beginLoadingStep(
          "image",
          "photo.jpg"
        );

        let snapshot = getLoadingProgressSnapshot();

        expect( snapshot.total ).toBe( 1 );
        expect( snapshot.pending ).toBe( 1 );
        expect( snapshot.settled ).toBe( false );
        expect( snapshot.steps[ 0 ] ).toMatchObject( {
          kind: "image",
          label: "photo.jpg",
          status: "pending"
        } );

        handle.loaded();
        await handle.promise;

        snapshot = getLoadingProgressSnapshot();
        expect( snapshot.pending ).toBe( 0 );
        expect( snapshot.loaded ).toBe( 1 );
        expect( snapshot.settled ).toBe( true );
        expect( snapshot.steps[ 0 ].settledAt ).toBeGreaterThanOrEqual( snapshot.steps[ 0 ].startedAt );
      }
    );

    it(
      "records failures separately and is idempotent",
      async() => {
        const handle = beginLoadingStep(
          "font",
          "serif"
        );

        handle.failed( new Error( "404" ) );
        handle.loaded(); // must not overwrite the failed status
        await handle.promise;

        const snapshot = getLoadingProgressSnapshot();

        expect( snapshot.failed ).toBe( 1 );
        expect( snapshot.loaded ).toBe( 0 );
        expect( snapshot.steps[ 0 ].status ).toBe( "failed" );
      }
    );
  }
);

describe(
  "reportAssetLoading",
  () => {
    it(
      "returns the same promise and settles the step on resolve",
      async() => {
        const promise = Promise.resolve( "buffer" );

        const result = await reportAssetLoading(
          "audio",
          "kick.wav",
          promise
        );

        expect( result ).toBe( "buffer" );

        // The step settles on the promise's microtask — flush once more.
        await Promise.resolve();

        const snapshot = getLoadingProgressSnapshot();

        expect( snapshot.loaded ).toBe( 1 );
        expect( snapshot.settled ).toBe( true );
      }
    );

    it(
      "marks the step failed when the promise rejects",
      async() => {
        const failing = Promise.reject( new Error( "boom" ) );

        await expect( reportAssetLoading(
          "video",
          "clip.mp4",
          failing
        ) ).rejects.toThrow( "boom" );

        await Promise.resolve();

        expect( getLoadingProgressSnapshot().failed ).toBe( 1 );
      }
    );
  }
);

describe(
  "subscribeLoadingProgress",
  () => {
    it(
      "fires immediately, then on every transition, and unsubscribes",
      async() => {
        const snapshots: number[] = [];

        const unsubscribe = subscribeLoadingProgress( ( snapshot ) => {
          snapshots.push( snapshot.pending );
        } );

        // Immediate call with the empty snapshot.
        expect( snapshots ).toEqual( [
          0
        ] );

        const handle = beginLoadingStep(
          "image",
          "a.png"
        );

        expect( snapshots ).toEqual( [
          0,
          1
        ] );

        handle.loaded();
        await handle.promise;

        expect( snapshots ).toEqual( [
          0,
          1,
          0
        ] );

        unsubscribe();
        beginLoadingStep(
          "image",
          "b.png"
        );
        expect( snapshots ).toHaveLength( 3 );
      }
    );
  }
);

describe(
  "resetLoadingProgress",
  () => {
    it(
      "drops recorded steps but keeps subscribers",
      () => {
        beginLoadingStep(
          "module",
          "sketch"
        );

        let last = -1;

        subscribeLoadingProgress( ( snapshot ) => {
          last = snapshot.total;
        } );

        expect( last ).toBe( 1 );

        resetLoadingProgress();
        expect( last ).toBe( 0 );

        beginLoadingStep(
          "image",
          "c.png"
        );
        expect( last ).toBe( 1 );
      }
    );
  }
);

describe(
  "pendingMedia integration",
  () => {
    it(
      "awaitPendingMedia waits for open loading steps",
      async() => {
        const handle = beginLoadingStep(
          "image",
          "slow.png"
        );

        let drained = false;

        const draining = awaitPendingMedia().then( () => {
          drained = true;
        } );

        await Promise.resolve();
        expect( drained ).toBe( false );

        handle.loaded();
        await draining;
        expect( drained ).toBe( true );
      }
    );
  }
);

describe(
  "planLoadingSteps",
  () => {
    it(
      "reports a total before any step opens",
      () => {
        planLoadingSteps( {
          module: 2,
          image: 3
        } );

        const snapshot = getLoadingProgressSnapshot();

        expect( snapshot.planned ).toBe( 5 );
        expect( snapshot.total ).toBe( 5 );
        expect( snapshot.steps ).toHaveLength( 0 );
        expect( snapshot.progress ).toBe( 0 );
      }
    );

    it(
      "widens by default and only shrinks when told to be exact",
      () => {
        planLoadingSteps( {
          image: 4
        } );
        planLoadingSteps( {
          image: 1
        } );

        expect( getLoadingProgressSnapshot().planned ).toBe( 4 );

        planLoadingSteps(
          {
            image: 1
          },
          {
            exact: true
          }
        );

        expect( getLoadingProgressSnapshot().planned ).toBe( 1 );
      }
    );

    it(
      "never lets the total fall below the steps actually opened",
      () => {
        beginLoadingStep(
          "image",
          "a.png"
        );
        beginLoadingStep(
          "image",
          "b.png"
        );

        planLoadingSteps(
          {
            image: 0
          },
          {
            exact: true
          }
        );

        expect( getLoadingProgressSnapshot().total ).toBe( 2 );
      }
    );
  }
);

describe(
  "progress",
  () => {
    it(
      "measures settled steps against the planned total",
      async() => {
        planLoadingSteps( {
          image: 4
        } );

        const first = beginLoadingStep(
          "image",
          "a.png"
        );
        const second = beginLoadingStep(
          "image",
          "b.png"
        );

        first.loaded();
        second.loaded();
        await Promise.all( [
          first.promise,
          second.promise
        ] );

        expect( getLoadingProgressSnapshot().progress ).toBeCloseTo(
          0.5,
          5
        );
      }
    );

    it(
      "stays below 1 while any step is still pending",
      async() => {
        const done = beginLoadingStep(
          "module",
          "p5"
        );
        const stuck = beginLoadingStep(
          "image",
          "slow.png"
        );

        done.loaded();
        await done.promise;

        expect( getLoadingProgressSnapshot().progress ).toBeLessThanOrEqual( 0.95 );
        expect( stuck ).toBeDefined();
      }
    );

    it(
      "counts a failed step as settled, so one dead asset cannot stall the bar",
      async() => {
        planLoadingSteps( {
          image: 2
        } );

        const ok = beginLoadingStep(
          "image",
          "a.png"
        );
        const broken = beginLoadingStep(
          "image",
          "gone.png"
        );

        ok.loaded();
        broken.failed( new Error( "404" ) );
        await Promise.all( [
          ok.promise,
          broken.promise
        ] );

        expect( getLoadingProgressSnapshot().progress ).toBe( 1 );
      }
    );

    it(
      "never decreases when an unplanned step widens the total",
      async() => {
        // The real case: images are planned, then a font opens mid-draw.
        planLoadingSteps( {
          image: 2
        } );

        const a = beginLoadingStep(
          "image",
          "a.png"
        );
        const b = beginLoadingStep(
          "image",
          "b.png"
        );

        a.loaded();
        b.loaded();
        await Promise.all( [
          a.promise,
          b.promise
        ] );

        const before = getLoadingProgressSnapshot().progress;

        expect( before ).toBe( 1 );

        const font = beginLoadingStep(
          "font",
          "serif"
        );
        const after = getLoadingProgressSnapshot();

        expect( after.total ).toBe( 3 );
        expect( after.progress ).toBeGreaterThanOrEqual( before );

        font.loaded();
        await font.promise;
      }
    );

    it(
      "is forced to 1 by finishLoadingProgress, covering a plan that overshot",
      async() => {
        // Warm image cache: 4 images planned, but only the modules open steps.
        planLoadingSteps( {
          module: 2,
          image: 4
        } );

        const first = beginLoadingStep(
          "module",
          "sketch"
        );
        const second = beginLoadingStep(
          "module",
          "p5"
        );

        first.loaded();
        second.loaded();
        await Promise.all( [
          first.promise,
          second.promise
        ] );

        expect( getLoadingProgressSnapshot().progress ).toBeLessThan( 1 );

        finishLoadingProgress();

        expect( getLoadingProgressSnapshot().progress ).toBe( 1 );
      }
    );

    it(
      "is cleared along with the plan on reset",
      () => {
        planLoadingSteps( {
          image: 3
        } );
        finishLoadingProgress();

        resetLoadingProgress();

        const snapshot = getLoadingProgressSnapshot();

        expect( snapshot.planned ).toBe( 0 );
        expect( snapshot.total ).toBe( 0 );
        expect( snapshot.progress ).toBe( 0 );
      }
    );
  }
);
