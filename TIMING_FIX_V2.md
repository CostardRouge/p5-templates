# Animation Timing Fix V2 - The Proper Solution

## The Real Problem

The issue wasn't just about advancing time - it was about **how** time is calculated during recording vs normal playback.

### Normal Playback Flow

```javascript
// p5.js draw loop runs continuously
window.draw = () => {
  time.incrementElapsedTime(); // Called before each draw
  // ... draw the frame
}

// incrementElapsedTime reads p5's internal clock
incrementElapsedTime() {
  const now = millis(); // p5.js function - returns milliseconds since start
  const delta = now - time.lastUpdate;
  time.elapsed += delta;
  time.lastUpdate = now;
}
```

**Result**: Time advances naturally with p5's internal clock

### Recording with noLoop() - The Problem

```javascript
noLoop(); // Stops p5's internal clock
redraw(); // Draws one frame

// But millis() doesn't advance!
incrementElapsedTime() {
  const now = millis(); // Returns same value every time
  const delta = now - time.lastUpdate; // Always 0!
  time.elapsed += delta; // Doesn't advance
}
```

**Result**: All frames have `time.elapsed = 0`, animations don't progress

## The Solution: Recording Mode

Instead of trying to manually advance time from outside, we make the time utility **aware** that it's recording and calculate time based on frame count.

### Updated Time Utility

```javascript
// src/p5-sketches/utils/time.js
const time = {
  elapsed: 0,
  lastUpdate: 0,
  recordingFrameIndex: 0, // NEW: Track current frame during recording
  isRecording: false,     // NEW: Recording mode flag
  
  incrementElapsedTime() {
    // NEW: During recording, calculate time from frame index
    if (time.isRecording) {
      const framerate = sketch?.sketchOptions?.animation?.framerate || 60;
      const millisecondsPerFrame = 1000 / framerate;
      
      time.elapsed = time.recordingFrameIndex * millisecondsPerFrame;
      time.recordingFrameIndex++;
      return;
    }

    // Normal operation: use p5.js millis()
    const now = sketch?.engine?.getElapsedTime();
    if (typeof now === "number") {
      const delta = now - time.lastUpdate;
      time.elapsed += delta;
      time.lastUpdate = now;
    }
  },
};

// NEW: Global functions for server-side recording control
window.enableRecordingMode = function() {
  time.reset();
  time.isRecording = true;
};

window.disableRecordingMode = function() {
  time.isRecording = false;
};
```

### How It Works

**Frame 0** (60fps):
```javascript
time.recordingFrameIndex = 0
time.elapsed = 0 * 16.667 = 0ms
animation.progression = 0 / 5000 = 0.0
```

**Frame 60**:
```javascript
time.recordingFrameIndex = 60
time.elapsed = 60 * 16.667 = 1000ms
animation.progression = 1000 / 5000 = 0.2 (20%)
```

**Frame 300**:
```javascript
time.recordingFrameIndex = 300
time.elapsed = 300 * 16.667 = 5000ms
animation.progression = 5000 / 5000 = 1.0 (100% - perfect loop!)
```

## Implementation

### Server-Side Capture

```typescript
// src/utils/captureFramesServerSide.ts

// 1. Enable recording mode via global function
await page.evaluate(() => {
  window.noLoop();
  window.enableRecordingMode(); // Resets time and enables frame-based timing
});

// 2. Capture each frame
for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
  // Just call redraw - time advances automatically!
  await page.evaluate(() => {
    window.redraw();
  });
  
  // Extract and save frame...
}
```

### The Magic

When `redraw()` is called:
1. p5.js calls `window.draw()`
2. `window.draw()` calls `time.incrementElapsedTime()` (via pre-draw event)
3. `incrementElapsedTime()` sees `isRecording = true`
4. It calculates time from `recordingFrameIndex` instead of `millis()`
5. Time advances correctly!
6. `recordingFrameIndex` auto-increments for next frame

## Why This Is Better

### ❌ Previous Approach (Manual Time Injection)

```typescript
// Had to manually inject time from outside
await page.evaluate((deltaTime) => {
  window.time.elapsed += deltaTime;
}, millisecondsPerFrame);
```

**Problems**:
- Bypasses the normal time flow
- Doesn't increment `recordingFrameIndex`
- Doesn't respect the sketch's time management
- Fragile and hacky

### ✅ New Approach (Recording Mode)

```typescript
// Just enable recording mode via global function
await page.evaluate(() => {
  window.enableRecordingMode();
});

// Time advances automatically via normal flow
await page.evaluate(() => {
  window.redraw();
});
```

**Benefits**:
- Uses the existing time infrastructure
- Respects the sketch's event system
- Clean and maintainable
- Works with all sketches automatically

## Animation Progression

The animation progression calculation remains unchanged:

