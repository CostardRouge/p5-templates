# Bug Fix: Draft Recordings Showing 100% Completion

## Issue

Draft recordings were incorrectly showing a green "Completed 100%" progress bar.

## Root Cause

The `CompactProgressBar` component had a logic error:

```typescript
// OLD CODE - BUGGY
const isActive = job.status === 'active' || job.status === 'queued';

// For completed recordings, show simple progress bar
if (!isActive) {  // ❌ This catches draft, failed, cancelled, AND completed!
  return (
    <div>
      <span>Completed</span>
      <span>100%</span>
      <div className="bg-green-500 w-full" />  // ❌ Always 100% green
    </div>
  );
}
```

**Problem:** The condition `!isActive` was too broad. It matched:
- ✅ Completed recordings (correct)
- ❌ Draft recordings (wrong!)
- ❌ Failed recordings (wrong!)
- ❌ Cancelled recordings (wrong!)

## Solution

Split the logic to handle each status explicitly:

```typescript
// NEW CODE - FIXED
const isActive = job.status === 'active' || job.status === 'queued';
const progress = job.progress || 0;

// 1. Handle completed recordings specifically
if (job.status === 'completed') {
  return (
    <div>
      <span>Completed</span>
      <span className="text-green-600">100%</span>
      <div className="bg-green-500 w-full" />  // ✅ Green at 100%
    </div>
  );
}

// 2. Handle draft/failed/cancelled recordings
if (!isActive) {
  return (
    <div>
      <span className="capitalize">{job.status}</span>  // ✅ Shows "Draft", "Failed", etc.
      <span>{progress}%</span>  // ✅ Shows actual progress (0% for drafts)
      <div 
        className="bg-gray-400"  // ✅ Gray, not green
        style={{ width: `${progress}%` }}  // ✅ Actual width, not 100%
      />
    </div>
  );
}

// 3. Handle active/queued recordings (existing code)
return (
  <div>
    {/* Detailed progress with steps */}
  </div>
);
```

## Visual Comparison

### Before (Buggy)

**Draft Recording:**
```
Completed                                              100%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    (green bar)
```
❌ Wrong! Shows as completed when it's just a draft.

### After (Fixed)

**Draft Recording:**
```
Draft                                                    0%
(empty gray bar)
```
✅ Correct! Shows draft status with 0% progress.

**Completed Recording:**
```
Completed                                              100%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    (green bar)
```
✅ Correct! Shows completed status with 100% green bar.

**Failed Recording (at 45%):**
```
Failed                                                  45%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    (gray bar at 45%)
```
✅ Correct! Shows failed status with actual progress.

## Status Handling Summary

| Status | Label | Color | Width | Expandable |
|--------|-------|-------|-------|------------|
| **active** | Current step | Blue | Progress % | Yes ✓ |
| **queued** | Current step | Blue | Progress % | Yes ✓ |
| **completed** | "Completed" | Green | 100% | No |
| **draft** | "Draft" | Gray | 0% | No |
| **failed** | "Failed" | Gray | Progress % | No |
| **cancelled** | "Cancelled" | Gray | Progress % | No |

## Code Changes

**File:** `src/components/CompactProgressBar.tsx`

**Lines Changed:** ~15 lines

**Impact:** 
- ✅ Fixed draft recordings showing 100%
- ✅ Added proper handling for failed/cancelled recordings
- ✅ Improved visual distinction between statuses
- ✅ Better user experience

## Testing

### Test Cases

1. **Draft Recording (0% progress)**
   - ✅ Shows "Draft" label
   - ✅ Shows 0% percentage
   - ✅ Shows empty gray bar
   - ✅ Not expandable

2. **Active Recording (45% progress)**
   - ✅ Shows current step name
   - ✅ Shows 45% percentage
   - ✅ Shows blue progress bar
   - ✅ Expandable to see steps

3. **Completed Recording (100% progress)**
   - ✅ Shows "Completed" label
   - ✅ Shows 100% percentage
   - ✅ Shows full green bar
   - ✅ Not expandable

4. **Failed Recording (60% progress)**
   - ✅ Shows "Failed" label
   - ✅ Shows 60% percentage
   - ✅ Shows gray bar at 60%
   - ✅ Not expandable

5. **Cancelled Recording (30% progress)**
   - ✅ Shows "Cancelled" label
   - ✅ Shows 30% percentage
   - ✅ Shows gray bar at 30%
   - ✅ Not expandable

## Related Fixes

This bug was also related to the `getRecordingSteps` utility fix, which now properly handles draft/queued recordings:

```typescript
// In getRecordingSteps utility
if (progress === 0 || job.status === 'draft' || job.status === 'queued') {
  return stepConfig.map(config => ({
    status: 'pending',
    percentage: 0,
  }));
}
```

This ensures that draft recordings always get pending steps with 0% progress.

## Conclusion

The bug is now fixed! Draft recordings correctly show:
- ✅ "Draft" label (not "Completed")
- ✅ 0% progress (not 100%)
- ✅ Gray bar (not green)
- ✅ Empty bar (not full)

All recording statuses now have appropriate visual representation.
