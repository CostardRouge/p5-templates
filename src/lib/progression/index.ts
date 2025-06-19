import {
  RecordingProgressionSteps,
  JobId, RecordingProgressionStream, RecordingProgressionNestedSteps
} from "@/types/recording.types";
import Redis from "@/lib/connections/redis";

const getKey = ( jobId: JobId ) => `recordingStatus:${ jobId }`;

export const addRecordingStatus = async(
  jobId: JobId, status: string
) => {
  const key = getKey( jobId );
  const existing = await Redis.getInstance().get( key );
  const parsed = existing ? JSON.parse( existing ) : {
  };

  parsed.status = status;

  await Redis.getInstance().set(
    key,
    JSON.stringify( parsed )
  );
};

export const addRecordingSteps = async(
  jobId: JobId, steps: RecordingProgressionSteps, status: string
) => {
  const key = getKey( jobId );
  const existing = await Redis.getInstance().get( key );
  const parsed = existing ? JSON.parse( existing ) : {
  };

  await Redis.getInstance().set(
    key,
    JSON.stringify( {
      ...parsed,
      steps,
      status
    } )
  );
};

export const getRecordingStatus = async( jobId: JobId ) => {
  const key = getKey( jobId );
  const existing = await Redis.getInstance().get( key );

  return existing ? JSON.parse( existing ) : null;
};

export const getRecordingSteps = async( jobId: JobId ) => {
  return ( await getRecordingStatus( jobId ) )?.steps;
};

export const updateRecordingStepPercentage = async(
  jobId: string,
  stepPath: string,
  percentage: number
): Promise<void> => {
  const jobRecordingSteps = await getRecordingSteps( jobId );

  if ( !jobRecordingSteps ) {
    return;
  }

  const splitUpPath = `${ stepPath.replaceAll(
    ".",
    ".steps."
  ) }.percentage`;

  try {
    const keys = splitUpPath.split( "." );
    let current = jobRecordingSteps;

    for ( let i = 0; i < keys.length - 1; i++ ) {
      const key = keys[ i ];

      // @ts-ignore
      if ( !current[ key ] ) {
        // @ts-ignore
        current[ key ] = {
        };
      }

      // @ts-ignore
      current = current[ key ];
    }

    const lastKey = keys[ keys.length - 1 ];

    // @ts-ignore
    current[ lastKey ] = percentage;

    const currentStatus = await getRecordingStatus( jobId );

    if ( !currentStatus ) {
      return;
    }

    await Redis.getInstance().set(
      getKey( jobId ),
      JSON.stringify( {
        ...currentStatus,
        steps: jobRecordingSteps
      } )
    );
  }
  catch ( error ) {
    console.error(
      "updateRecordingStepPercentage failed:",
      {
        error
      }
    );
  }
};

export const getRecordingStatusAndTotalPercentage = async( jobId: string ): Promise<RecordingProgressionStream | null> => {
  const jobRecordingStatus = await getRecordingStatus( jobId );

  if ( !jobRecordingStatus ) {
    return null;
  }

  const jobRecordingSteps = jobRecordingStatus.steps;

  let total = 0;
  let count = 0;

  let currentStep: {
    name: string;
    percentage: number
  } | null = null;

  const walk = (
    obj: RecordingProgressionSteps | RecordingProgressionNestedSteps, path: string[] = [
    ]
  ) => {
    for ( const key in obj ) {
      // @ts-ignore
      const value = obj[ key ];

      if ( value && typeof value === "object" ) {
        if ( "percentage" in value && typeof value.percentage === "number" ) {
          total += value.percentage;
          count++;

          if ( currentStep === null && value.percentage < 100 ) {
            currentStep = {
              name: [
                ...path,
                key
              ]
                .join( "." )
                .replaceAll(
                  ".steps.",
                  "."
                ),
              percentage: value.percentage
            };
          }
        }

        if ( "steps" in value ) {
          walk(
            value.steps,
            [
              ...path,
              key
            ]
          );
        }
      }
    }
  };

  if ( jobRecordingSteps ) {
    walk( jobRecordingSteps );
  }

  return {
    currentStep,
    percentage: count === 0 ? 0 : Math.round( total / count ),
    ...jobRecordingStatus
  };
};
