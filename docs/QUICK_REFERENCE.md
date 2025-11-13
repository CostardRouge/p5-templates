# Progress Components - Quick Reference

## Import Cheat Sheet

```typescript
// Components
import ActiveRecordingBanner from '@/components/ActiveRecordingBanner';
import CompactProgressBar from '@/components/CompactProgressBar';
import ProgressBar from '@/components/ProgressBar';
import SimpleProgressBar from '@/components/SimpleProgressBar';

// Utilities
import { 
  getRecordingSteps, 
  getCurrentStepIndex, 
  getCompletedStepsCount 
} from '@/utils/recordingSteps';
```

## Quick Usage

### Active Recording Banner
```tsx
<ActiveRecordingBanner jobs={inFlightJobs} />
```

### Compact Progress Bar (Table/Card)
```tsx
<CompactProgressBar
  job={job}
  steps={job.status === 'active' ? getRecordingSteps(job) : []}
  startTime={startTime}
/>
```

### Detailed Progress Bar
```tsx
<ProgressBar
  variant="detailed"
  steps={getRecordingSteps(job)}
  currentStepIndex={getCurrentStepIndex(steps)}
  overallPercentage={job.progress}
  showElapsedTime
  startTime={startTime}
/>
```

### Simple Progress Bar
```tsx
<SimpleProgressBar
  progress={job.progress}
  status={job.status}
/>
```

### Get Recording Steps
```typescript
const steps = getRecordingSteps(job);
const currentIndex = getCurrentStepIndex(steps);
const completedCount = getCompletedStepsCount(steps);
```

## When to Use What

| Scenario | Component | Why |
|----------|-----------|-----|
| Top of page banner | ActiveRecordingBanner | Prominent, detailed |
| Table row | CompactProgressBar | Space-efficient, expandable |
| Card view | CompactProgressBar | Compact, detailed on click |
| Simple indicator | SimpleProgressBar | Minimal, no steps |
| Custom layout | ProgressBar + utility | Full control |

## File Locations

```
src/
├── components/
│   ├── ActiveRecordingBanner.tsx
│   ├── CompactProgressBar.tsx
│   ├── ProgressBar.tsx
│   └── SimpleProgressBar.tsx
└── utils/
    └── recordingSteps.ts

docs/
├── ACTIVE_RECORDING_BANNER.md
├── COMPACT_PROGRESS_BAR.md
├── PROGRESS_BAR_COMPONENT.md
├── RECORDING_STEPS_UTIL.md
├── PROGRESS_COMPONENTS_GUIDE.md
└── QUICK_REFERENCE.md (this file)
```

## Common Patterns

### Pattern 1: Recordings Page
```tsx
export default function RecordingsPage() {
  const [inFlightJobs, setInFlightJobs] = useState([]);
  const recordingStartTimesRef = useRef({});

  // Track start times
  inFlightJobs.forEach(job => {
    if (job.status === 'active' && !recordingStartTimesRef.current[job.id]) {
      recordingStartTimesRef.current[job.id] = Date.now();
    }
  });

  return (
    <div>
      {/* Banner */}
      <ActiveRecordingBanner jobs={inFlightJobs} />
      
      {/* Table */}
      <table>
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
      </table>
    </div>
  );
}
```

### Pattern 2: Custom Progress Display
```tsx
import { getRecordingSteps, getCurrentStepIndex } from '@/utils/recordingSteps';

function CustomProgress({ job }) {
  const steps = getRecordingSteps(job);
  const currentIndex = getCurrentStepIndex(steps);
  const currentStep = steps[currentIndex];

  return (
    <div>
      <h3>{currentStep.name}</h3>
      <p>{currentStep.percentage}%</p>
    </div>
  );
}
```

### Pattern 3: Step List
```tsx
import { getRecordingSteps } from '@/utils/recordingSteps';

function StepsList({ job }) {
  const steps = getRecordingSteps(job);

  return (
    <ul>
      {steps.map(step => (
        <li key={step.id}>
          {step.status === 'completed' && '✓'}
          {step.status === 'active' && '🔄'}
          {step.name}
        </li>
      ))}
    </ul>
  );
}
```

## Props Quick Reference

### ActiveRecordingBanner
| Prop | Type | Required |
|------|------|----------|
| jobs | JobModel[] | Yes |
| className | string | No |

### CompactProgressBar
| Prop | Type | Required |
|------|------|----------|
| job | JobModel | Yes |
| steps | ProgressStep[] | No |
| startTime | number | No |
| className | string | No |

### ProgressBar
| Prop | Type | Required |
|------|------|----------|
| variant | 'simple' \| 'detailed' | No |
| steps | ProgressStep[] | No |
| currentStepIndex | number | No |
| overallPercentage | number | No |
| showElapsedTime | boolean | No |
| startTime | number | No |
| className | string | No |

### SimpleProgressBar
| Prop | Type | Required |
|------|------|----------|
| progress | number | Yes |
| status | JobStatus | No |

## Recording Steps

| Step | Progress Range | Duration |
|------|----------------|----------|
| Launching browser | 0-10% | 10% |
| Capturing frames | 10-40% | 30% |
| Saving frames | 40-60% | 20% |
| Encoding video | 60-95% | 35% |
| Finalizing | 95-100% | 5% |

## Troubleshooting

### Issue: Infinite loop
**Solution:** Use `useRef` for start times, not `useState`

### Issue: Progress not updating
**Solution:** Check SSE connection and job updates

### Issue: Popover not showing
**Solution:** Ensure steps array is not empty

### Issue: Elapsed time not showing
**Solution:** Verify startTime is provided and valid

## Best Practices

1. ✅ Use `useRef` for start times
2. ✅ Only pass steps for active recordings
3. ✅ Clean up start times when recording completes
4. ✅ Use appropriate component for context
5. ✅ Provide adequate space (min-w-[200px] for compact)

## Links

- [Full Documentation](./PROGRESS_COMPONENTS_GUIDE.md)
- [Active Recording Banner](./ACTIVE_RECORDING_BANNER.md)
- [Compact Progress Bar](./COMPACT_PROGRESS_BAR.md)
- [Recording Steps Utility](./RECORDING_STEPS_UTIL.md)
