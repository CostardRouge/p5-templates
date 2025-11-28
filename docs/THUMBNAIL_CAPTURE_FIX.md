# Thumbnail Capture Fix

## Problem

When capturing thumbnails during recording, UI elements (controls, overlays, progress bars) would sometimes appear in the thumbnail images. This happened due to a race condition between:

1. The canvas getting the `.loaded` class
2. React finishing its render cycle and hiding UI elements
3. The screenshot being taken

## Root Cause

The thumbnail capture process was:
1. Loading the page with `?capturing` parameter
2. Waiting for `canvas#defaultCanvas0.loaded` selector
3. Immediately taking a screenshot

However, even though the `capturing` prop was passed to React components to hide UI elements, there was a timing gap where:
- The canvas was marked as loaded (via the `.loaded` class in `src/p5-sketches/utils/options.js`)
- But React hadn't finished its render cycle to hide all UI elements
- The screenshot captured UI elements still in the DOM

## Solution

Created a robust thumbnail capture utility (`src/utils/captureCanvasThumbnail.ts`) that uses the Canvas API directly:

1. **Waits for canvas to load** - Ensures the canvas has the `.loaded` class (30s timeout)
2. **Uses Canvas API** - Calls `canvas.toDataURL()` to extract image data directly from the canvas
3. **Converts and saves** - Converts the data URL to a buffer and saves to file

### Why Canvas API?

Using `canvas.toDataURL()` instead of Playwright screenshots provides:
- **No UI interference** - Gets raw canvas pixel data, UI elements can't appear
- **Faster execution** - No screenshot rendering overhead
- **More reliable** - Direct canvas access, no timing issues
- **Consistent with codebase** - Same approach used in `captureFramesWithStreaming`

## Changes Made

### New File
- `src/utils/captureCanvasThumbnail.ts` - Centralized thumbnail capture utility

### Updated Files
- `src/lib/recordSketch.ts` - Uses new utility for all thumbnail captures (single sketch, multi-slide, streaming mode)
- `src/lib/createSketchThumbnails.ts` - Uses new utility for batch thumbnail generation

## Benefits

1. **Reliability** - Canvas API directly extracts pixel data, UI elements cannot interfere
2. **Performance** - Much faster than Playwright screenshots
3. **Consistency** - All thumbnail captures use the same robust approach
4. **Maintainability** - Centralized logic in one utility function
5. **Configurability** - Can adjust quality and format if needed

## Usage

```typescript
import { captureCanvasThumbnail } from "@/utils/captureCanvasThumbnail";

// Basic usage (JPEG at 90% quality)
await captureCanvasThumbnail(page, thumbnailPath);

// With options
await captureCanvasThumbnail(page, thumbnailPath, {
  quality: 0.95,  // 0.0 to 1.0 for JPEG quality
  format: "jpeg"  // or "png"
});
```

## Testing

To verify the fix:
1. Start a recording with UI elements visible
2. Check the generated thumbnail - it should only show the canvas content
3. No controls, progress bars, or overlays should be visible
