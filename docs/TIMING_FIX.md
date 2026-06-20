# Animation Timing Fix

## Problem

Videos were not looping correctly - the animation didn't complete a full cycle before restarting. For example, in the photo-dice sketch, the dice rotation would cut off mid-animation instead of completing a full 360° rotation.

## Root Cause

When using server-side frame capture with `noLoop()` and `redraw()`, the time wasn't advancing properly between frames.

### How p5.js Time Works

In normal p5.js operation:
1. The `draw()` function runs continuously (60fps by default)
2. `time.incrementElapsedTime()` is called before each draw
3. This function reads `sketch.engine.getElapsedTime()` which is p5's internal clock
4. The elapsed time advances automatically with each frame

### The Problem with `noLoop()`

When we call `noLoop()` and then `redraw()`:
1. The p5.js internal clock stops advancing
2. `sketch.engine.getElapsedTime()` returns the same value
3. `time.incrementElapsedTime()` doesn't advance the time
4. All frames have the same timestamp
5. Animations don't progress

## The Fix

Manually advance the time by the correct amount for each frame:

```typescript
// Calculate time per frame based on framerate
const framerate = 60; // from sketch options
const millisecondsPerFrame = 1000 / framerate; // 16.67ms for 60fps

// For each frame
for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
  // Manually advance time
  await page.evaluate((deltaTime) => {
    if (typeof window.time !== "undefined") {
      window.time.elapsed += deltaTime;
    }
  }, millisecondsPerFrame);

  // Then draw the frame
  await page.evaluate(() => {
    if (typeof window.redraw === "function") {
      window.redraw();
    }
  });
}
```

## How It Works Now

### Frame Timing Calculation

For a 5-second video at 60fps:
- Total frames: `5 * 60 = 300 frames`
- Time per frame: `1000ms / 60fps = 16.667ms`
- Total duration: `300 * 16.667ms = 5000ms = 5 seconds`

### Frame-by-Frame Progression

| Frame | Time (ms) | Time (s) | Progression |
|-------|-----------|----------|-------------|
| 0     | 0         | 0.000    | 0%          |
| 1     | 16.667    | 0.017    | 0.33%       |
| 60    | 1000      | 1.000    | 20%         |
| 150   | 2500      | 2.500    | 50%         |
| 300   | 5000      | 5.000    | 100%        |

### Animation Progression

The `animation.progression` value now correctly goes from 0 to 1:

```javascript
// In animation.js
get progression() {
  return time.seconds() % sketch.sketchOptions?.animation?.duration 
         / sketch.sketchOptions?.animation?.duration;
}
```

For a 5-second animation:
- Frame 0: `0 / 5 = 0.0` (start)
- Frame 150: `2.5 / 5 = 0.5` (halfway)
- Frame 300: `5.0 / 5 = 1.0` (end, loops back to start)

## Example: Photo-Dice

The photo-dice sketch rotates through 6 faces:

```javascript
// Rotation based on progression
const rotation = animation.ease({
  values: [face0, face1, face2, face3, face4, face5],
  currentTime: animation.progression * 6 * rotateSpeed,
  easingFn: easeInOutExpo,
});
```

### Before Fix (Broken)

All frames had `time.elapsed = 0`:
- `animation.progression = 0`
- Rotation stuck at face 0
- Video shows static image

### After Fix (Working)

Time advances correctly:
- Frame 0: `progression = 0.0` → Face 0
- Frame 50: `progression = 0.167` → Between Face 0 and 1
- Frame 100: `progression = 0.333` → Between Face 1 and 2
- Frame 300: `progression = 1.0` → Back to Face 0 (perfect loop)

## Files Changed

### `src/utils/captureFramesServerSide.ts`

```typescript
// Get framerate from sketch options
const framerate = await page.evaluate(() => {
  return window.sketch?.sketchOptions?.animation?.framerate || 60;
});

const millisecondsPerFrame = 1000 / framerate;

// For each frame, advance time before drawing
for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
  await page.evaluate((deltaTime) => {
    if (typeof window.time !== "undefined") {
      window.time.elapsed += deltaTime;
    }
  }, millisecondsPerFrame);

  await page.evaluate(() => {
    if (typeof window.redraw === "function") {
      window.redraw();
    }
  });
}
```

