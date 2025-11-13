# Compact Progress Bar Component

A space-efficient progress bar with expandable details, perfect for table and card views.

## Features

- ✅ **Compact Design**: Minimal space usage in lists
- ✅ **Click to Expand**: Floating popover shows detailed steps
- ✅ **Real-time Updates**: Live elapsed time and progress
- ✅ **Smart Display**: Simple bar for completed recordings
- ✅ **Step Details**: Full step breakdown in popover
- ✅ **Dark Mode**: Full dark mode support

## Usage

### Basic Usage

```tsx
import CompactProgressBar from '@/components/CompactProgressBar';

<CompactProgressBar
  job={job}
  steps={getRecordingSteps(job)}
  startTime={startTime}
/>
```

### In Table View

```tsx
<td className="px-4 py-3">
  <div className="min-w-[200px]">
    <CompactProgressBar
      job={job}
      steps={job.status === 'active' ? getRecordingSteps(job) : []}
      startTime={recordingStartTimesRef.current[job.id]}
    />
  </div>
</td>
```

### In Card View

```tsx
<div className="pt-1">
  <CompactProgressBar
    job={job}
    steps={job.status === 'active' ? getRecordingSteps(job) : []}
    startTime={recordingStartTimesRef.current[job.id]}
  />
</div>
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `job` | `JobModel` | Yes | The recording job object |
| `steps` | `ProgressStep[]` | No | Array of progress steps (only for active recordings) |
| `startTime` | `number` | No | Start timestamp for elapsed time |
| `className` | `string` | No | Additional CSS classes |

## Component Behavior

### Active/Queued Recordings

When a recording is active or queued:
- Shows current step name with spinner icon
- Displays elapsed time (if startTime provided)
- Shows overall percentage
- Displays step counter (e.g., "Step 2 of 5 • 1 completed")
- Click to expand and see all steps in floating popover

### Completed Recordings

When a recording is completed:
- Shows simple green progress bar at 100%
- Displays "Completed" label with 100%
- No expandable details (steps no longer relevant)

### Draft/Failed/Cancelled Recordings

When a recording is draft, failed, or cancelled:
- Shows simple gray progress bar
- Displays status label (e.g., "Draft", "Failed", "Cancelled")
- Shows actual progress percentage (usually 0% for drafts)
- No expandable details

## Popover Details

The expandable popover includes:

### Header
- Recording progress title
- Job ID (truncated)
- Overall percentage
- Elapsed time

### Steps List
Each step shows:
- Status icon (✓ checkmark, 🔄 spinner, number, or ✕ error)
- Step name
- Individual progress percentage (for active step)
- Progress bar (for active step)
- Color-coded background

### Interactions
- Click progress bar to toggle popover
- Click outside popover to close
- Smooth animations and transitions

## Visual Design

### Colors
- **Blue**: Active step and progress
- **Green**: Completed steps and finished recordings
- **Gray**: Pending steps
- **Red**: Error states

### Sizes
- Compact bar height: 2px (h-2)
- Icon size: 3px (w-3 h-3) in compact, 5px (w-5 h-5) in popover
- Font sizes: xs (12px) for main text, [10px] for metadata

### Animations
- Spinner rotation for active steps
- Pulse effect on progress bar
- Smooth expand/collapse transitions
- Progress bar width transitions (300ms)

## Examples

### Example 1: Active Recording in Table

```tsx
function RecordingsTable({ jobs }) {
  const recordingStartTimesRef = useRef({});

  // Track start times
  jobs.forEach(job => {
    if (job.status === 'active' && !recordingStartTimesRef.current[job.id]) {
      recordingStartTimesRef.current[job.id] = Date.now();
    }
  });

  return (
    <table>
      <tbody>
        {jobs.map(job => (
          <tr key={job.id}>
            <td>
              <CompactProgressBar
                job={job}
                steps={job.status === 'active' ? getSteps(job) : []}
                startTime={recordingStartTimesRef.current[job.id]}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### Example 2: Recording Card

```tsx
function RecordingCard({ job, startTime }) {
  return (
    <div className="card">
      <img src={job.thumbnail} />
      <div className="p-4">
        <h3>{job.template}</h3>
        
        {(job.status === 'active' || job.status === 'queued') && (
          <CompactProgressBar
            job={job}
            steps={getRecordingSteps(job)}
            startTime={startTime}
          />
        )}
      </div>
    </div>
  );
}
```

### Example 3: Custom Steps

```tsx
const customSteps = [
  { id: 'init', name: 'Initializing', status: 'completed', percentage: 100 },
  { id: 'process', name: 'Processing', status: 'active', percentage: 45 },
  { id: 'finalize', name: 'Finalizing', status: 'pending', percentage: 0 },
];

<CompactProgressBar
  job={job}
  steps={customSteps}
  startTime={Date.now() - 30000} // Started 30 seconds ago
/>
```

## Comparison with Other Progress Components

### CompactProgressBar
- **Use case**: Table/card views, inline progress
- **Size**: Minimal (compact)
- **Details**: Click to expand
- **Best for**: Lists with many items

### ProgressBar (Detailed)
- **Use case**: Prominent progress display
- **Size**: Large (always expanded)
- **Details**: Always visible or expandable
- **Best for**: Single active recording focus

### SimpleProgressBar
- **Use case**: Basic progress indication
- **Size**: Minimal
- **Details**: None
- **Best for**: Simple progress without steps

## Tips

1. **Only pass steps for active recordings** - Completed recordings don't need step details
2. **Track start times with useRef** - Avoid re-renders
3. **Use min-width in tables** - Ensure enough space for the component (min-w-[200px])
4. **Handle clicks properly** - Use `e.stopPropagation()` to prevent row clicks
5. **Cleanup start times** - Remove from ref when recording completes

## Accessibility

- Clickable elements have proper hover states
- Text is readable in both light and dark modes
- Proper contrast ratios for all colors
- Keyboard navigation support (click events work with Enter/Space)

## Performance

- Uses refs for start times (no re-renders)
- Popover only renders when expanded
- Smooth CSS transitions (no JavaScript animations)
- Minimal re-renders with proper React optimization
