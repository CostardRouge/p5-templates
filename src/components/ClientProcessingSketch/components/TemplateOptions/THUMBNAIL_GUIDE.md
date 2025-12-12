# Thumbnail Feature Guide

## Overview
The thumbnail feature captures and displays preview images for each slide in the sketch. It's now refactored into a separate hook with better control and reliability.

## How It Works

### 1. Automatic Loading on Mount
When you open a persisted sketch (draft or completed):
- **Draft recordings**: Thumbnails are stored as data URLs in the job record and loaded immediately
- **Completed recordings**: Thumbnails are stored in S3, and signed URLs are fetched via API

### 2. Initial Capture
If no persisted thumbnails exist:
- Waits 500ms for the canvas to render
- Automatically captures the first slide's thumbnail
- Uses high-quality pica resizing (240px width)

### 3. Capture on Slide Changes
When you switch between slides:
- Captures the current slide's thumbnail before switching
- Ensures you always have an up-to-date preview

### 4. Capture on New Slides
When you add a new slide:
- Captures the previous slide's thumbnail
- Marks the new slide for thumbnail capture
- Captures the new slide after 300ms (gives canvas time to render)

## Technical Details

### Storage Format
- **Draft**: `Record<slideId, dataUrl>` - Stored in job.thumbnails
- **Completed**: `string[]` - Array of S3 URLs, fetched as signed URLs

### Image Quality
- Target width: 240px (optimal for grid display)
- Format: JPEG at 85% quality
- Resizing: Native Canvas API with high-quality image smoothing
- Aspect ratio: Preserved from canvas
- No external dependencies (removed pica to fix Turbopack issues)

### Performance
- Lazy loading: Images use `loading="lazy"` attribute
- GPU acceleration: CSS `transform: translateZ(0)`
- Debounced capture: Prevents excessive captures during rapid changes

## Troubleshooting

### Thumbnails Not Showing
1. **Check if enabled**: `enableThumbnails` prop should be `true` (default)
2. **Check canvas**: Ensure `canvas#defaultCanvas0` exists in DOM
3. **Check timing**: Canvas might not be rendered yet (increase delay)
4. **Check console**: Look for error messages about thumbnail capture

### Thumbnails Not Updating
1. **Manual refresh**: Use `captureCurrentSlide(slideId)` to force capture
2. **Clear and recapture**: Use `clearThumbnails()` then navigate slides
3. **Check canvas context**: Ensure 2D context is available

### Performance Issues
1. **Disable if not needed**: Set `enableThumbnails={false}`
2. **Reduce quality**: Modify `thumbnailUtils.ts` quality settings
3. **Increase capture delay**: Modify timeout values in hooks

## API Reference

### Hook: `useThumbnails`

```typescript
const {
  thumbnails,              // Record<slideId, dataUrl>
  captureThumbnail,        // (slideId: string) => Promise<void>
  captureCurrentSlide,     // (slideId: string) => Promise<void> - with delay
  clearThumbnails,         // () => void
  pendingThumbnailCaptureRef, // MutableRefObject<number | null>
} = useThumbnails({
  enabled: true,           // Enable/disable feature
  persistedJob,            // Job data with thumbnails
  slideFields,             // Array of slide field objects
});
```

### Utility: `captureThumbnailFromCanvas`

```typescript
import { captureThumbnailFromCanvas } from './utils/thumbnailUtils';

const dataUrl = await captureThumbnailFromCanvas();
// Returns: string (data URL) or null on error
// Uses native Canvas API - no external dependencies
```

## Configuration

### Adjust Thumbnail Size
Edit `src/components/ClientProcessingSketch/components/TemplateOptions/utils/thumbnailUtils.ts`:

```typescript
const targetWidth = 240; // Change this value
```

### Adjust Quality
Edit the same file:

```typescript
// JPEG quality (0.0 to 1.0)
destCanvas.toDataURL("image/jpeg", 0.85); // Change 0.85

// Image smoothing quality
ctx.imageSmoothingQuality = "high"; // Options: "low", "medium", "high"
```

### Adjust Capture Timing
Edit `src/components/ClientProcessingSketch/components/TemplateOptions/hooks/useThumbnails.ts`:

```typescript
// Initial capture delay
setTimeout(() => { ... }, 500); // Change 500ms

// New slide capture delay (in TemplateOptions.tsx)
setTimeout(async () => { ... }, 300); // Change 300ms
```

## Future Improvements

### Potential Enhancements
1. **Batch capture**: Capture all slides at once in background
2. **Progressive loading**: Show low-quality placeholder first
3. **WebP format**: Better compression for modern browsers
4. **Thumbnail cache**: Store in IndexedDB for faster loading
5. **Lazy capture**: Only capture when slide is viewed
6. **Thumbnail regeneration**: Button to refresh all thumbnails

### Known Limitations
1. Requires canvas to be rendered (can't capture before first render)
2. Captures current canvas state (might not match final render)
3. Memory usage increases with more slides
4. No thumbnail for slides that were never viewed (in lazy mode)

## Testing Checklist

- [ ] Thumbnails load immediately on persisted sketch
- [ ] Thumbnails display for all existing slides
- [ ] New slide gets thumbnail after creation
- [ ] Thumbnail updates when switching slides
- [ ] Thumbnails persist after save
- [ ] Thumbnails work with import/export
- [ ] Thumbnails work with slide reordering
- [ ] Thumbnails work with slide duplication
- [ ] Thumbnails cleared on slide deletion
- [ ] Performance acceptable with 10+ slides
