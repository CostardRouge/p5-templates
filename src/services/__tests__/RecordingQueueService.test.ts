import {
  RecordingQueueService
} from "@/services/RecordingQueueService";

const getJobCounts = jest.fn();

jest.mock(
  "bullmq",
  () => ( {
    Queue: jest.fn().mockImplementation( () => ( {
      on: jest.fn(),
      getJobCounts
    } ) )
  } )
);

// uuid 14 ships ESM only, which this CommonJS jest setup cannot load.
jest.mock(
  "uuid",
  () => ( {
    v4: () => "generated-id"
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
  () => ( {} )
);

jest.mock(
  "@/lib/connections/s3",
  () => ( {} )
);

jest.mock(
  "@/lib/progression",
  () => ( {} )
);

describe(
  "RecordingQueueService.getQueueHealth",
  () => {
    it(
      "counts prioritized jobs as waiting — every job is enqueued with a priority",
      async() => {
        getJobCounts.mockResolvedValue( {
          waiting: 1,
          prioritized: 3,
          active: 2,
          completed: 4,
          failed: 5
        } );

        await expect( RecordingQueueService.getInstance().getQueueHealth() ).resolves.toEqual( {
          waiting: 4,
          active: 2,
          completed: 4,
          failed: 5
        } );
        expect( getJobCounts ).toHaveBeenCalledWith(
          "waiting",
          "prioritized",
          "active",
          "completed",
          "failed"
        );
      }
    );
  }
);
