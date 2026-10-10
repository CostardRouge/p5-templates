jest.mock(
  "@/lib/connections/prisma",
  () => ( {
    prisma: {
      job: {
        update: jest.fn()
      }
    }
  } )
);
jest.mock(
  "@/lib/progression",
  () => ( {
    updateRecordingStatus: jest.fn()
  } )
);

import {
  prisma
} from "@/lib/connections/prisma";

import {
  updateJob, withFailureReasonRule
} from "../jobStore";

describe(
  "the failure reason on a job",
  () => {
    it(
      "is cleared by any status but failed, unless the caller sets it",
      () => {
        expect( withFailureReasonRule( {
          status: "queued"
        } ) ).toEqual( {
          status: "queued",
          error: null
        } );
        expect( withFailureReasonRule( {
          status: "completed",
          progress: 100
        } ) ).toEqual( {
          status: "completed",
          progress: 100,
          error: null
        } );
        expect( withFailureReasonRule( {
          status: "failed",
          error: "boom"
        } ) ).toEqual( {
          status: "failed",
          error: "boom"
        } );
        // An update that does not touch the status leaves the reason alone.
        expect( withFailureReasonRule( {
          progress: 40
        } ) ).toEqual( {
          progress: 40
        } );
      }
    );

    it(
      "is what updateJob writes",
      async() => {
        await updateJob(
          "job-1",
          {
            status: "queued"
          }
        );

        expect( prisma.job.update ).toHaveBeenCalledWith( {
          where: {
            id: "job-1"
          },
          data: {
            status: "queued",
            error: null
          }
        } );
      }
    );
  }
);
