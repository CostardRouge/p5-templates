/**
 * @jest-environment jsdom
 */

import {
  act, renderHook, waitFor
} from "@testing-library/react";

import useRecordings from "../useRecordings";

/**
 * The recordings page streams progress for every in-flight job over one
 * EventSource. It used to close and re-open that connection on every
 * progress message (the subscription effect depended on the job array the
 * message had just changed), losing whatever was sent in between.
 */

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  closed = false;
  onmessage: ( ( event: {
    data: string;
  } ) => void ) | null = null;
  onerror: ( ( event: unknown ) => void ) | null = null;

  constructor( url: string ) {
    this.url = url;
    FakeEventSource.instances.push( this );
  }

  close() {
    this.closed = true;
  }

  emit( payload: object ) {
    this.onmessage?.( {
      data: JSON.stringify( payload )
    } );
  }
}

const ACTIVE_JOB = {
  id: "job-a",
  sketch: "sketches/p5/rings/rings-v1",
  status: "active",
  progress: 0,
  createdAt: "2026-10-02T00:00:00.000Z"
};

beforeEach( () => {
  FakeEventSource.instances = [];
  ( globalThis as unknown as {
    EventSource: typeof FakeEventSource;
  } ).EventSource = FakeEventSource;
  globalThis.fetch = jest.fn( async( url: string ) => ( {
    ok: true,
    json: async() => ( String( url ).startsWith( "/api/recordings?status" ) ? [] : [
      ACTIVE_JOB
    ] )
  } ) ) as unknown as typeof fetch;
  jest.spyOn(
    console,
    "warn"
  ).mockImplementation( () => {} );
} );

afterEach( () => {
  jest.restoreAllMocks();
} );

function openStreams() {
  return FakeEventSource.instances.filter( ( source ) => !source.closed );
}

describe(
  "useRecordings progress stream",
  () => {
    it(
      "keeps one connection open across progress messages",
      async() => {
        const {
          result
        } = renderHook( () => useRecordings() );

        await waitFor( () => expect( result.current.inFlightJobs ).toHaveLength( 1 ) );
        await waitFor( () => expect( FakeEventSource.instances ).toHaveLength( 1 ) );

        const stream = FakeEventSource.instances[ 0 ];

        expect( stream.url ).toBe( "/api/progression/stream?ids=job-a" );

        for ( const percentage of [
          10,
          20,
          30,
          40,
          50
        ] ) {
          act( () => {
            stream.emit( {
              jobId: "job-a",
              status: "active",
              percentage
            } );
          } );
        }

        expect( result.current.inFlightJobs[ 0 ].progress ).toBe( 50 );
        expect( FakeEventSource.instances ).toHaveLength( 1 );
        expect( stream.closed ).toBe( false );
      }
    );

    it(
      "stays open after a transport error so the browser can reconnect",
      async() => {
        const {
          result
        } = renderHook( () => useRecordings() );

        await waitFor( () => expect( result.current.inFlightJobs ).toHaveLength( 1 ) );
        await waitFor( () => expect( FakeEventSource.instances ).toHaveLength( 1 ) );

        act( () => {
          FakeEventSource.instances[ 0 ].onerror?.( new Event( "error" ) );
        } );

        expect( FakeEventSource.instances[ 0 ].closed ).toBe( false );
      }
    );

    it(
      "closes the stream once the last job finishes",
      async() => {
        const {
          result
        } = renderHook( () => useRecordings() );

        await waitFor( () => expect( FakeEventSource.instances ).toHaveLength( 1 ) );

        act( () => {
          FakeEventSource.instances[ 0 ].emit( {
            jobId: "job-a",
            status: "completed",
            percentage: 100
          } );
        } );

        await waitFor( () => expect( result.current.inFlightJobs ).toHaveLength( 0 ) );
        expect( openStreams() ).toHaveLength( 0 );
      }
    );
  }
);
