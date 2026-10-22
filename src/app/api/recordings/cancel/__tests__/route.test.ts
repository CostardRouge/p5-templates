import {
  NextRequest
} from "next/server";

import {
  POST
} from "../route";
import {
  getJobById, updateJob
} from "@/lib/jobStore";
import {
  RecordingQueueService
} from "@/services/RecordingQueueService";

jest.mock(
  "@/lib/jobStore",
  () => ( {
    getJobById: jest.fn(),
    updateJob: jest.fn().mockResolvedValue( undefined )
  } )
);

jest.mock(
  "@/services/RecordingQueueService",
  () => ( {
    RecordingQueueService: {
      getInstance: jest.fn()
    }
  } )
);

const mockedGetJobById = getJobById as jest.Mock;
const mockedUpdateJob = updateJob as jest.Mock;

function queueWith( states: Record<string, string> ) {
  const removed: string[] = [];

  ( RecordingQueueService.getInstance as jest.Mock ).mockReturnValue( {
    getQueue: () => ( {
      getJob: async( id: string ) => ( states[ id ]
        ? {
          getState: async() => states[ id ],
          remove: async() => {
            removed.push( id );
          }
        }
        : undefined )
    } )
  } );

  return removed;
}

function cancel( ids: string[] ) {
  return POST( new NextRequest(
    "http://localhost/api/recordings/cancel",
    {
      method: "POST",
      body: JSON.stringify( {
        ids
      } )
    }
  ) );
}

describe(
  "POST /api/recordings/cancel",
  () => {
    beforeEach( () => {
      jest.clearAllMocks();
      mockedGetJobById.mockImplementation( async( id: string ) => ( {
        id,
        status: "queued"
      } ) );
      jest.spyOn(
        console,
        "warn"
      ).mockImplementation( () => {} );
    } );

    afterEach( () => {
      jest.restoreAllMocks();
    } );

    it(
      "cancels a queued job, which BullMQ holds as prioritized (every job is added with a priority)",
      async() => {
        const removed = queueWith( {
          a: "prioritized",
          b: "waiting",
          c: "delayed"
        } );

        const response = await cancel( [
          "a",
          "b",
          "c"
        ] );

        expect( ( await response.json() ).cancelled ).toEqual( [
          "a",
          "b",
          "c"
        ] );
        expect( removed ).toEqual( [
          "a",
          "b",
          "c"
        ] );
        expect( mockedUpdateJob ).toHaveBeenCalledWith(
          "a",
          {
            status: "cancelled",
            progress: 100
          }
        );
      }
    );

    it(
      "does not remove a job a worker is running",
      async() => {
        const removed = queueWith( {
          a: "active"
        } );

        const response = await cancel( [
          "a"
        ] );

        expect( ( await response.json() ).cancelled ).toEqual( [] );
        expect( removed ).toEqual( [] );
        expect( mockedUpdateJob ).not.toHaveBeenCalled();
      }
    );
  }
);
