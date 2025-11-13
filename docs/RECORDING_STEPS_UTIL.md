# Recording Steps Utility

Utility functions for calculating and managing recording step progress.

## Overview

The `recordingSteps.ts` utility provides functions to calculate recording progress across standardized steps, making it easy to display detailed progress information.

## Location

```
src/utils/recordingSteps.ts
```

## Functions

### getRecordingSteps

Calculates recording steps based on overall progress percentage.

**Signature:**
```typescript
function getRecordingSteps(job: JobModel): RecordingStep[]
```

**Parameters:**
- `job`: JobModel - The recording job object

**Returns:**
- `RecordingStep[]` - Array of 5 recording steps with status and percentage

**Example:**
```typescript
import { getRecordingSteps } from '@/utils/recordingSteps';

const job = { id: '123', progress: 45, status: 'active', ... };
const steps = getRecordingSteps(job);

// Returns:
// [
//   { id: 'launch', name: 'Launching browser', status: 'completed', percentage: 100 },
//   { id: 'capture', name: 'Capturing frames', status: 'active', percentage: 50 },
//   { id: 'save', name: 'Saving frames', status: 'pending', percentage: 0 },
//   { id: 'encode', name: 'Encoding video', status: 'pending', percentage: 0 },
//   { id: 'finalize', name: 'Finalizing', status: 'pending', percentage: 0 },
// ]
```

### getCurrentStepIndex

Gets the index of the currently active step.

**Signature:**
```typescript
function getCurrentStepIndex(steps: RecordingStep[]): number
```

**Parameters:**
- `steps`: RecordingStep[] - Array of recording steps

**Returns:**
- `number` - Index of active step (0-4), or 0 if none active

**Example:**
```typescript
import { getRecordingSteps, getCurrentStepIndex } from '@/utils/recordingSteps';

const steps = getRecordingSteps(job);
const currentIndex = getCurrentStepIndex(steps);
// Returns: 1 (if step 2 is active)
```

### getCompletedStepsCount

Counts the number of completed steps.

**Signature:**
```typescript
function getCompletedStepsCount(steps: RecordingStep[]): number
```

**Parameters:**
- `steps`: RecordingStep[] - Array of recording steps

**Returns:**
- `number` - Count of completed steps (0-5)

**Example:**
```typescript
import { getRecordingSteps, getCompletedStepsCount } from '@/utils/recordingSteps';

const steps = getRecordingSteps(job);
const completed = getCompletedStepsCount(steps);
// Returns: 1 (if only first step is completed)
```

### createStepConfig

Creates and validates custom step configuration with automatic weight normalization.

**Signature:**
```typescript
function createStepConfig(configs: StepConfig[]): StepConfig[]
```

**Parameters:**
- `configs`: StepConfig[] - Array of step configurations with weights

**Returns:**
- `StepConfig[]` - Validated and normalized step configuration

**Example:**
```typescript
import { createStepConfig, getRecordingSteps } from '@/utils/recordingSteps';

const customSteps = createStepConfig([
  { id: 'init', name: 'Initializing', weight: 25 },
  { id: 'work', name: 'Working', weight: 50 },
  { id: 'done', name: 'Done', weight: 25 },
]);

const steps = getRecordingSteps(job, customSteps);
```

## Types

### RecordingStep

```typescript
interface RecordingStep {
  id: string;                                    // Unique step identifier
  name: string;                                  // Display name
  status: 'pending' | 'active' | 'completed' | 'error';  // Current status
  percentage: number;                            // Progress percentage (0-100)
}
```

## Recording Steps Breakdown

The utility divides recording progress into 5 standard steps with configurable weights:

### 1. Launching browser (10% weight)
- Browser initialization
- Page loading
- Setup tasks

### 2. Capturing frames (30% weight)
- Recording video frames
- Longest step
- Most intensive processing

### 3. Saving frames (20% weight)
- Writing frames to disk
- Processing captured data
- Medium duration

### 4. Encoding video (35% weight)
- Video compression
- Format conversion
- Second longest step

### 5. Finalizing (5% weight)
- Cleanup tasks
- Final touches
- Quick step

**Note:** Weights are configurable and can be customized per template or recording type.

## Progress Distribution

The progress percentage is distributed dynamically based on step weights:

| Progress Range | Step | Weight |
|----------------|------|--------|
| 0-10% | Launching browser | 10% |
| 10-40% | Capturing frames | 30% |
| 40-60% | Saving frames | 20% |
| 60-95% | Encoding video | 35% |
| 95-100% | Finalizing | 5% |

**Dynamic Calculation:**
- Each step's range is calculated from its weight
- Weights must sum to 100%
- Progress is distributed proportionally
- Supports custom step configurations

## Usage Examples

### Example 1: Display Current Step

```typescript
import { getRecordingSteps, getCurrentStepIndex } from '@/utils/recordingSteps';

function RecordingStatus({ job }) {
  const steps = getRecordingSteps(job);
  const currentIndex = getCurrentStepIndex(steps);
  const currentStep = steps[currentIndex];

  return (
    <div>
      <p>Current Step: {currentStep.name}</p>
      <p>Progress: {currentStep.percentage}%</p>
    </div>
  );
}
```

### Example 2: Show All Steps

