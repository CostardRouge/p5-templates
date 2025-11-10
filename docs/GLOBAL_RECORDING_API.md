# Global Recording API

## Overview

The time utility now exposes global functions to control recording mode, making it easy for server-side capture to enable frame-based timing.

## Global Functions

### `window.enableRecordingMode()`

Enables recording mode for server-side frame capture.

**What it does:**
1. Resets time to 0
2. Resets frame index to 0
3. Enables frame-based time calculation

**Usage:**
```javascript
// In browser (via Playwright)
window.enableRecordingMode();
```

**Effect:**
- `time.elapsed` will be calculated from frame index
- `time.recordingFrameIndex` will increment with each `redraw()`
- Time advances correctly even when `noLoop()` is active

### `window.disableRecordingMode()`

Disables recording mode and returns to normal time calculation.

**What it does:**
1. Disables frame-based time calculation
2. Returns to using p5.js `millis()` for time

**Usage:**
```javascript
// In browser (via Playwright)
window.disableRecordingMode();
```

**Effect:**
- Time calculation returns to normal p5.js behavior
- `time.elapsed` will be calculated from `millis()`

## Implementation

### In Time Utility

```javascript
// src/p5-sketches/utils/time.js

const time = {
  elapsed: 0,
  lastUpdate: 0,
  recordingFrameIndex: 0,
  isRecording: false,
  
  incrementElapsedTime() {
    if (time.isRecording) {
      // Frame-based time calculation
      const framerate = sketch?.sketchOptions?.animation?.framerate || 60;
      const millisecondsPerFrame = 1000 / framerate;
      time.elapsed = time.recordingFrameIndex * millisecondsPerFrame;
      time.recordingFrameIndex++;
      return;
    }
    
    // Normal p5.js time calculation
    const now = sketch?.engine?.getElapsedTime();
    if (typeof now === "number") {
      const delta = now - time.lastUpdate;
      time.elapsed += delta;
      time.lastUpdate = now;
    }
  },
};

// Global API
window.enableRecordingMode = function() {
  time.reset();
  time.isRecording = true;
};

window.disableRecordingMode = function() {
  time.isRecording = false;
};
```

### In Server-Side Capture

```typescript
// src/utils/captureFramesServerSide.ts

// Enable recording mode
await page.evaluate(() => {
  if (typeof window.noLoop === "function") {
    window.noLoop();
  }
  if (typeof window.enableRecordingMode === "function") {
    window.enableRecordingMode();
  }
});

// Capture frames
for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
  await page.evaluate(() => {
    if (typeof window.redraw === "function") {
      window.redraw();
    }
  });
  // ... extract and save frame
}
```

## Why Global Functions?

### Problem with Direct Access

```typescript
// ❌ Doesn't work - time is not exposed to window
await page.evaluate(() => {
  window.time.isRecording = true; // Error: time is undefined
});
```

The `time` object is a module export, not a global variable.

### Solution: Global Functions

```typescript
// ✅ Works - global function is accessible
await page.evaluate(() => {
  window.enableRecordingMode(); // Function is exposed to window
});
```

Global functions provide a clean API for external control.

## Benefits

### 1. Clean API

```typescript
// Clear and explicit
window.enableRecordingMode();
window.disableRecordingMode();
```

### 2. Encapsulation

```typescript
// Internal state is hidden
window.enableRecordingMode(); // Handles reset + flag setting
```

### 3. Type Safety

```typescript
// Easy to check if function exists
if (typeof window.enableRecordingMode === "function") {
  window.enableRecordingMode();
}
```

### 4. Future Extensibility

```typescript
// Can add more functionality later
window.enableRecordingMode = function(options) {
  time.reset();
  time.isRecording = true;
  time.recordingOptions = options; // Future: custom options
};
```

## Usage Examples

### Basic Recording

```typescript
// Start recording
await page.evaluate(() => {
  window.noLoop();
  window.enableRecordingMode();
});

// Capture frames
for (let i = 0; i < 300; i++) {
  await page.evaluate(() => window.redraw());
  // ... save frame
}

// Optional: disable recording mode
await page.evaluate(() => {
  window.disableRecordingMode();
  window.loop();
});
```

### With Error Handling

```typescript
await page.evaluate(() => {
  if (typeof window.enableRecordingMode !== "function") {
    throw new Error("Recording mode not available");
  }
  
  window.noLoop();
  window.enableRecordingMode();
});
```

### Checking Recording State

```typescript
// Check if recording mode is active
const isRecording = await page.evaluate(() => {
  return typeof window.enableRecordingMode === "function";
});

if (isRecording) {
  console.log("Recording mode available");
}
```

## TypeScript Declarations

For better type safety, you can add declarations:

```typescript
// types/window.d.ts
interface Window {
  enableRecordingMode: () => void;
  disableRecordingMode: () => void;
}
```

Then use without `@ts-ignore`:

```typescript
await page.evaluate(() => {
  window.enableRecordingMode(); // TypeScript knows this exists
});
```

## Testing

### Test Recording Mode

```javascript
// In browser console
console.log("Before:", time.elapsed, time.isRecording);

window.enableRecordingMode();
console.log("After enable:", time.elapsed, time.isRecording);
// Output: After enable: 0 true

window.redraw();
console.log("After redraw:", time.elapsed, time.recordingFrameIndex);
// Output: After redraw: 16.667 1

window.disableRecordingMode();
console.log("After disable:", time.isRecording);
// Output: After disable: false
```

### Test in Playwright

```typescript
// Test script
const page = await browser.newPage();
await page.goto("http://localhost:3000/templates/photo-dice");

// Enable recording mode
await page.evaluate(() => {
  window.enableRecordingMode();
});

// Check state
const state = await page.evaluate(() => ({
  elapsed: window.time?.elapsed,
  isRecording: window.time?.isRecording,
}));

console.log(state); // { elapsed: 0, isRecording: true }
```

## Troubleshooting

### Function not found

**Error**: `window.enableRecordingMode is not a function`

**Solution**: Ensure time.js is loaded before calling the function:
```typescript
await page.waitForSelector("canvas#defaultCanvas0.loaded");
// Now time.js is loaded and functions are available
```

### Time not advancing

**Issue**: Time stays at 0 even after redraw

**Check**:
1. Is recording mode enabled? `window.enableRecordingMode()` called?
2. Is `noLoop()` active? Should be for recording
3. Is `redraw()` being called? Each call should advance time

**Debug**:
```typescript
await page.evaluate(() => {
  console.log("isRecording:", window.time?.isRecording);
  console.log("frameIndex:", window.time?.recordingFrameIndex);
  console.log("elapsed:", window.time?.elapsed);
});
```

## Summary

The global recording API provides a clean, encapsulated way to control recording mode from server-side capture code:

- ✅ **`window.enableRecordingMode()`** - Start frame-based timing
- ✅ **`window.disableRecordingMode()`** - Return to normal timing
- ✅ **Clean API** - Simple and explicit
- ✅ **Encapsulated** - Internal state hidden
- ✅ **Type-safe** - Easy to check availability
- ✅ **Extensible** - Can add features later

---

**Location**: `src/p5-sketches/utils/time.js`  
**Exposed to**: `window` object  
**Used by**: Server-side capture utilities
