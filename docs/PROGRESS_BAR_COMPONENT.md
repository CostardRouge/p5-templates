# Progress Bar Component

A flexible, modern progress bar component for tracking recording and sketch generation progress.

## Features

- ✅ **Two Variants**: Simple and Detailed views
- ✅ **Real-time Updates**: Live elapsed time tracking
- ✅ **Step Management**: Track multiple steps with status indicators
- ✅ **Expandable Details**: Click to see all steps in detail
- ✅ **Visual Feedback**: Checkmarks, spinners, and progress bars
- ✅ **Dark Mode**: Full dark mode support
- ✅ **Smooth Animations**: Polished transitions and effects

## Usage

### Simple Progress Bar

```tsx
import ProgressBar from '@/components/ProgressBar';

<ProgressBar
  variant="simple"
  overallPercentage={65}
  showElapsedTime
  startTime={Date.now()}
  steps={[{ id: '1', name: 'Processing...', status: 'active' }]}
/>
```

### Detailed Progress with Steps

```tsx
import ProgressBar from '@/components/ProgressBar';
import { useProgress } from '@/hooks/useProgress';

function RecordingPage() {
  const progress = useProgress([
    { id: 'launch', name: 'Launching browser' },
    { id: 'capture', name: 'Capturing frames' },
    { id: 'encode', name: 'Encoding video' },
  ]);

  // Start a step
  progress.startStep('launch');
  
  // Update progress
  progress.updateStepProgress('launch', 50);
  
  // Complete a step
  progress.completeStep('launch');

  return (
    <ProgressBar
      variant="detailed"
      steps={progress.steps}
      currentStepIndex={progress.currentStepIndex}
      overallPercentage={progress.overallPercentage}
      showElapsedTime
      startTime={progress.startTime}
    />
  );
}
```

## Props

### ProgressBar

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `steps` | `ProgressStep[]` | `[]` | Array of progress steps |
| `currentStepIndex` | `number` | `0` | Index of current active step |
| `overallPercentage` | `number` | `0` | Overall progress percentage (0-100) |
| `showElapsedTime` | `boolean` | `false` | Show elapsed time counter |
| `startTime` | `number` | - | Start timestamp for elapsed time |
| `variant` | `'simple' \| 'detailed'` | `'simple'` | Display variant |
| `className` | `string` | `''` | Additional CSS classes |

### ProgressStep

```typescript
interface ProgressStep {
  id: string;
  name: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  percentage?: number;
}
```

## useProgress Hook

The `useProgress` hook manages step state and provides helper methods:

```typescript
const progress = useProgress([
  { id: 'step1', name: 'Step 1' },
  { id: 'step2', name: 'Step 2' },
]);

// Available methods
progress.startStep(stepId);           // Mark step as active
progress.completeStep(stepId);        // Mark step as completed
progress.updateStepProgress(stepId, percentage); // Update step progress
progress.errorStep(stepId);           // Mark step as error
progress.reset();                     // Reset all steps

// Available state
progress.steps;                       // Current steps array
progress.currentStepIndex;            // Current step index
progress.overallPercentage;           // Calculated overall percentage
progress.startTime;                   // Start timestamp
```

## Integration Examples

### Recording Page

```tsx
'use client';

import { useEffect } from 'react';
import ProgressBar from '@/components/ProgressBar';
import { useProgress } from '@/hooks/useProgress';

export default function RecordingPage() {
  const progress = useProgress([
    { id: 'launch', name: 'Launching browser' },
    { id: 'capture', name: 'Capturing frames' },
    { id: 'save', name: 'Saving frames' },
    { id: 'encode', name: 'Encoding video' },
  ]);

  useEffect(() => {
    // Your recording logic here
    async function startRecording() {
      progress.startStep('launch');
      // ... launch browser
      progress.completeStep('launch');

      progress.startStep('capture');
      // ... capture frames with progress updates
      progress.updateStepProgress('capture', 50);
      progress.completeStep('capture');
    }

    startRecording();
  }, []);

  return (
    <div className="container mx-auto p-6">
      <ProgressBar
        variant="detailed"
        steps={progress.steps}
        currentStepIndex={progress.currentStepIndex}
        overallPercentage={progress.overallPercentage}
        showElapsedTime
        startTime={progress.startTime}
      />
    </div>
  );
}
```

### Sketch Page

```tsx
'use client';

import ProgressBar from '@/components/ProgressBar';
import { useProgress } from '@/hooks/useProgress';

export default function SketchPage() {
  const progress = useProgress([
    { id: 'init', name: 'Initializing sketch' },
    { id: 'render', name: 'Rendering slides' },
    { id: 'save', name: 'Saving sketch' },
  ]);

  return (
    <div className="container mx-auto p-6">
      {progress.overallPercentage < 100 && (
        <ProgressBar
          variant="detailed"
          steps={progress.steps}
          currentStepIndex={progress.currentStepIndex}
          overallPercentage={progress.overallPercentage}
          showElapsedTime
          startTime={progress.startTime}
        />
      )}
    </div>
  );
}
```

## Design Features

- **Gradient Progress Bar**: Blue to indigo gradient with pulse animation
- **Status Icons**: 
  - ✓ Checkmark for completed steps
  - ⟳ Spinner for active steps
  - Numbers for pending steps
  - ✕ Error indicator
- **Color Coding**:
  - Blue: Active step
  - Green: Completed step
  - Gray: Pending step
  - Red: Error step
- **Expandable View**: Click to see all steps in detail
- **Responsive**: Works on all screen sizes
- **Accessible**: Proper ARIA labels and keyboard navigation

## Styling

The component uses Tailwind CSS and supports dark mode out of the box. Customize by passing additional classes via the `className` prop.

## Tips

1. Use `variant="simple"` for quick progress indicators
2. Use `variant="detailed"` for multi-step processes
3. Always provide meaningful step names
4. Update step progress frequently for smooth animations
5. Handle errors gracefully with `errorStep()`
