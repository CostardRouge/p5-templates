# Progress Components Guide

A comprehensive guide to all progress bar components in the application.

## Component Overview

| Component | Use Case | Size | Expandable | Steps | Time |
|-----------|----------|------|------------|-------|------|
| **CompactProgressBar** | Table/Card views | Compact | Yes (popover) | Yes | Yes |
| **ProgressBar** (detailed) | Active recording banner | Large | Yes (inline) | Yes | Yes |
| **SimpleProgressBar** | Basic progress | Minimal | No | No | No |

## When to Use Each Component

### CompactProgressBar ✨ NEW

**Perfect for:**
- Table rows with multiple recordings
- Card grids with many items
- Inline progress in lists
- Space-constrained layouts

**Features:**
- Compact single-line display
- Click to expand floating popover
- Shows current step and percentage
- Elapsed time counter
- Full step details in popover
- Smart display (simple bar for completed)

**Example:**
```tsx
<CompactProgressBar
  job={job}
  steps={job.status === 'active' ? getRecordingSteps(job) : []}
  startTime={recordingStartTimesRef.current[job.id]}
/>
```

### ProgressBar (Detailed Variant)

**Perfect for:**
- Prominent active recording display
- Top-of-page progress banner
- Single recording focus
- When steps should always be visible

**Features:**
- Large, prominent display
- Expandable inline details
- Always shows current step
- Elapsed time and percentage
- Full step breakdown when expanded

**Example:**
```tsx
<ProgressBar
  variant="detailed"
  steps={steps}
  currentStepIndex={currentStepIndex}
  overallPercentage={progress}
  showElapsedTime
  startTime={startTime}
/>
```

### SimpleProgressBar

**Perfect for:**
- Basic progress indication
- When steps are not needed
- Minimal UI requirements
- Legacy support

**Features:**
- Simple progress bar
- Percentage display
- No step details
- Minimal space

**Example:**
```tsx
<SimpleProgressBar
  progress={job.progress}
  status={job.status}
/>
```

## Visual Comparison

### CompactProgressBar (Collapsed)
```
🔄 Capturing frames                    0:04  29%  ˅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 2 of 5 • 1 completed
```
**Height:** ~40px

### CompactProgressBar (Expanded)
```
🔄 Capturing frames                    0:04  29%  ˄
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 2 of 5 • 1 completed

┌─────────────────────────────────────────────┐
│ Recording Progress              29%         │
│ #abc12345                      0:04         │
├─────────────────────────────────────────────┤
│ ✓  Launching browser                        │
│ 🔄 Capturing frames               63%       │
│    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ 3  Saving frames                            │
│ 4  Encoding video                           │
│ 5  Finalizing                               │
└─────────────────────────────────────────────┘
```
**Height:** ~40px + floating popover

### ProgressBar Detailed (Collapsed)
```
┌─────────────────────────────────────────────────────────┐
│ 🔄 Capturing frames                    1:23      45%  ˅ │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ Step 2 of 5 • 1 completed                               │
└─────────────────────────────────────────────────────────┘
```
**Height:** ~80px

### ProgressBar Detailed (Expanded)
```
┌─────────────────────────────────────────────────────────┐
│ 🔄 Capturing frames                    1:23      45%  ˄ │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ Step 2 of 5 • 1 completed                               │
│                                                          │
│ ✓  Launching browser                              100% │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                          │
│ 🔄 Capturing frames                                45% │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                          │
│ 3  Saving frames                                        │
│ 4  Encoding video                                       │
│ 5  Finalizing                                           │
└─────────────────────────────────────────────────────────┘
```
**Height:** ~300px

