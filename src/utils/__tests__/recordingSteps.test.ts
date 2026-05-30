/**
 * Tests for recordingSteps utility
 * Run with: npm test recordingSteps.test.ts
 */

import {
  getRecordingSteps,
  createStepConfig,
  getCurrentStepIndex,
  getCompletedStepsCount
} from "../recordingSteps";
import {
  JobModel
} from "@/types/recording.types";

describe(
  "getRecordingSteps",
  () => {
    const createJob = (
      progress: number,
      status: string = "active"
    ): JobModel => ( {
      id: "test-job",
      snapshotId: null,
      progress,
      status: status as any,
      template: "test-template",
      resultUrl: null,
      thumbnails: [],
      videoUrls: [],
      videoSizes: [],
      recordingStartAt: null,
      recordingEndAt: null,
      recordingDuration: null,
      options: {},
      createdAt: new Date(),
      updatedAt: new Date()
    } );

    describe(
      "Draft/Queued recordings",
      () => {
        it(
          "should return all pending steps for draft recordings",
          () => {
            const job = createJob(
              0,
              "draft"
            );
            const steps = getRecordingSteps( job );

            // Default config is 3 steps: launching-browser (15%) / encoding
            // (75%) / upload (10%).
            expect( steps ).toHaveLength( 3 );
            steps.forEach( ( step ) => {
              expect( step.status ).toBe( "pending" );
              expect( step.percentage ).toBe( 0 );
            } );
          }
        );

        it(
          "should return all pending steps for queued recordings",
          () => {
            const job = createJob(
              0,
              "queued"
            );
            const steps = getRecordingSteps( job );

            steps.forEach( ( step ) => {
              expect( step.status ).toBe( "pending" );
              expect( step.percentage ).toBe( 0 );
            } );
          }
        );

        it(
          "should return all pending steps for 0% progress",
          () => {
            const job = createJob(
              0,
              "active"
            );
            const steps = getRecordingSteps( job );

            steps.forEach( ( step ) => {
              expect( step.status ).toBe( "pending" );
              expect( step.percentage ).toBe( 0 );
            } );
          }
        );
      }
    );

    describe(
      "Progress distribution",
      () => {
        // Default ranges with the 15/75/10 split:
        //   launching-browser → 0..15
        //   encoding          → 15..90
        //   upload            → 90..100
        it(
          "activates the first step inside its range",
          () => {
            const job = createJob( 5 );
            const steps = getRecordingSteps( job );

            expect( steps[ 0 ].status ).toBe( "active" );
            expect( steps[ 0 ].percentage ).toBeCloseTo( 5 / 15 * 100 );
            expect( steps[ 1 ].status ).toBe( "pending" );
            expect( steps[ 2 ].status ).toBe( "pending" );
          }
        );

        it(
          "completes the first step and activates the second when progress crosses 15%",
          () => {
            const job = createJob( 25 );
            const steps = getRecordingSteps( job );

            expect( steps[ 0 ].status ).toBe( "completed" );
            expect( steps[ 0 ].percentage ).toBe( 100 );
            expect( steps[ 1 ].status ).toBe( "active" );
            expect( steps[ 1 ].percentage ).toBeCloseTo( ( 25 - 15 ) / 75 * 100 );
            expect( steps[ 2 ].status ).toBe( "pending" );
          }
        );

        it(
          "keeps the encoding step active mid-recording",
          () => {
            const job = createJob( 50 );
            const steps = getRecordingSteps( job );

            expect( steps[ 0 ].status ).toBe( "completed" );
            expect( steps[ 1 ].status ).toBe( "active" );
            expect( steps[ 1 ].percentage ).toBeCloseTo( ( 50 - 15 ) / 75 * 100 );
            expect( steps[ 2 ].status ).toBe( "pending" );
          }
        );

        it(
          "activates the upload step near completion",
          () => {
            const job = createJob( 97 );
            const steps = getRecordingSteps( job );

            expect( steps[ 0 ].status ).toBe( "completed" );
            expect( steps[ 1 ].status ).toBe( "completed" );
            expect( steps[ 2 ].status ).toBe( "active" );
            expect( steps[ 2 ].percentage ).toBeCloseTo( ( 97 - 90 ) / 10 * 100 );
          }
        );

        it(
          "should complete all steps at 100%",
          () => {
            const job = createJob( 100 );
            const steps = getRecordingSteps( job );

            steps.forEach( ( step ) => {
              expect( step.status ).toBe( "completed" );
              expect( step.percentage ).toBe( 100 );
            } );
          }
        );
      }
    );

    describe(
      "Custom step configuration",
      () => {
        it(
          "should work with custom 3-step configuration",
          () => {
            const customSteps = createStepConfig( [
              {
                id: "init",
                name: "Init",
                weight: 20
              },
              {
                id: "work",
                name: "Work",
                weight: 60
              },
              {
                id: "done",
                name: "Done",
                weight: 20
              }
            ] );

            const job = createJob( 50 );
            const steps = getRecordingSteps(
              job,
              customSteps
            );

            expect( steps ).toHaveLength( 3 );
            expect( steps[ 0 ].status ).toBe( "completed" ); // 0-20%
            expect( steps[ 1 ].status ).toBe( "active" ); // 20-80%, at 50% = 50% of range
            expect( steps[ 1 ].percentage ).toBe( 50 );
            expect( steps[ 2 ].status ).toBe( "pending" ); // 80-100%
          }
        );

        it(
          "should work with equal-weight steps",
          () => {
            const customSteps = createStepConfig( [
              {
                id: "step1",
                name: "Step 1",
                weight: 50
              },
              {
                id: "step2",
                name: "Step 2",
                weight: 50
              }
            ] );

            const job = createJob( 25 );
            const steps = getRecordingSteps(
              job,
              customSteps
            );

            expect( steps ).toHaveLength( 2 );
            expect( steps[ 0 ].status ).toBe( "active" );
            expect( steps[ 0 ].percentage ).toBe( 50 ); // 25% of 50% range
            expect( steps[ 1 ].status ).toBe( "pending" );
          }
        );
      }
    );
  }
);

