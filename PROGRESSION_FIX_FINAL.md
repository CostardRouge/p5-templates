# Animation Progression Fix - The Real Solution

## The Real Problem

The animation progression was wrapping around due to the modulo operator (`%`), causing animations to repeat after completing one cycle.

### Example Issue

Recording 12 seconds with a 12-second animation:
- **Frames 0-540** (0-9s): Animation progresses 0 → 1.0 ✅
- **Frames 541-720** (9-12s): Animation wraps back to 0 → 0.33 ❌ (repeats!)

This happened because:
```javascript
// animation.js
get progression() {
  return time.seconds() % duration / duration;
}
```

The `%` operator wraps the value, so:
- At 9s: `9 % 9 / 9 = 0 / 9 = 0` (wraps to start!)
- At 10s: `10 % 9 / 9 = 1 / 9 = 0.111`
- At 12s: `12 % 9 / 9 = 3 / 9 = 0.333`

## The Solution

**Don't wrap progression during recording** - let it reach 1.0 and stop there!

### Updated Animation Progression

```javascript
// src/p5-sketches/utils/animation.js

get progression() {
  const duration = sketch.sketchOptions?.animation?.duration || 10;
  const seconds = time.seconds();
  
  // During recording, don't wrap - clamp at 1.0
  if (time.isRecording) {
    return Math.min(seconds / duration, 1.0);
  }
  
  // Normal playback: wrap around for continuous loop
  return (seconds % duration) / duration;
}
```

### How It Works

**During Recording** (`time.isRecording = true`):
```javascript
// 12-second recording, 12-second animation
progression = Math.min(seconds / 12, 1.0)

// Frame 0 (0s): min(0/12, 1.0) = 0.0
// Frame 360 (6s): min(6/12, 1.0) = 0.5
// Frame 720 (12s): min(12/12, 1.0) = 1.0 ✅ Stops at 1.0!
// Frame 900 (15s): min(15/12, 1.0) = 1.0 ✅ Stays at 1.0!
```

**Normal Playback** (`time.isRecording = false`):
```javascript
// Continuous loop
progression = (seconds % duration) / duration

// At 0s: (0 % 12) / 12 = 0.0
// At 6s: (6 % 12) / 12 = 0.5
// At 12s: (12 % 12) / 12 = 0.0 ✅ Wraps for continuous loop
// At 15s: (15 % 12) / 12 = 0.25
```

## Why This Is The Right Fix

### 1. Respects Recording Duration

You can now record any duration you want:
- **9-second animation, 9-second recording**: Perfect loop ✅
- **9-second animation, 12-second recording**: Holds at end ✅
- **12-second animation, 12-second recording**: Perfect loop ✅

### 2. No Wrapping During Recording

```javascript
// Before (with modulo)
time = 10s, duration = 9s
progression = (10 % 9) / 9 = 1/9 = 0.111 ❌ Wraps!

// After (with Math.min)
time = 10s, duration = 9s
progression = min(10/9, 1.0) = min(1.111, 1.0) = 1.0 ✅ Stops!
```

### 3. Normal Playback Still Works

The modulo behavior is preserved for normal playback, so animations loop continuously in the browser.

## Example: Photo-Dice

### 9-Second Animation, 12-Second Recording

**Before (broken)**:
- 0-9s: Dice rotates through all 6 faces ✅
- 9-12s: Dice starts rotating again (shows 2 faces) ❌

**After (fixed)**:
- 0-9s: Dice rotates through all 6 faces ✅
- 9-12s: Dice stays at final position (face 0) ✅

### 12-Second Animation, 12-Second Recording

**Before and After (both work)**:
- 0-12s: Dice rotates through all 6 faces ✅
- Progression reaches exactly 1.0 at frame 720 ✅

## Implementation Details

### Recording Mode Check

The fix uses `time.isRecording` which is set by `window.enableRecordingMode()`:

```javascript
// In time.js
window.enableRecordingMode = function() {
  time.reset();
  time.isRecording = true; // This flag is checked in animation.js
};
```

