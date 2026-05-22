import {
  JobModel
} from "@/types/recording.types";

export interface RecordingStep {
  id: string;
  name: string;
  status: "pending" | "active" | "completed" | "error";
  percentage: number;
}

/**
 * Step configuration with progress range allocation
 * Each step gets a portion of the total 0-100% progress
 */
interface StepConfig {
  id: string;
  name: string;
  weight: number; // Percentage of total progress (0-100)
}

/**
 * Default recording steps configuration
 * Weights must sum to 100
 */
const DEFAULT_STEP_CONFIG: StepConfig[] = [
  {
    id: "launching-browser",
    name: "Launching browser",
    weight: 15
  },
  {
    id: "encoding",
    name: "Encoding video",
    weight: 75
  },
  {
    id: "upload",
    name: "Uploading",
    weight: 10
  }
];

/**
 * Calculate recording steps based on overall progress
 * Dynamically distributes progress across configured steps
 *
 * @param job - The recording job
 * @param stepConfig - Optional custom step configuration
 * @returns Array of recording steps with calculated status and percentage
 */
export function getRecordingSteps(
  job: JobModel,
  stepConfig: StepConfig[] = DEFAULT_STEP_CONFIG
): RecordingStep[] {
  const progress = job.progress || 0;

  // Handle draft/queued recordings (no progress yet)
  if ( progress === 0 || job.status === "draft" || job.status === "queued" ) {
    return stepConfig.map( ( config ) => ( {
      id: config.id,
      name: config.name,
      status: "pending" as const,
      percentage: 0
    } ) );
  }

  // Calculate cumulative progress ranges for each step
  let cumulativeProgress = 0;
  const stepRanges = stepConfig.map( ( config ) => {
    const start = cumulativeProgress;
    const end = cumulativeProgress + config.weight;

    cumulativeProgress = end;
    return {
      ...config,
      start,
      end
    };
  } );

  // Calculate status and percentage for each step
  return stepRanges.map( (
    range, index
  ) => {
    let status: "pending" | "active" | "completed" | "error";
    let percentage: number;

    if ( progress < range.start ) {
      // Step hasn't started yet
      status = "pending";
      percentage = 0;
    } else if ( progress >= range.end ) {
      // Step is completed
      status = "completed";
      percentage = 100;
    } else {
      // Step is in progress
      status = "active";
      // Calculate percentage within this step's range
      const stepProgress = progress - range.start;
      const stepRange = range.end - range.start;

      percentage = Math.min(
        100,
        Math.max(
          0,
          ( stepProgress / stepRange ) * 100
        )
      );
    }

    return {
      id: range.id,
      name: range.name,
      status,
      percentage
    };
  } );
}

/**
 * Get the current step index from a list of steps
 */
export function getCurrentStepIndex( steps: RecordingStep[] ): number {
  const index = steps.findIndex( ( s ) => s.status === "active" );

  return index >= 0 ? index : 0;
}

/**
 * Get the number of completed steps
 */
export function getCompletedStepsCount( steps: RecordingStep[] ): number {
  return steps.filter( ( s ) => s.status === "completed" ).length;
}

/**
 * Create custom step configuration
 * Useful for different recording types or templates
 *
 * @example
 * const customSteps = createStepConfig([
 *   { id: 'init', name: 'Initializing', weight: 20 },
 *   { id: 'process', name: 'Processing', weight: 60 },
 *   { id: 'finish', name: 'Finishing', weight: 20 },
 * ]);
 * const steps = getRecordingSteps(job, customSteps);
 */
export function createStepConfig( configs: StepConfig[] ): StepConfig[] {
  const totalWeight = configs.reduce(
    (
      sum, config
    ) => sum + config.weight,
    0
  );

  if ( Math.abs( totalWeight - 100 ) > 0.01 ) {
    console.warn( `Step weights sum to ${ totalWeight }%, expected 100%. Normalizing...` );

    // Normalize weights to sum to 100
    return configs.map( ( config ) => ( {
      ...config,
      weight: ( config.weight / totalWeight ) * 100
    } ) );
  }

  return configs;
}
