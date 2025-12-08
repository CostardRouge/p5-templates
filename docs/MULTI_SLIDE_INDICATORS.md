# Multi-Slide Recording Indicators

## Overview

This feature enhances the recordings page to clearly indicate when a recording contains multiple slides, addressing the issue where recordings with 3+ slides only showed a single thumbnail.

## Implementation

### Components

#### 1. **SlidePreviewGrid** (`src/components/RecordingsPage/components/SlidePreviewGrid.tsx`)
- Desktop-only hover preview with automatic carousel
- **Only shows for completed jobs** (draft jobs don't have stored thumbnails yet)
- Automatically cycles through all slide thumbnails
- Configurable interval via `SLIDE_INTERVAL_MS` constant (default: 500ms)
- Smooth crossfade transition between slides (300ms opacity transition)
- Fetches thumbnails from `/api/recordings/[id]/media` endpoint
- No loading state shown (waits silently until thumbnails are ready)
- No reflow or layout shift on hover
- Lower z-index (z-10) to keep UI controls visible on top

#### 2. **RecordingThumbnail** (Enhanced)
- Added `enableHoverPreview` prop for desktop hover functionality
- Only triggers preview for completed jobs
- Integrates preview grid component

### Utility Functions

#### **getSlideCount** (`src/utils/getSlideCount.ts`)
- Extracts slide count from JobModel
- Handles both array format and Record<slideId, url> format
- Checks videoUrls first, falls back to thumbnails
- Returns 1 as default for single-slide recordings

## Usage

### Card View
```tsx
// Thumbnail with hover preview
<RecordingThumbnail
  job={job}
  enableHoverPreview={true}
/>

// Slide count shown in ID section
<HardLink href={`templates/${job.template}?id=${job.id}`}>
  #{job.id.slice(0, 8)}
  {slideCount > 1 && (
    <>
      <span>·</span>
      <span>{slideCount} slides</span>
    </>
  )}
</HardLink>
```

### Table View
```tsx
// Thumbnail with hover preview
<RecordingThumbnail
  job={job}
  enableHoverPreview={true}
/>

// Slide count shown in Details column
<HardLink href={`templates/${job.template}?id=${job.id}`}>
  <div>#{job.id.slice(0, 8)}</div>
  {slideCount > 1 && (
    <div>{slideCount} slides</div>
  )}
</HardLink>
```

## Features

### Mobile Experience
- **Text indicator**: Shows slide count in Details/ID section
- **No hover preview**: Touch devices don't support hover
- **Clear and readable**: Users know there are multiple slides
- **Consistent separators**: Uses middle dot (·) throughout the card design

### Desktop Experience
- **Text indicator**: Slide count shown in Details/ID section
- **Hover carousel**: Mouse over thumbnail automatically cycles through all slides (completed jobs only)
- **Smooth transitions**: Crossfade animation between slides (300ms)
- **No reflow**: Carousel overlays the thumbnail without causing layout shifts
- **Progressive enhancement**: Hover adds value without being required

## Design Decisions

1. **Slide Count Display**
   - Card view: Shown inline after ID with vertical dot separator (e.g., "#abc123 · 3 slides")
   - Table view: Shown on new line under ID in Details column
   - Only displayed when slide count > 1

2. **Hover Carousel**
   - Desktop only (no touch support needed)
   - **Completed jobs only** (draft jobs don't have stored thumbnails)
   - Fetches on-demand (doesn't slow initial page load)
   - Automatic cycling through all slides
   - Configurable interval: `SLIDE_INTERVAL_MS = 500` (in milliseconds)
   - Smooth crossfade transitions (300ms opacity)
   - No layout reflow or scale effects
   - Resets to first slide when hover ends
   - No loading indicator (seamless experience)
   - UI controls (eye icon, status badge, actions menu) always visible on top (z-40)

3. **Column Naming**
   - Changed "ID" column to "Details" in table view
   - Better reflects that it now contains both ID and slide count

4. **Visual Consistency**
   - Uses middle dot (·) separator throughout card design
   - Same separator for ID/slides and date/duration
   - Clean, unified visual language

## API Integration

The feature uses the existing `/api/recordings/[id]/media` endpoint which:
- Returns signed S3 URLs for all thumbnails
- Handles both array and Record formats
- Provides video URLs and metadata

## Performance

- Text indicator: Zero performance impact (pure text rendering)
- Hover carousel: Lazy-loaded only on hover for completed jobs
- Thumbnails: Cached by browser after first load
- No layout reflow or scale transforms (prevents jank)
- Smooth CSS opacity transitions (GPU accelerated)
- No impact on initial page render

## Configuration

### Adjusting Carousel Speed

To change how fast the carousel cycles through slides, modify the constant in `SlidePreviewGrid.tsx`:

```typescript
// Time in milliseconds to display each slide in the carousel
const SLIDE_INTERVAL_MS = 500; // Change this value
```

Examples:
- `250` = Very fast (4 slides per second)
- `500` = Default (2 slides per second)
- `1000` = Slower (1 slide per second)
- `2000` = Very slow (1 slide every 2 seconds)

## Future Enhancements

Potential improvements:
1. Manual carousel controls (pause, next/prev)
2. Click to jump to specific slide in video player
3. Slide names/labels in preview
4. Keyboard navigation for accessibility
5. Progress indicator showing current slide position