### SimpleProgressBar
```
Progress                                           45%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
**Height:** ~30px

## Implementation Examples

### Recordings Page Layout

```tsx
export default function RecordingsPage() {
  // ... state management

  return (
    <div className="space-y-6 p-6">
      {/* Active Recording Banner - Use ProgressBar (detailed) */}
      {activeRecordings.map(job => (
        <div key={job.id}>
          <ProgressBar
            variant="detailed"
            steps={getRecordingSteps(job)}
            currentStepIndex={currentStepIndex}
            overallPercentage={job.progress}
            showElapsedTime
            startTime={startTime}
          />
        </div>
      ))}

      {/* Table View - Use CompactProgressBar */}
      <table>
        <tbody>
          {jobs.map(job => (
            <tr key={job.id}>
              <td>
                <CompactProgressBar
                  job={job}
                  steps={job.status === 'active' ? getRecordingSteps(job) : []}
                  startTime={recordingStartTimesRef.current[job.id]}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Card View - Use CompactProgressBar */}
      <div className="grid grid-cols-4 gap-4">
        {jobs.map(job => (
          <div key={job.id} className="card">
            <CompactProgressBar
              job={job}
              steps={job.status === 'active' ? getRecordingSteps(job) : []}
              startTime={recordingStartTimesRef.current[job.id]}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Migration Guide

### From SimpleProgressBar to CompactProgressBar

**Before:**
```tsx
<SimpleProgressBar
  progress={job.progress}
  status={job.status}
/>
```

**After:**
```tsx
<CompactProgressBar
  job={job}
  steps={job.status === 'active' ? getRecordingSteps(job) : []}
  startTime={recordingStartTimesRef.current[job.id]}
/>
```

**Benefits:**
- ✅ Shows step details on click
- ✅ Displays elapsed time
- ✅ Better UX for active recordings
- ✅ Smart display for completed recordings

## Best Practices

### 1. Use the Right Component

- **Many items in a list?** → CompactProgressBar
- **Single prominent recording?** → ProgressBar (detailed)
- **Just need a bar?** → SimpleProgressBar

### 2. Track Start Times Properly

```tsx
// ✅ Good - Use ref to avoid re-renders
const recordingStartTimesRef = useRef({});

// ❌ Bad - Causes infinite loops
const [recordingStartTimes, setRecordingStartTimes] = useState({});
```

### 3. Only Pass Steps for Active Recordings

```tsx
// ✅ Good - Conditional steps
steps={job.status === 'active' ? getRecordingSteps(job) : []}

// ❌ Bad - Always passing steps
steps={getRecordingSteps(job)}
```

### 4. Provide Adequate Space

```tsx
// ✅ Good - Enough space for compact bar
<div className="min-w-[200px]">
  <CompactProgressBar ... />
</div>

// ❌ Bad - Too narrow
<div className="w-20">
  <CompactProgressBar ... />
</div>
```

### 5. Handle Cleanup

```tsx
// Clean up start times when recording completes
if (job.status === 'completed') {
  delete recordingStartTimesRef.current[job.id];
}
```

## Styling Customization

All components support custom styling via className prop:

```tsx
<CompactProgressBar
  job={job}
  className="my-custom-class"
/>
```

## Dark Mode

All components automatically support dark mode using Tailwind's dark: variants.

## Performance Tips

1. Use refs for start times (no re-renders)
2. Only render steps for active recordings
3. Memoize step calculations if expensive
4. Use proper React keys in lists
5. Avoid inline function definitions in render

## Troubleshooting

### Progress bar not updating
- Check that job.progress is being updated
- Verify SSE connection is working
- Ensure component is receiving new props

### Elapsed time not showing
- Verify startTime is provided
- Check that startTime is a valid timestamp
- Ensure showElapsedTime is true (for ProgressBar)

### Popover not appearing
- Check that steps array is not empty
- Verify job.status is 'active' or 'queued'
- Ensure z-index is not being overridden

### Infinite loop errors
- Use useRef instead of useState for start times
- Check useEffect dependencies
- Avoid setting state in render

## Related Documentation

- [ProgressBar Component](./PROGRESS_BAR_COMPONENT.md)
- [CompactProgressBar Component](./COMPACT_PROGRESS_BAR.md)
- [Progress Bar Integration](./PROGRESS_BAR_INTEGRATION.md)
