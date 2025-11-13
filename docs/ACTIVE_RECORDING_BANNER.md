# Active Recording Banner Component

A dedicated component for displaying active recording progress at the top of the recordings page.

## Overview

The `ActiveRecordingBanner` component shows a prominent progress display for all currently active recordings. It automatically manages start times and displays detailed step-by-step progress.

## Features

- 🔴 **Live Indicator**: Pulsing red dot for active recordings
- 📊 **Detailed Progress**: Shows all 5 recording steps
- ⏱️ **Elapsed Time**: Real-time counter
- 🔗 **Quick Navigation**: Link to recording details
- 🎯 **Auto-hide**: Only shows when recordings are active
- 🔄 **Self-contained**: Manages its own state

## Usage

### Basic Usage

```tsx
import ActiveRecordingBanner from '@/components/ActiveRecordingBanner';

<ActiveRecordingBanner jobs={inFlightJobs} />
```

### In Recordings Page

```tsx
export default function RecordingsPage() {
  const [inFlightJobs, setInFlightJobs] = useState<JobModel[]>([]);

  return (
    <div className="space-y-6 p-6">
      {/* Active Recording Banner */}
      <ActiveRecordingBanner jobs={inFlightJobs} />

      {/* Rest of the page */}
      <div>...</div>
    </div>
  );
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `jobs` | `JobModel[]` | Yes | Array of all in-flight jobs (will filter for active ones) |
| `className` | `string` | No | Additional CSS classes |

## Component Behavior

### Automatic Filtering
The component automatically filters the provided jobs array to show only active recordings:
```tsx
const activeRecordings = jobs.filter((j) => j.status === 'active');
```

### Auto-hide
If no active recordings exist, the component returns `null` and renders nothing.

### Start Time Tracking
The component internally tracks when each recording started using a ref:
```tsx
const recordingStartTimesRef = useRef<Record<string, number>>({});
```

This ensures:
- No re-renders when tracking start times
- Accurate elapsed time calculation
- Automatic cleanup when recordings complete

## Visual Design

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ 🔴 Recording: my-template                    View Details → │
│    #abc12345                                                 │
│                                                              │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ 🔄 Capturing frames              1:23        45%  ˅  │   │
│ │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │   │
│ │ Step 2 of 5 • 1 completed                            │   │
│ └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Elements

1. **Live Indicator**
   - Pulsing red dot (12px × 12px)
   - Animated with `animate-ping`
   - Solid red center with transparent pulse

2. **Recording Info**
   - Template name
   - Job ID (first 8 characters)
   - "View Details →" link

3. **Progress Bar**
   - Uses `ProgressBar` component (detailed variant)
   - Shows all 5 recording steps
   - Expandable to see full details
   - Real-time elapsed time

## Recording Steps

The component uses the `getRecordingSteps` utility to calculate step progress:

1. **Launching browser** (0-10%)
2. **Capturing frames** (10-40%)
3. **Saving frames** (40-60%)
4. **Encoding video** (60-95%)
5. **Finalizing** (95-100%)

See [Recording Steps Utility](./RECORDING_STEPS_UTIL.md) for details.

## Multiple Active Recordings

The component supports multiple active recordings simultaneously:

```tsx
// If 3 recordings are active, shows 3 banners
<ActiveRecordingBanner jobs={[job1, job2, job3]} />
```

Each recording gets its own banner with:
- Independent progress tracking
- Separate elapsed time counter
- Individual step progress

## Integration Example

### Full Recordings Page Integration

```tsx
'use client';

import { useState, useEffect } from 'react';
import ActiveRecordingBanner from '@/components/ActiveRecordingBanner';
import { JobModel } from '@/types/recording.types';

export default function RecordingsPage() {
  const [inFlightJobs, setInFlightJobs] = useState<JobModel[]>([]);
  const [staticJobs, setStaticJobs] = useState<JobModel[]>([]);

  useEffect(() => {
    // Fetch recordings
    fetch('/api/recordings')
      .then(res => res.json())
      .then((data: JobModel[]) => {
        const inFlight = data.filter(j => 
          ['queued', 'active'].includes(j.status)
        );
        const static = data.filter(j => 
          ['draft', 'completed', 'failed', 'cancelled'].includes(j.status)
        );
        
        setInFlightJobs(inFlight);
        setStaticJobs(static);
      });
  }, []);

  return (
    <div className="space-y-6 p-6">
      {/* Active Recording Banner - Automatically shows/hides */}
      <ActiveRecordingBanner jobs={inFlightJobs} />

      {/* Page Header */}
      <div>
        <h1>Recordings</h1>
      </div>

      {/* Recordings List */}
      <div>
        {/* Table or cards view */}
      </div>
    </div>
  );
}
```

## Styling

### Default Styling
The component uses Tailwind CSS with these key classes:
- `space-y-4`: Spacing between multiple banners
- `space-y-2`: Spacing within each banner
- `text-sm`, `text-xs`: Typography sizes
- `font-semibold`, `font-mono`: Font weights

### Custom Styling
Add custom classes via the `className` prop:

```tsx
<ActiveRecordingBanner 
  jobs={jobs}
  className="mb-8 border-b pb-6"
/>
```

## Performance

### Optimizations
1. **Ref-based tracking**: No re-renders for start time updates
2. **Automatic filtering**: Only processes active recordings
3. **Conditional rendering**: Returns null when no active recordings
4. **Memoized calculations**: Step calculations are efficient

### Re-render Triggers
The component only re-renders when:
- `jobs` array changes (new jobs or status updates)
- Progress updates from SSE stream
- Elapsed time updates (every 1 second for active recordings)

## Related Components

- **ProgressBar**: Used internally for detailed progress display
- **CompactProgressBar**: Used in table/card views
- **getRecordingSteps**: Utility for calculating step progress

## Related Documentation

- [Progress Bar Component](./PROGRESS_BAR_COMPONENT.md)
- [Recording Steps Utility](./RECORDING_STEPS_UTIL.md)
- [Progress Components Guide](./PROGRESS_COMPONENTS_GUIDE.md)

## Tips

1. **Pass all in-flight jobs** - The component will filter for active ones
2. **Place at top of page** - Most visible location for active recordings
3. **Don't wrap in conditional** - Component handles its own visibility
4. **Update jobs array** - Component reacts to job status changes
5. **Use with SSE** - Real-time updates work seamlessly

## Troubleshooting

### Banner not showing
- Check that jobs array contains active recordings
- Verify job.status === 'active'
- Ensure jobs array is being updated

### Elapsed time not updating
- Check that recording is active
- Verify component is receiving updated jobs
- Ensure no parent component is blocking re-renders

### Multiple banners overlapping
- Check CSS spacing (space-y-4)
- Verify each job has unique ID
- Ensure proper key prop in map

### Progress not updating
- Verify SSE connection is working
- Check that jobs array is being updated
- Ensure progress values are changing
