# Stalled Job Recovery Fix

## Problem
Recording jobs would get stuck in "queued" status and not start processing. When a new recording was cloned and started, the stalled job would suddenly become active. This indicated that jobs were stalling in the queue but not being automatically recovered.

## Root Cause
1. **Passive Stall Handling**: The `handleStalledJob` method in `RecordingWorkerService` only logged warnings but didn't actively recover stalled jobs
2. **No Duplicate Prevention**: The queue service didn't check if a job was already in the queue before adding it again
3. **Conservative Stall Detection**: The worker checked for stalled jobs every 30 seconds, which was too slow

## Solution

### 1. Active Stall Recovery (`RecordingWorkerService.ts`)
- Changed `handleStalledJob` from passive logging to active recovery
- When a job stalls, the worker now:
  - Retrieves the stalled job from the queue
  - Checks its current state
  - Calls `retry()` to move it back to waiting state
  - Updates the database status back to "queued"
  - If recovery fails, marks the job as "failed"

### 2. Improved Stall Detection
- Reduced `stalledInterval` from 30s to 10s for faster detection
- Increased `maxStalledCount` from 1 to 2 to allow one retry before giving up
- Added `lockDuration` of 60s to prevent premature stall detection

### 3. Duplicate Job Prevention (`RecordingQueueService.ts`)
- Added check before enqueueing to see if job already exists in queue
- If job is already waiting/active/delayed, skip re-adding
- If job is in terminal state (completed/failed), remove it before re-adding
- Prevents queue pollution and race conditions

## Changes Made

### `src/services/RecordingWorkerService.ts`
1. Added import for `RecordingQueueService`
2. Made `handleStalledJob` async and implemented recovery logic
3. Updated worker configuration:
   - `stalledInterval`: 30s → 10s
   - `maxStalledCount`: 1 → 2
   - Added `lockDuration`: 60s

### `src/services/RecordingQueueService.ts`
1. Added duplicate job detection in `enqueueRecording`
2. Check existing job state before adding to queue
3. Remove terminal state jobs before re-adding

## Testing
To verify the fix:
1. Start a recording job
2. If it stalls, it should automatically recover within 10 seconds
3. Try cloning and starting multiple recordings - no duplicate processing should occur
4. Check logs for "Job stalled" and "Retrying stalled job" messages

## Benefits
- Automatic recovery of stalled jobs without manual intervention
- Faster detection and recovery (10s vs 30s)
- Prevention of duplicate job processing
- Better logging for debugging stall issues
- More resilient queue processing
