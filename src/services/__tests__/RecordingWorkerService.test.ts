import {
  updateJob
} from "@/lib/jobStore";
import {
  RecordingQueueService
} from "@/services/RecordingQueueService";
import {
  RecordingWorkerService
} from "@/services/RecordingWorkerService";

/**
 * The worker's BullMQ event handlers, driven directly: the Worker class is
 * replaced by a stub that records what `on( event, handler )` registered
 * (jest hoists the jest.mock calls below above these imports).
 */

const handlers: Record<string, ( ...args: any[] ) => Promise<void> | void> = {};

jest.mock(
  "bullmq",
  () => ( {
    Worker: jest.fn().mockImplementation( () => ( {
      on: (
        event: string, handler: ( ...args: any[] ) => Promise<void>
      ) => {
        handlers[ event ] = handler;
      }
    } ) )
  } )
);

jest.mock(
  "@/lib/connections/redis",
  () => ( {
    __esModule: true,
    default: {
      getInstance: jest.fn()
    }
  } )
);

jest.mock(
  "@/lib/jobStore",
  () => ( {
    updateJob: jest.fn().mockResolvedValue( undefined )
  } )
);

jest.mock(
  "@/lib/runRecording",
  () => ( {
    __esModule: true,
    default: jest.fn()
  } )
);

jest.mock(
  "@/lib/progression",
  () => ( {
    updateRecordingStatus: jest.fn().mockResolvedValue( undefined )
  } )
);

jest.mock(
  "@/services/NotificationService",
  () => ( {
    NotificationService: {
      getInstance: () => ( {
        sendJobCompletionNotification: jest.fn().mockResolvedValue( undefined ),
        sendJobFailureNotification: jest.fn().mockResolvedValue( undefined )
      } )
    }
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

const mockedUpdateJob = updateJob as jest.MockedFunction<typeof updateJob>;
const JOB_ID = "3f1c2a9e-7b4d-4c1a-9e2f-0a1b2c3d4e5f";

function queueJobInState( state: string ) {
  // What bullmq does: retry() is only legal on a failed job.
  const retry = jest.fn().mockRejectedValue( new Error( "Job is not in the failed state" ) );

  ( RecordingQueueService.getInstance as jest.Mock ).mockReturnValue( {
    getQueue: () => ( {
      getJob: jest.fn().mockResolvedValue( {
        getState: jest.fn().mockResolvedValue( state ),
        retry
      } )
    } )
  } );

  return {
    retry
  };
}

describe(
  "RecordingWorkerService event handlers",
  () => {
    beforeAll( () => {
      RecordingWorkerService.getInstance();
    } );

    beforeEach( () => {
      mockedUpdateJob.mockClear();
      jest.spyOn(
        console,
        "log"
      ).mockImplementation( () => {} );
      jest.spyOn(
        console,
        "warn"
      ).mockImplementation( () => {} );
      jest.spyOn(
        console,
        "error"
      ).mockImplementation( () => {} );
    } );

    afterEach( () => {
      jest.restoreAllMocks();
    } );

    it.each( [
      [
        "waiting"
      ],
      [
        "prioritized"
      ],
      [
        "delayed"
      ]
    ] )(
      "marks a stalled job that BullMQ put back as %s as queued, without retrying it",
      async( state ) => {
        const {
          retry
        } = queueJobInState( state );

        await handlers.stalled( JOB_ID );

        expect( retry ).not.toHaveBeenCalled();
        expect( mockedUpdateJob ).toHaveBeenCalledWith(
          JOB_ID,
          {
            status: "queued",
            progress: 0
          }
        );
      }
    );

    it(
      "leaves a stalled job alone once a worker is running it again",
      async() => {
        const {
          retry
        } = queueJobInState( "active" );

        await handlers.stalled( JOB_ID );

        expect( retry ).not.toHaveBeenCalled();
        expect( mockedUpdateJob ).not.toHaveBeenCalled();
      }
    );

    it(
      "writes failed to the row when BullMQ fails a job, stall limit included",
      async() => {
        await handlers.failed(
          {
            id: JOB_ID
          },
          new Error( "job stalled more than allowable limit" )
        );

        // The reason is kept on the row too — the stall's own message here.
        expect( mockedUpdateJob ).toHaveBeenCalledWith(
          JOB_ID,
          {
            status: "failed",
            error: "job stalled more than allowable limit"
          }
        );
      }
    );
  }
);
