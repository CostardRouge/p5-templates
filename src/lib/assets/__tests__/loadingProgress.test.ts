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
  resetLoadingProgress
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
