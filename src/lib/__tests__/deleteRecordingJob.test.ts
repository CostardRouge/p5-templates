import {
  deleteRecordingJob
} from "@/lib/deleteRecordingJob";
import {
  deleteJob, getJobById
} from "@/lib/jobStore";
import {
  deleteJobArtifacts
} from "@/lib/connections/s3";
import {
  RecordingQueueService
} from "@/services/RecordingQueueService";

jest.mock(
  "@/lib/jobStore",
  () => ( {
    getJobById: jest.fn(),
    deleteJob: jest.fn()
  } )
);

jest.mock(
  "@/lib/connections/s3",
  () => ( {
    deleteJobArtifacts: jest.fn()
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

const JOB_ID = "3f1c2a9e-7b4d-4c1a-9e2f-0a1b2c3d4e5f";

const mockedGetJobById = getJobById as jest.MockedFunction<typeof getJobById>;
const mockedDeleteJob = deleteJob as jest.MockedFunction<typeof deleteJob>;
const mockedDeleteJobArtifacts = deleteJobArtifacts as jest.MockedFunction<typeof deleteJobArtifacts>;
const mockedGetInstance = RecordingQueueService.getInstance as jest.Mock;

function job( overrides: Record<string, unknown> = {} ) {
  return {
    id: JOB_ID,
    status: "completed",
    resultUrl: `${ JOB_ID }/video.mp4`,
    ...overrides
  } as unknown as Awaited<ReturnType<typeof getJobById>>;
}

describe(
  "deleteRecordingJob",
  () => {
    let removeBullJob: jest.Mock;

    beforeEach( () => {
      jest.clearAllMocks();
      jest.spyOn(
        console,
        "warn"
      ).mockImplementation( () => {} );
      jest.spyOn(
        console,
        "error"
      ).mockImplementation( () => {} );

      removeBullJob = jest.fn().mockResolvedValue( undefined );
      mockedGetInstance.mockReturnValue( {
        getQueue: () => ( {
          getJob: jest.fn().mockResolvedValue( {
            remove: removeBullJob
          } )
        } )
      } );
      mockedDeleteJobArtifacts.mockResolvedValue( undefined );
      mockedDeleteJob.mockResolvedValue( undefined );
    } );

    afterEach( () => {
      jest.restoreAllMocks();
    } );

    it(
      "reports a missing job without deleting anything",
      async() => {
        mockedGetJobById.mockResolvedValue( null );

        await expect( deleteRecordingJob( JOB_ID ) ).resolves.toBe( "not-found" );
        expect( mockedDeleteJobArtifacts ).not.toHaveBeenCalled();
        expect( mockedDeleteJob ).not.toHaveBeenCalled();
      }
    );

    it.each( [
      [
        "queued"
      ],
      [
        "active"
      ]
    ] )(
      "refuses a %s job",
      async( status ) => {
        mockedGetJobById.mockResolvedValue( job( {
          status
        } ) );

        await expect( deleteRecordingJob( JOB_ID ) ).resolves.toBe( "not-finalized" );
        expect( mockedDeleteJobArtifacts ).not.toHaveBeenCalled();
        expect( mockedDeleteJob ).not.toHaveBeenCalled();
      }
    );

    it(
      "removes the queue entry, the job's objects (resultUrl included) and the row",
      async() => {
        mockedGetJobById.mockResolvedValue( job( {
          resultUrl: "legacy/archive.zip"
        } ) );

        await expect( deleteRecordingJob( JOB_ID ) ).resolves.toBe( "deleted" );
        expect( removeBullJob ).toHaveBeenCalled();
        expect( mockedDeleteJobArtifacts ).toHaveBeenCalledWith(
          JOB_ID,
          [
            "legacy/archive.zip"
          ]
        );
        expect( mockedDeleteJob ).toHaveBeenCalledWith( JOB_ID );
      }
    );

    it(
      "passes no extra key when the job has no resultUrl",
      async() => {
        mockedGetJobById.mockResolvedValue( job( {
          status: "draft",
          resultUrl: null
        } ) );

        await deleteRecordingJob( JOB_ID );

        expect( mockedDeleteJobArtifacts ).toHaveBeenCalledWith(
          JOB_ID,
          []
        );
      }
    );

    it(
      "still deletes the row when queue and storage cleanup fail",
      async() => {
        mockedGetJobById.mockResolvedValue( job() );
        removeBullJob.mockRejectedValue( new Error( "locked" ) );
        mockedDeleteJobArtifacts.mockRejectedValue( new Error( "s3 down" ) );

        await expect( deleteRecordingJob( JOB_ID ) ).resolves.toBe( "deleted" );
        expect( mockedDeleteJob ).toHaveBeenCalledWith( JOB_ID );
      }
    );

    it(
      "reports a failed row delete",
      async() => {
        mockedGetJobById.mockResolvedValue( job() );
        mockedDeleteJob.mockRejectedValue( new Error( "db down" ) );

        await expect( deleteRecordingJob( JOB_ID ) ).resolves.toBe( "failed" );
      }
    );
  }
);