### Frame-Based Time

During recording, time advances frame-by-frame:

```javascript
// In time.js
incrementElapsedTime() {
  if (time.isRecording) {
    const framerate = sketch?.sketchOptions?.animation?.framerate || 60;
    const millisecondsPerFrame = 1000 / framerate;
    time.elapsed = time.recordingFrameIndex * millisecondsPerFrame;
    time.recordingFrameIndex++;
    return;
  }
  // Normal operation...
}
```

### Progression Calculation

```javascript
// In animation.js
get progression() {
  const duration = sketch.sketchOptions?.animation?.duration || 10;
  const seconds = time.seconds(); // From time.elapsed / 1000
  
  if (time.isRecording) {
    return Math.min(seconds / duration, 1.0); // Clamp at 1.0
  }
  
  return (seconds % duration) / duration; // Wrap for loop
}
```

## Edge Cases

### Recording Longer Than Animation

```javascript
// Animation: 9 seconds
// Recording: 12 seconds

// Frame 540 (9s): progression = min(9/9, 1.0) = 1.0
// Frame 600 (10s): progression = min(10/9, 1.0) = 1.0
// Frame 720 (12s): progression = min(12/9, 1.0) = 1.0

// Result: Last 3 seconds show static final frame
```

### Recording Shorter Than Animation

```javascript
// Animation: 12 seconds
// Recording: 9 seconds

// Frame 540 (9s): progression = min(9/12, 1.0) = 0.75

// Result: Animation stops at 75% complete
```

### Exact Match

```javascript
// Animation: 12 seconds
// Recording: 12 seconds

// Frame 720 (12s): progression = min(12/12, 1.0) = 1.0

// Result: Perfect loop!
```

## Benefits

1. ✅ **No wrapping during recording** - Progression stops at 1.0
2. ✅ **Flexible recording duration** - Can be longer or shorter than animation
3. ✅ **Normal playback preserved** - Still loops continuously in browser
4. ✅ **Clean solution** - One-line change in animation.js
5. ✅ **Works with all sketches** - No sketch-specific changes needed

## Testing

### Test 1: Exact Match

```typescript
// Animation: 12s, Recording: 12s
options.animation = { duration: 12, framerate: 60 };
// Expected: 720 frames, progression 0 → 1.0
```

### Test 2: Recording Longer

```typescript
// Animation: 9s, Recording: 12s
options.animation = { duration: 12, framerate: 60 };
// Expected: 720 frames, progression 0 → 1.0 (holds at 1.0 after 9s)
```

### Test 3: Recording Shorter

```typescript
// Animation: 12s, Recording: 9s
options.animation = { duration: 9, framerate: 60 };
// Expected: 540 frames, progression 0 → 0.75
```

### Verification

```bash
# Check video duration
ffprobe -v error -show_entries format=duration \
  -of default=noprint_wrappers=1:nokey=1 video.mp4

# Check frame count
ffprobe -v error -select_streams v:0 -count_frames \
  -show_entries stream=nb_read_frames \
  -of default=nokey=1:noprint_wrappers=1 video.mp4

# Visual check: play video and verify no wrapping
```

## Files Changed

### `src/p5-sketches/utils/animation.js`

```javascript
get progression() {
  const duration = sketch.sketchOptions?.animation?.duration || 10;
  const seconds = time.seconds();
  
  // NEW: Don't wrap during recording
  if (time.isRecording) {
    return Math.min(seconds / duration, 1.0);
  }
  
  // Existing: Wrap for continuous loop
  return (seconds % duration) / duration;
}
```

## Summary

The fix is simple but powerful: **don't wrap progression during recording**. This allows the recording duration to be independent of the animation duration while ensuring animations never repeat during capture.

**Key insight**: Recording is not playback - we want linear progression from 0 to 1, not a continuous loop!

---

**Status**: ✅ Fixed  
**Approach**: Conditional progression calculation  
**Impact**: All recordings now respect their duration without wrapping