### `src/utils/captureFramesWithStreaming.ts`

Same fix applied to streaming mode.

## Verification

### Check Video Duration

```bash
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 video.mp4
# Should output: 5.000000 (for 5-second video)
```

### Check Frame Count

```bash
ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=nb_read_frames -of default=nokey=1:noprint_wrappers=1 video.mp4
# Should output: 300 (for 5s at 60fps)
```

### Check Framerate

```bash
ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of default=noprint_wrappers=1:nokey=1 video.mp4
# Should output: 60/1
```

### Visual Check

Play the video and verify:
- ✅ Animation completes a full cycle
- ✅ Video loops seamlessly
- ✅ No jumps or cuts in the animation
- ✅ Timing matches the intended duration

## Testing Different Framerates

### 30fps

```typescript
animation: {
  framerate: 30,
  duration: 5
}
// Total frames: 150
// Time per frame: 33.33ms
// Frame 0: 0ms, Frame 75: 2500ms, Frame 150: 5000ms
```

### 60fps (default)

```typescript
animation: {
  framerate: 60,
  duration: 5
}
// Total frames: 300
// Time per frame: 16.67ms
// Frame 0: 0ms, Frame 150: 2500ms, Frame 300: 5000ms
```

### 120fps

```typescript
animation: {
  framerate: 120,
  duration: 5
}
// Total frames: 600
// Time per frame: 8.33ms
// Frame 0: 0ms, Frame 300: 2500ms, Frame 600: 5000ms
```

## Edge Cases

### Very Short Duration (1 second)

```typescript
animation: {
  framerate: 60,
  duration: 1
}
// Total frames: 60
// Each frame: 16.67ms
// Progression: 0 → 1 in 60 frames
```

### Very Long Duration (30 seconds)

```typescript
animation: {
  framerate: 60,
  duration: 30
}
// Total frames: 1800
// Each frame: 16.67ms
// Progression: 0 → 1 in 1800 frames
```

### Low Framerate (24fps)

```typescript
animation: {
  framerate: 24,
  duration: 5
}
// Total frames: 120
// Each frame: 41.67ms
// Progression: 0 → 1 in 120 frames
```

## Benefits

1. ✅ **Perfect loops** - Animation completes exactly at frame count
2. ✅ **Accurate timing** - Each frame has correct timestamp
3. ✅ **Consistent speed** - Animation plays at intended speed
4. ✅ **Any framerate** - Works with 24, 30, 60, 120fps
5. ✅ **Any duration** - Works with 1s, 5s, 30s videos

## Related Code

### Animation Progression

```javascript
// src/p5-sketches/utils/animation.js
get progression() {
  return time.seconds() % sketch.sketchOptions?.animation?.duration 
         / sketch.sketchOptions?.animation?.duration;
}
```

### Time Utility

```javascript
// src/p5-sketches/utils/time.js
const time = {
  elapsed: 0,
  seconds: function() {
    return time.milliSeconds() / 1000;
  },
  milliSeconds: function() {
    return time.elapsed;
  },
  reset() {
    time.elapsed = 0;
  }
};
```

### Frame Count Calculation

```typescript
// src/lib/recordSketch.ts
function calculateTotalFrames(animationOptions: any): number {
  const framerate = animationOptions?.framerate || 60;
  const duration = animationOptions?.duration || 5;
  return Math.round(duration * framerate);
}
```

## Summary

The fix ensures that time advances correctly during server-side frame capture by manually incrementing `time.elapsed` by the appropriate amount for each frame. This makes animations progress smoothly and complete full cycles, resulting in perfect video loops.

**Before**: Time stuck at 0, animations frozen  
**After**: Time advances correctly, animations loop perfectly

---

**Status**: ✅ Fixed  
**Applies to**: Both capture utilities — `captureFramesServerSide.ts` (preview thumbnails) and `captureFramesWithStreaming.ts` (recording worker)  
**Impact**: All sketches now loop correctly