```typescript
import { getRecordingSteps } from '@/utils/recordingSteps';

function StepsList({ job }) {
  const steps = getRecordingSteps(job);

  return (
    <ul>
      {steps.map((step) => (
        <li key={step.id}>
          {step.status === 'completed' && '✓'}
          {step.status === 'active' && '🔄'}
          {step.status === 'pending' && '○'}
          {step.name} - {step.percentage}%
        </li>
      ))}
    </ul>
  );
}
```

### Example 3: Progress Summary

```typescript
import { getRecordingSteps, getCompletedStepsCount } from '@/utils/recordingSteps';

function ProgressSummary({ job }) {
  const steps = getRecordingSteps(job);
  const completed = getCompletedStepsCount(steps);

  return (
    <p>
      Step {completed + 1} of {steps.length} • {completed} completed
    </p>
  );
}
```

### Example 4: With Progress Bar Component

```typescript
import { getRecordingSteps, getCurrentStepIndex } from '@/utils/recordingSteps';
import ProgressBar from '@/components/ProgressBar';

function RecordingProgress({ job, startTime }) {
  const steps = getRecordingSteps(job);
  const currentIndex = getCurrentStepIndex(steps);

  return (
    <ProgressBar
      variant="detailed"
      steps={steps}
      currentStepIndex={currentIndex}
      overallPercentage={job.progress}
      showElapsedTime
      startTime={startTime}
    />
  );
}
```

## Implementation Details

### Step Status Calculation

The function determines step status based on progress:

```typescript
// Example for 45% progress:
// Step 1 (0-10%): completed (100%)
// Step 2 (10-40%): active (50% of this step)
// Step 3 (40-60%): pending (0%)
// Step 4 (60-95%): pending (0%)
// Step 5 (95-100%): pending (0%)

if (progress < 10) {
  steps[0].status = 'active';
  steps[0].percentage = progress * 10;
} else if (progress < 40) {
  steps[0].status = 'completed';
  steps[1].status = 'active';
  steps[1].percentage = ((progress - 10) / 30) * 100;
}
// ... and so on
```

### Percentage Calculation

Each step's percentage represents progress within that specific step:
- 0%: Step not started
- 1-99%: Step in progress
- 100%: Step completed

## Testing

### Test Cases

```typescript
// Test 1: Beginning of recording (5%)
const job1 = { progress: 5, status: 'active' };
const steps1 = getRecordingSteps(job1);
// Expected: Step 1 active at 50%

// Test 2: Middle of recording (45%)
const job2 = { progress: 45, status: 'active' };
const steps2 = getRecordingSteps(job2);
// Expected: Step 1 completed, Step 2 completed, Step 3 active at 25%

// Test 3: Near completion (98%)
const job3 = { progress: 98, status: 'active' };
const steps3 = getRecordingSteps(job3);
// Expected: Steps 1-4 completed, Step 5 active at 60%

// Test 4: Completed (100%)
const job4 = { progress: 100, status: 'completed' };
const steps4 = getRecordingSteps(job4);
// Expected: All steps completed at 100%
```

## Best Practices

1. **Always use with active recordings** - Steps are most relevant for in-progress recordings
2. **Cache results if needed** - Calculations are fast but can be memoized
3. **Handle edge cases** - Check for null/undefined progress values
4. **Use helper functions** - getCurrentStepIndex and getCompletedStepsCount simplify common tasks
5. **Consistent step names** - Don't modify step names for UI consistency

## Customization

### Custom Step Configuration

Create custom steps with different weights:

```typescript
import { getRecordingSteps, createStepConfig } from '@/utils/recordingSteps';

// Define custom steps
const customSteps = createStepConfig([
  { id: 'init', name: 'Initializing', weight: 20 },
  { id: 'process', name: 'Processing', weight: 60 },
  { id: 'finish', name: 'Finishing', weight: 20 },
]);

// Use custom steps
const steps = getRecordingSteps(job, customSteps);
```

### Template-Specific Steps

Different templates can have different step configurations:

```typescript
const stepConfigs = {
  'video-template': createStepConfig([
    { id: 'launch', name: 'Launching browser', weight: 10 },
    { id: 'capture', name: 'Capturing frames', weight: 40 },
    { id: 'encode', name: 'Encoding video', weight: 50 },
  ]),
  'screenshot-template': createStepConfig([
    { id: 'launch', name: 'Launching browser', weight: 30 },
    { id: 'capture', name: 'Taking screenshots', weight: 50 },
    { id: 'save', name: 'Saving images', weight: 20 },
  ]),
};

const steps = getRecordingSteps(job, stepConfigs[job.template]);
```

### Weight Normalization

The `createStepConfig` function automatically normalizes weights if they don't sum to 100:

```typescript
// Weights sum to 110 - will be normalized
const steps = createStepConfig([
  { id: 'step1', name: 'Step 1', weight: 50 },
  { id: 'step2', name: 'Step 2', weight: 60 }, // Total: 110
]);
// Result: step1 = 45.45%, step2 = 54.55%
```

## Related Components

- **ActiveRecordingBanner**: Uses this utility for banner display
- **CompactProgressBar**: Uses this utility for popover details
- **ProgressBar**: Compatible with the RecordingStep type

## Related Documentation

- [Active Recording Banner](./ACTIVE_RECORDING_BANNER.md)
- [Compact Progress Bar](./COMPACT_PROGRESS_BAR.md)
- [Progress Components Guide](./PROGRESS_COMPONENTS_GUIDE.md)
