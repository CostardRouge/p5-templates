# Recording Progression Steps System

## Overview

The recording progression system provides real-time feedback to users about the status of their recording jobs. This document describes the centralized, maintainable architecture for managing recording steps.

## Architecture

### Centralized Configuration

All step definitions are centralized in `src/lib/progression/stepConfig.ts`. This single source of truth ensures consistency across the entire application.

**Key Benefits:**
- ✅ Single place to add/modify/remove steps
- ✅ Type-safe step references
- ✅ Consistent labels across UI components
- ✅ Easy to maintain and extend
- ✅ No hardcoded strings scattered in codebase

### Step Definitions

Steps are organized into two categories:

#### Recording Steps
Steps that occur during the recording phase:
1. **Launching Browser** - Browser initialization
2. **Capturing Frames** - Frame capture from canvas
3. **Encoding Video** - Video encoding from frames

#### Upload Steps
Steps that occur during the upload phase:
1. **Archiving** - Creating archive (multi-slide only)
2. **S3** - Uploading to S3 storage

## Usage

### Importing Step Definitions

```typescript
import {
  RECORDING_STEPS,
  UPLOAD_STEPS,
  buildRecordingStepPath,
  buildSlideStepPath,
  buildUploadStepPath,
  getStepLabel,
} from "@/lib/progression/stepConfig";
```

### Accessing Step Keys and Labels

```typescript
// Get step key
const stepKey = RECORDING_STEPS.SAVING_FRAMES.key; // "saving-frames"

// Get step label
const stepLabel = RECORDING_STEPS.SAVING_FRAMES.label; // "Capturing frames"

// Get label by key (useful for dynamic lookups)
const label = getStepLabel("saving-frames"); // "Capturing frames"
```

### Building Step Paths

Step paths are used to update progression in Redis:

```typescript
// Single recording steps
buildRecordingStepPath(RECORDING_STEPS.LAUNCHING_BROWSER.key)
// => "recording.launching-browser"

// Multi-slide recording steps
buildSlideStepPath(0, RECORDING_STEPS.SAVING_FRAMES.key)
// => "recording.slide-0.saving-frames"

// Upload steps
buildUploadStepPath(UPLOAD_STEPS.S3.key)
// => "uploading.s3"
```

### Updating Step Progress

```typescript
import { updateRecordingStepPercentage } from "@/lib/progression";
import { RECORDING_STEPS, buildRecordingStepPath } from "@/lib/progression/stepConfig";

// Update single recording step
await updateRecordingStepPercentage(
  jobId,
  buildRecordingStepPath(RECORDING_STEPS.SAVING_FRAMES.key),
  50 // percentage
);

// Update multi-slide step
await updateRecordingStepPercentage(
  jobId,
  buildSlideStepPath(slideIndex, RECORDING_STEPS.ENCODING_FRAMES.key),
  75
);
```

### UI Components

The `CompactProgressBar` component automatically uses the centralized configuration:

```typescript
import { RECORDING_STEPS, createStepLabelMap } from "@/lib/progression/stepConfig";

// Create label map for quick lookups
const STEP_LABELS = createStepLabelMap();

// Access step in component
const stepLabel = RECORDING_STEPS.SAVING_FRAMES.label;
```

## Step Flow

### Single Recording Flow

```
1. Launching Browser (0-100%)
   └─> recording.launching-browser

2. Capturing Frames (0-100%)
   └─> recording.saving-frames

3. Encoding Video (0-100%)
   └─> recording.encoding-frames

4. Uploading (0-100%)
   └─> uploading
```

### Multi-Slide Recording Flow

```
1. Launching Browser (0-100%) [shared]
   └─> recording.launching-browser

2. For each slide:
   a. Capturing Frames (0-100%)
      └─> recording.slide-{N}.saving-frames
   
   b. Encoding Video (0-100%)
      └─> recording.slide-{N}.encoding-frames

3. Uploading to S3 (0-100%)
   └─> uploading.s3
```

## Adding New Steps

To add a new step to the system:

### 1. Define the Step

Add the step definition to `src/lib/progression/stepConfig.ts`:

```typescript
export const RECORDING_STEPS: Record<string, StepDefinition> = {
  // ... existing steps
  NEW_STEP: {
    key: "new-step",
    label: "New Step Label",
    order: 4, // Position in sequence
  },
} as const;
```

### 2. Update Step Structure

Add the step to the initial structure in `src/lib/progression/steps.ts`:

```typescript
export const recordingSketchSteps: RecordingProgressionSteps = {
  recording: {
    steps: {
      // ... existing steps
      [RECORDING_STEPS.NEW_STEP.key]: {
        percentage: 0,
      },
    },
  },
  // ...
};
```

### 3. Update Recording Logic

Add progress updates in `src/lib/recordSketch.ts`:

```typescript
await updateRecordingStepPercentage(
  jobId,
  buildRecordingStepPath(RECORDING_STEPS.NEW_STEP.key),
  percentage
);
```

### 4. Update UI Logic

Add step handling in `src/components/CompactProgressBar.tsx`:

```typescript
if ( ( recSteps[RECORDING_STEPS.NEW_STEP.key]?.percentage ?? 100 ) < 100 ) {
  return RECORDING_STEPS.NEW_STEP.label;
}
```

## File Structure

```
src/lib/progression/
├── stepConfig.ts          # ⭐ Centralized step definitions
├── steps.ts               # Step structure initialization
└── index.ts               # Progression update functions

src/components/
└── CompactProgressBar.tsx # UI component using step config

src/lib/
└── recordSketch.ts        # Recording logic with step updates
```

## Best Practices

### ✅ DO

- Use `RECORDING_STEPS` and `UPLOAD_STEPS` constants for all step references
- Use helper functions (`buildRecordingStepPath`, etc.) to construct paths
- Import step definitions from `stepConfig.ts`
- Keep step order values sequential and meaningful

### ❌ DON'T

- Hardcode step keys like `"saving-frames"` anywhere
- Hardcode step labels like `"Capturing frames"` anywhere
- Manually construct step paths with string concatenation
- Duplicate step definitions across files

## Migration Notes

The refactoring centralized all step definitions that were previously scattered across:
- `src/components/CompactProgressBar.tsx` (hardcoded labels)
- `src/lib/progression/steps.ts` (hardcoded keys)
- `src/lib/recordSketch.ts` (hardcoded paths)

All these have been replaced with references to the centralized configuration in `stepConfig.ts`.

## Type Safety

The system uses TypeScript's `as const` assertion to ensure:
- Step keys are literal types
- Autocomplete works in IDEs
- Typos are caught at compile time
- Refactoring is safe and reliable

```typescript
// TypeScript knows the exact type
const key: "saving-frames" = RECORDING_STEPS.SAVING_FRAMES.key;
```

## Testing

When testing progression updates, use the centralized constants:

```typescript
import { RECORDING_STEPS, buildRecordingStepPath } from "@/lib/progression/stepConfig";

// Test step path construction
expect(buildRecordingStepPath(RECORDING_STEPS.SAVING_FRAMES.key))
  .toBe("recording.saving-frames");

// Test label retrieval
expect(RECORDING_STEPS.SAVING_FRAMES.label)
  .toBe("Capturing frames");
```

## Future Enhancements

Potential improvements to the system:

1. **Step Weights** - Add weight/duration estimates for better progress calculation
2. **Step Dependencies** - Define which steps depend on others
3. **Conditional Steps** - Steps that only appear under certain conditions
4. **Step Metadata** - Additional data like icons, colors, descriptions
5. **Internationalization** - Multi-language support for step labels
