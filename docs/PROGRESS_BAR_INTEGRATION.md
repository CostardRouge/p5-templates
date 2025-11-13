# Progress Bar Integration - Recordings Page

## What You'll See

### Active Recording Progress (Top of Page)

When a recording is active, you'll see a prominent progress section at the top of the recordings page:

```
🔴 Recording: my-template
   #abc12345                                                    View Details →

┌─────────────────────────────────────────────────────────────────────────┐
│ 🔄 Capturing frames                                    1:23        45%  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ Step 2 of 5 • 1 completed                                               │
└─────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- 🔴 Live pulsing red indicator
- Real-time elapsed time (updates every second)
- Overall percentage
- Current step name
- Click to expand and see all steps

### Expanded View (Click to Open)

Click on the progress bar to see detailed step breakdown:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ✓  Launching browser                                              100%  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                          │
│ 🔄 Capturing frames                                                45%  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                          │
│ 3  Saving frames                                                        │
│                                                                          │
│ 4  Encoding video                                                       │
│                                                                          │
│ 5  Finalizing                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

**Step Indicators:**
- ✓ Green checkmark = Completed
- 🔄 Blue spinner = Active (with progress bar)
- Number = Pending
- ✕ Red X = Error (if something fails)

### Recording Steps Breakdown

The progress is distributed across 5 steps:

1. **Launching browser** (0-10%)
   - Browser initialization
   - Page loading

2. **Capturing frames** (10-40%)
   - Recording video frames
   - Longest step with detailed progress

3. **Saving frames** (40-60%)
   - Writing frames to disk
   - Processing captured data

4. **Encoding video** (60-95%)
   - Video compression
   - Format conversion

5. **Finalizing** (95-100%)
   - Cleanup
   - Final touches

### Table/Card View Progress (Compact with Popover)

In the main recordings list, you'll see a compact progress bar that can be clicked to show details:

**Compact View (Default):**
```
🔄 Capturing frames                                    0:04  29%  ˅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 2 of 5 • 1 completed
```

**Expanded View (Click to Open):**
```
┌─────────────────────────────────────────────────────────────────┐
│ Recording Progress                                    29%       │
│ #abc12345                                            0:04       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ✓  Launching browser                                            │
│                                                                  │
│ 🔄 Capturing frames                                       63%   │
│    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                  │
│ 3  Saving frames                                                │
│                                                                  │
│ 4  Encoding video                                               │
│                                                                  │
│ 5  Finalizing                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Completed Recordings:**
For completed recordings, a simple green progress bar is shown:
```
Completed                                                      100%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Design Features

### Colors
- **Blue gradient**: Active progress (from-blue-500 to-blue-600)
- **Green**: Completed steps
- **Gray**: Pending steps
- **Red**: Recording indicator & errors

### Animations
- Pulsing red dot for live recordings
- Smooth progress bar transitions (300ms)
- Spinner rotation for active steps
- Pulse effect on progress bar gradient

### Interactions
- Click progress bar to expand/collapse details
- Hover effects on all interactive elements
- Smooth transitions between states

## Technical Details

### State Management
- `recordingStartTimes`: Tracks when each recording started for elapsed time
- `getRecordingSteps()`: Calculates step status based on overall progress
- Real-time updates via SSE (Server-Sent Events)

### Components Used
- `ProgressBar` (detailed variant) - For active recordings
- `SimpleProgressBar` - For table/card views
- Both support dark mode automatically

### Performance
- Only active recordings show detailed progress
- Elapsed time updates every 1 second
- Progress updates are throttled by SSE stream
- Minimal re-renders with proper React optimization

## Usage in Other Pages

You can use the same progress bar in the sketch page or any other page:

```tsx
import ProgressBar from '@/components/ProgressBar';
import { useProgress } from '@/hooks/useProgress';

function SketchPage() {
  const progress = useProgress([
    { id: 'init', name: 'Initializing sketch' },
    { id: 'render', name: 'Rendering slides' },
    { id: 'save', name: 'Saving sketch' },
  ]);

  // Control progress
  progress.startStep('init');
  progress.updateStepProgress('init', 50);
  progress.completeStep('init');

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

## Customization

The component is highly flexible:

- Change step names and count
- Adjust progress distribution
- Customize colors via Tailwind classes
- Add custom icons or indicators
- Modify animation speeds
- Add error handling

See `docs/PROGRESS_BAR_COMPONENT.md` for full API documentation.