describe(
  "createStepConfig",
  () => {
    it(
      "should return config as-is when weights sum to 100",
      () => {
        const config = [
          {
            id: "step1",
            name: "Step 1",
            weight: 50
          },
          {
            id: "step2",
            name: "Step 2",
            weight: 50
          }
        ];

        const result = createStepConfig( config );

        expect( result ).toEqual( config );
      }
    );

    it(
      "should normalize weights when they do not sum to 100",
      () => {
        const config = [
          {
            id: "step1",
            name: "Step 1",
            weight: 50
          },
          {
            id: "step2",
            name: "Step 2",
            weight: 60
          } // Total: 110
        ];

        const result = createStepConfig( config );

        expect( result[ 0 ].weight ).toBeCloseTo(
          45.45,
          1
        ); // 50/110 * 100
        expect( result[ 1 ].weight ).toBeCloseTo(
          54.55,
          1
        ); // 60/110 * 100
      }
    );

    it(
      "should handle small weight differences",
      () => {
        const config = [
          {
            id: "step1",
            name: "Step 1",
            weight: 33.33
          },
          {
            id: "step2",
            name: "Step 2",
            weight: 33.33
          },
          {
            id: "step3",
            name: "Step 3",
            weight: 33.33
          } // Total: 99.99
        ];

        const result = createStepConfig( config );
        // Should normalize to exactly 100
        const totalWeight = result.reduce(
          (
            sum, s
          ) => sum + s.weight,
          0
        );

        expect( totalWeight ).toBeCloseTo(
          100,
          5
        );
      }
    );
  }
);

describe(
  "getCurrentStepIndex",
  () => {
    it(
      "should return index of active step",
      () => {
        const steps = [
          {
            id: "1",
            name: "Step 1",
            status: "completed" as const,
            percentage: 100
          },
          {
            id: "2",
            name: "Step 2",
            status: "active" as const,
            percentage: 50
          },
          {
            id: "3",
            name: "Step 3",
            status: "pending" as const,
            percentage: 0
          }
        ];

        expect( getCurrentStepIndex( steps ) ).toBe( 1 );
      }
    );

    it(
      "should return 0 when no step is active",
      () => {
        const steps = [
          {
            id: "1",
            name: "Step 1",
            status: "pending" as const,
            percentage: 0
          },
          {
            id: "2",
            name: "Step 2",
            status: "pending" as const,
            percentage: 0
          }
        ];

        expect( getCurrentStepIndex( steps ) ).toBe( 0 );
      }
    );
  }
);

describe(
  "getCompletedStepsCount",
  () => {
    it(
      "should count completed steps correctly",
      () => {
        const steps = [
          {
            id: "1",
            name: "Step 1",
            status: "completed" as const,
            percentage: 100
          },
          {
            id: "2",
            name: "Step 2",
            status: "completed" as const,
            percentage: 100
          },
          {
            id: "3",
            name: "Step 3",
            status: "active" as const,
            percentage: 50
          },
          {
            id: "4",
            name: "Step 4",
            status: "pending" as const,
            percentage: 0
          }
        ];

        expect( getCompletedStepsCount( steps ) ).toBe( 2 );
      }
    );

    it(
      "should return 0 when no steps are completed",
      () => {
        const steps = [
          {
            id: "1",
            name: "Step 1",
            status: "active" as const,
            percentage: 50
          },
          {
            id: "2",
            name: "Step 2",
            status: "pending" as const,
            percentage: 0
          }
        ];

        expect( getCompletedStepsCount( steps ) ).toBe( 0 );
      }
    );
  }
);