```javascript
// src/p5-sketches/utils/animation.js
get progression() {
  return time.seconds() % sketch.sketchOptions?.animation?.duration 
         / sketch.sketchOptions?.animation?.duration;
}
```

But now `time.seconds()` returns the correct value because `time.elapsed` is calculated from frame index during recording.

### Example: 5-second video at 60fps

| Frame | recordingFrameIndex | time.elapsed | time.seconds() | progression |
|-------|---------------------|--------------|----------------|-------------|
| 0     | 0                   | 0ms          | 0.000s         | 0.000       |
| 60    | 60                  | 1000ms       | 1.000s         | 0.200       |
| 150   | 150                 | 2500ms       | 2.500s         | 0.500       |
| 300   | 300                 | 5000ms       | 5.000s         | 1.000       |

## Photo-Dice Example

The photo-dice sketch rotates through 6 faces based on progression:

```javascript
const rotation = animation.ease({
  values: [face0, face1, face2, face3, face4, face5],
  currentTime: animation.progression * 6 * rotateSpeed,
  easingFn: easeInOutExpo,
});
```

### With Correct Timing

- **Frame 0**: `progression = 0.0` → Face 0 (front)
- **Frame 50**: `progression = 0.167` → Rotating to Face 1
- **Frame 100**: `progression = 0.333` → Rotating to Face 2
- **Frame 150**: `progression = 0.5` → Face 3 (back)
- **Frame 200**: `progression = 0.667` → Rotating to Face 4
- **Frame 250**: `progression = 0.833` → Rotating to Face 5
- **Frame 300**: `progression = 1.0` → Back to Face 0 ✅ Perfect loop!

## Files Changed

### 1. `src/p5-sketches/utils/time.js`

Added recording mode support:
- `recordingFrameIndex` - Tracks current frame during recording
- `isRecording` - Flag to enable recording mode
- Updated `incrementElapsedTime()` to calculate time from frame index when recording

### 2. `src/utils/captureFramesServerSide.ts`

Simplified to use recording mode:
- Removed manual time injection
- Just sets `time.isRecording = true`
- Time advances automatically via `redraw()`

### 3. `src/utils/captureFramesWithStreaming.ts`

Same changes as captureFramesServerSide.ts

## Testing

### Verify Frame Count

```bash
ffprobe -v error -select_streams v:0 -count_frames \
  -show_entries stream=nb_read_frames \
  -of default=nokey=1:noprint_wrappers=1 video.mp4
# Should output: 300 (for 5s at 60fps)
```

### Verify Duration

```bash
ffprobe -v error -show_entries format=duration \
  -of default=noprint_wrappers=1:nokey=1 video.mp4
# Should output: 5.000000
```

### Verify Framerate

```bash
ffprobe -v error -select_streams v:0 \
  -show_entries stream=r_frame_rate \
  -of default=noprint_wrappers=1:nokey=1 video.mp4
# Should output: 60/1
```

### Visual Verification

1. Record a photo-dice video
2. Play it back - dice should complete full rotation
3. Loop the video - should seamlessly restart
4. Check progression: 0% → 100% smoothly

## Edge Cases

### Different Framerates

**30fps**:
```javascript
recordingFrameIndex = 150
time.elapsed = 150 * 33.333 = 5000ms ✅
```

**120fps**:
```javascript
recordingFrameIndex = 600
time.elapsed = 600 * 8.333 = 5000ms ✅
```

### Different Durations

**1 second**:
```javascript
recordingFrameIndex = 60
time.elapsed = 60 * 16.667 = 1000ms ✅
```

**30 seconds**:
```javascript
recordingFrameIndex = 1800
time.elapsed = 1800 * 16.667 = 30000ms ✅
```

## Benefits

1. ✅ **Clean architecture** - Uses existing time infrastructure
2. ✅ **Automatic** - Time advances via normal event flow
3. ✅ **Maintainable** - No external time injection
4. ✅ **Robust** - Works with all sketches
5. ✅ **Perfect loops** - Progression goes exactly 0 → 1
6. ✅ **Any framerate** - Calculates correctly for any fps
7. ✅ **Any duration** - Works with any video length

## Comparison

### Before (Broken)

```
noLoop() → millis() stuck → time.elapsed = 0 → progression = 0 → frozen animation
```

### After V1 (Hacky)

```
noLoop() → manual time injection → time.elapsed advances → works but fragile
```

### After V2 (Proper)

```
noLoop() → isRecording = true → time calculated from frame index → clean & robust
```

## Summary

The proper fix is to make the time utility **aware** of recording mode and calculate time based on frame count instead of p5's internal clock. This is cleaner, more maintainable, and respects the sketch's existing time management system.

**Key insight**: Don't fight the system - extend it!

---

**Status**: ✅ Properly Fixed  
**Approach**: Recording mode in time utility  
**Impact**: All sketches now loop perfectly with clean code
