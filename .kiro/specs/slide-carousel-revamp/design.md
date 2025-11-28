# Design Document: Slide Carousel Revamp

## Overview

This design document outlines the technical approach for revamping the slide carousel interface from a simple text-based list to a visual, thumbnail-based grid system. The design focuses on performance optimization, progressive enhancement, and mobile responsiveness while maintaining the existing drag-and-drop functionality.

The key innovation is a lazy-loading architecture where only the active slide's full canvas is loaded, while inactive slides display lightweight thumbnail images. This approach dramatically reduces memory usage and improves performance, especially on mobile devices with limited resources.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     TemplateOptions                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           SlideCarousel (Grid View)                   │  │
│  │  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐             │  │
│  │  │Thumb1│  │Thumb2│  │Thumb3│  │ Add  │             │  │
│  │  │Active│  │      │  │      │  │Slide │             │  │
│  │  └──────┘  └──────┘  └──────┘  └──────┘             │  │
│  │  - Drag & Drop                                        │  │
│  │  - Click to Activate                                  │  │
│  │  - Name Editing                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              SlideEditor                              │  │
│  │  (Active Slide Content Configuration)                │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Canvas Viewport                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                                                        │  │
│  │          Active Slide Canvas (Full Size)              │  │
│  │                                                        │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  [Optional: Viewport Thumbnail Navigation]                  │
│  ┌──────┐  ┌──────┐  ┌──────┐                             │
│  │Thumb1│  │Thumb2│  │Thumb3│  (Feature Flag Controlled)   │
│  └──────┘  └──────┘  └──────┘                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              Thumbnail Management System                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ S3 Thumbnail │  │  In-Memory   │  │ Placeholder  │     │
│  │   Provider   │  │  Thumbnail   │  │   Renderer   │     │
│  │              │  │   Cache      │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
TemplateOptions
├── SlideCarousel (Revamped)
│   ├── SlideThumbnailGrid
│   │   ├── SlideThumbnail (multiple)
│   │   │   ├── ThumbnailImage
│   │   │   ├── ThumbnailPlaceholder
│   │   │   ├── SlideNameEditor
│   │   │   └── SlideActions (duplicate, delete)
│   │   └── AddSlideButton
│   └── DndContext (from @dnd-kit)
├── SlideEditor (existing)
└── ViewportThumbnailNav (new, optional)
    └── ViewportThumbnail (multiple)
```

## Components and Interfaces

### 1. SlideCarousel Component (Revamped)

**Purpose:** Main container for the slide thumbnail grid with drag-and-drop functionality.

**Props:**
```typescript
interface SlideCarouselProps {
  slides: SlideOption[];
  slideIds: string[];
  activeIndex: number;
  jobId?: string;
  thumbnailUrls?: string[]; // From S3 for saved recordings
  onSelect: (index: number) => void;
  onReorder: (oldIndex: number, newIndex: number) => void;
  onAdd: () => void;
  onDuplicate: (index: number) => void;
  onDelete: (index: number) => void;
  onNameChange: (index: number, name: string) => void;
}
```

**Key Features:**
- Grid layout (responsive: 2-3 columns on desktop, 2 on mobile)
- Drag-and-drop with @dnd-kit (existing library)
- Touch-optimized for mobile
- Maintains aspect ratio based on canvas size

### 2. SlideThumbnail Component (New)

**Purpose:** Individual slide thumbnail with image, name, and actions.

**Props:**
```typescript
interface SlideThumbnailProps {
  id: string;
  index: number;
  slide: SlideOption;
  isActive: boolean;
  thumbnailUrl?: string; // S3 URL or data URL
  canvasSize: { width: number; height: number };
  dragBinder?: DragBinder;
  onClick: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onNameChange: (name: string) => void;
}
```

**State:**
```typescript
interface SlideThumbnailState {
  isEditingName: boolean;
  localThumbnail?: string; // In-memory cached thumbnail
  isGeneratingThumbnail: boolean;
}
```

**Rendering Logic:**
1. If `thumbnailUrl` exists (S3) → Display image
2. Else if `localThumbnail` exists (cached) → Display cached image
3. Else if `isActive` → Generate thumbnail from canvas
4. Else → Display placeholder with slide name

### 3. ThumbnailManager Hook (New)

**Purpose:** Centralized thumbnail management with caching and generation.

```typescript
interface UseThumbnailManagerOptions {
  jobId?: string;
  s3ThumbnailUrls?: string[];
  slides: SlideOption[];
  activeSlideIndex: number;
  canvasSize: { width: number; height: number };
}

interface ThumbnailManagerReturn {
  getThumbnail: (index: number) => string | undefined;
  generateThumbnail: (index: number) => Promise<string>;
  invalidateThumbnail: (index: number) => void;
  clearCache: () => void;
}

function useThumbnailManager(options: UseThumbnailManagerOptions): ThumbnailManagerReturn
```

**Caching Strategy:**
- LRU cache with max 20 thumbnails in memory
- Prioritize active and adjacent slides
- Clear cache on slide deletion/reordering
- Use WeakMap for automatic garbage collection

### 4. ViewportThumbnailNav Component (New, Optional)

**Purpose:** Display slide thumbnails in the main viewport as page indicators.

**Props:**
```typescript
interface ViewportThumbnailNavProps {
  slides: SlideOption[];
  activeIndex: number;
  thumbnailUrls?: string[];
  canvasSize: { width: number; height: number };
  enabled: boolean; // Feature flag
  position?: 'bottom' | 'side';
  onSelect: (index: number) => void;
}
```

**Feature Flag:**
```typescript
// Environment variable or config
const ENABLE_VIEWPORT_THUMBNAILS = process.env.NEXT_PUBLIC_ENABLE_VIEWPORT_THUMBNAILS === 'true';

// Or runtime config
const viewportThumbnailsEnabled = useFeatureFlag('viewport-thumbnails');
```

### 5. SlideNameEditor Component (New)

**Purpose:** Inline editable slide name with validation.

**Props:**
```typescript
interface SlideNameEditorProps {
  value: string;
  defaultName: string; // "Slide N"
  isActive: boolean;
  onChange: (name: string) => void;
}
```

**Behavior:**
- Click to edit (contentEditable or input)
- Auto-save on blur
- Escape to cancel
- Enter to save
- Trim whitespace
- Fallback to default if empty

## Data Models

### Extended SlideSchema

The existing `SlideSchema` already supports the `name` field:

```typescript
export const SlideSchema = z.object({
  name: z.string().optional(),
  content: z.array(ContentItemSchema).default([]),
  assets: Assets,
  sketch: z.any().optional(),
  // New field for client-side thumbnail caching
  _clientThumbnail: z.string().optional(), // Not persisted to server
});
```

### Extended JobModel

The `JobModel` already includes thumbnail support:

```typescript
export type JobModel = {
  // ... existing fields
  thumbnails: JsonValue; // Array of thumbnail URLs stored as JSON
  // thumbnails[i] corresponds to slides[i]
};
```

**Thumbnail URL Structure:**
```
S3: https://s3.amazonaws.com/bucket/jobId/thumbnail-slide-0-jobId.jpg
S3: https://s3.amazonaws.com/bucket/jobId/thumbnail-slide-1-jobId.jpg
```

### Thumbnail Cache Structure

```typescript
interface ThumbnailCache {
  [slideId: string]: {
    dataUrl: string;
    timestamp: number;
    size: number; // bytes
  };
}

// Stored in React state or Context
interface ThumbnailCacheContext {
  cache: ThumbnailCache;
  maxSize: number; // 50MB default
  currentSize: number;
  set: (slideId: string, dataUrl: string) => void;
  get: (slideId: string) => string | undefined;
  invalidate: (slideId: string) => void;
  clear: () => void;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Active slide exclusivity

*For any* slide collection and active index, exactly one slide should be marked as active and fully loaded at any given time.

**Validates: Requirements 3.2, 6.1**

### Property 2: Thumbnail aspect ratio preservation

*For any* canvas size configuration and thumbnail rendering, the thumbnail aspect ratio should equal the canvas aspect ratio (width/height).

**Validates: Requirements 1.2, 5.3**

### Property 3: Drag-and-drop order consistency

*For any* drag-and-drop reorder operation from index A to index B, the slide at original index A should appear at index B after the operation, and all other slides should maintain their relative order.

**Validates: Requirements 4.3, 4.4**

### Property 4: Thumbnail source priority

*For any* slide, if an S3 thumbnail URL exists, it should be displayed; otherwise, if an in-memory thumbnail exists, it should be displayed; otherwise, a placeholder should be displayed.

**Validates: Requirements 1.4, 1.5, 8.4**

### Property 5: Memory conservation

*For any* slide that is not active, the system should not allocate memory for full canvas rendering or sketch logic execution.

**Validates: Requirements 6.1, 6.2, 6.3**

### Property 6: Slide name fallback

*For any* slide with an empty or whitespace-only name, the displayed name should be the default "Slide N" format where N is the slide index + 1.

**Validates: Requirements 2.5, 10.5**

### Property 7: Feature flag isolation

*For any* viewport thumbnail feature flag state, changing the flag should only affect viewport thumbnail visibility and should not affect carousel thumbnail display.

**Validates: Requirements 11.1, 11.4**

### Property 8: Thumbnail cache eviction

*For any* thumbnail cache exceeding the maximum size limit, the least recently used thumbnails should be evicted until the cache size is below the limit.

**Validates: Requirements 8.5**

### Property 9: Active slide persistence during reorder

*For any* slide reorder operation, if slide X was active before the operation, slide X should remain active after the operation (at its new index).

**Validates: Requirements 4.4**

### Property 10: S3 thumbnail count consistency

*For any* completed multi-slide recording, the number of S3 thumbnail URLs should equal the number of slides.

**Validates: Requirements 7.4**

## Error Handling

### Thumbnail Generation Failures

**Scenario:** Canvas thumbnail generation fails (canvas not ready, browser API error)

**Handling:**
1. Log error to console
2. Display placeholder thumbnail
3. Retry once after 500ms delay
4. If retry fails, keep placeholder permanently
5. Do not block UI or throw errors

### S3 Thumbnail Load Failures

**Scenario:** S3 thumbnail URL returns 404 or network error

**Handling:**
1. Catch image load error event
2. Fall back to in-memory thumbnail if available
3. Otherwise, display placeholder
4. Log warning (not error) to console
5. Continue normal operation

### Memory Pressure

**Scenario:** Browser memory is constrained, thumbnail cache grows too large

**Handling:**
1. Implement LRU eviction when cache exceeds 50MB
2. Monitor cache size on each addition
3. Evict oldest thumbnails first
4. Keep active slide thumbnail always
5. Regenerate thumbnails on-demand if evicted

### Drag-and-Drop Conflicts

**Scenario:** User drags slide while thumbnail is generating

**Handling:**
1. Allow drag operation to proceed
2. Cancel thumbnail generation for dragged slide
3. Regenerate thumbnail after drop completes
4. Maintain drag visual feedback throughout

### Feature Flag Errors

**Scenario:** Feature flag configuration is invalid or missing

**Handling:**
1. Default to `false` (viewport thumbnails disabled)
2. Log warning about invalid configuration
3. Continue with carousel thumbnails only
4. Do not crash or block rendering

## Testing Strategy

### Unit Tests

**Thumbnail Manager:**
- Cache operations (set, get, invalidate, clear)
- LRU eviction logic
- Size limit enforcement
- Data URL validation

**Slide Name Editor:**
- Name validation (empty, whitespace)
- Default name fallback
- Save/cancel behavior
- Keyboard shortcuts (Enter, Escape)

**Thumbnail Component:**
- Rendering logic (S3 → cache → placeholder)
- Aspect ratio calculation
- Active state styling
- Click handlers

### Property-Based Tests

**Property 1: Active slide exclusivity**
- Generate random slide arrays (1-20 slides)
- Set random active index
- Verify exactly one slide has `isActive === true`
- Verify active index matches the active slide

**Property 2: Thumbnail aspect ratio preservation**
- Generate random canvas sizes (50-8192 width/height)
- Calculate expected aspect ratio
- Render thumbnail with calculated dimensions
- Verify thumbnail aspect ratio matches canvas aspect ratio within 0.01 tolerance

**Property 3: Drag-and-drop order consistency**
- Generate random slide array
- Generate random valid source and destination indices
- Perform reorder operation
- Verify slide at source index moved to destination index
- Verify all other slides maintained relative order

**Property 4: Thumbnail source priority**
- Generate random slide with random thumbnail states (S3, cache, none)
- Render thumbnail
- Verify correct source is displayed based on priority

**Property 5: Memory conservation**
- Generate random slide array
- Set random active index
- Verify only active slide has canvas element in DOM
- Verify inactive slides have no canvas elements

**Property 6: Slide name fallback**
- Generate random slide names (empty, whitespace, valid)
- Render slide name
- Verify empty/whitespace names display "Slide N"
- Verify valid names display as-is

**Property 7: Feature flag isolation**
- Generate random feature flag states
- Toggle flag
- Verify viewport thumbnails visibility matches flag
- Verify carousel thumbnails always visible

**Property 8: Thumbnail cache eviction**
- Fill cache beyond max size with random thumbnails
- Verify cache size is below max after eviction
- Verify LRU items were evicted
- Verify most recent items remain

**Property 9: Active slide persistence during reorder**
- Generate random slide array
- Set random active index
- Perform random reorder operation
- Verify same slide remains active (by ID, not index)

**Property 10: S3 thumbnail count consistency**
- Generate random number of slides (1-10)
- Simulate recording completion
- Verify thumbnails array length equals slides array length

### Integration Tests

**End-to-End Slide Management:**
1. Create multiple slides
2. Name each slide
3. Generate thumbnails
4. Reorder slides via drag-and-drop
5. Switch active slide
6. Verify all operations work together

**Recording and Thumbnail Persistence:**
1. Create multi-slide sketch
2. Trigger recording
3. Wait for completion
4. Verify S3 thumbnails uploaded
5. Reload page
6. Verify thumbnails load from S3

**Mobile Touch Interactions:**
1. Simulate touch events on mobile viewport
2. Test drag-and-drop with touch
3. Test tap-to-activate
4. Verify no conflicts between tap and drag
5. Verify scroll performance

### Performance Tests

**Memory Usage:**
- Create 20 slides
- Switch between slides rapidly
- Monitor memory usage (should stay < 200MB)
- Verify no memory leaks

**Thumbnail Generation Speed:**
- Generate thumbnails for 10 slides
- Measure time per thumbnail (should be < 100ms)
- Verify UI remains responsive

**Mobile Performance:**
- Test on simulated mobile device (throttled CPU)
- Measure frame rate during drag-and-drop (should be > 30fps)
- Verify smooth scrolling

## Implementation Notes

### Canvas Thumbnail Generation

```typescript
async function generateCanvasThumbnail(
  canvasElement: HTMLCanvasElement,
  targetWidth: number,
  targetHeight: number
): Promise<string> {
  // Create offscreen canvas for resizing
  const offscreen = document.createElement('canvas');
  offscreen.width = targetWidth;
  offscreen.height = targetHeight;
  
  const ctx = offscreen.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2D context');
  
  // Draw scaled canvas
  ctx.drawImage(canvasElement, 0, 0, targetWidth, targetHeight);
  
  // Convert to data URL (JPEG for smaller size)
  return offscreen.toDataURL('image/jpeg', 0.8);
}
```

### Responsive Grid Layout

```css
.slide-thumbnail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.5rem;
  
  @media (max-width: 640px) {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

### Touch Optimization

```typescript
// Use @dnd-kit's touch sensor with optimized settings
const sensors = useSensors(
  useSensor(MouseSensor, {
    activationConstraint: { distance: 6 }
  }),
  useSensor(TouchSensor, {
    activationConstraint: {
      delay: 120, // Distinguish tap from drag
      tolerance: 8 // Allow slight movement
    }
  }),
  useSensor(KeyboardSensor)
);
```

### Feature Flag Implementation

```typescript
// Environment variable approach
const ENABLE_VIEWPORT_THUMBNAILS = 
  process.env.NEXT_PUBLIC_ENABLE_VIEWPORT_THUMBNAILS === 'true';

// Or runtime config with device detection
function useViewportThumbnails(): boolean {
  const [enabled, setEnabled] = useState(() => {
    // Check environment variable
    if (process.env.NEXT_PUBLIC_ENABLE_VIEWPORT_THUMBNAILS === 'false') {
      return false;
    }
    
    // Check device capabilities
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const hasLowMemory = (navigator as any).deviceMemory < 4; // GB
    
    // Disable on low-memory mobile devices
    return !(isMobile && hasLowMemory);
  });
  
  return enabled;
}
```

### Lazy Loading Strategy

```typescript
// Only render active slide canvas
function SlideRenderer({ slides, activeIndex }: SlideRendererProps) {
  return (
    <>
      {slides.map((slide, index) => (
        <div
          key={slide.id}
          style={{ display: index === activeIndex ? 'block' : 'none' }}
        >
          {index === activeIndex && (
            <SketchCanvas slide={slide} />
          )}
        </div>
      ))}
    </>
  );
}
```

## Migration Strategy

### Phase 1: Core Thumbnail Infrastructure
1. Implement `useThumbnailManager` hook
2. Add thumbnail generation utilities
3. Update `SlideSchema` with optional `_clientThumbnail` field
4. No UI changes yet

### Phase 2: Carousel Revamp
1. Create new `SlideThumbnail` component
2. Update `SlideCarousel` to use grid layout
3. Implement drag-and-drop with thumbnails
4. Add slide name editing
5. Keep viewport unchanged

### Phase 3: Viewport Thumbnails (Optional)
1. Create `ViewportThumbnailNav` component
2. Implement feature flag system
3. Add viewport thumbnail display
4. Test on various devices
5. Progressive rollout via feature flag

### Phase 4: Performance Optimization
1. Implement LRU cache eviction
2. Add memory monitoring
3. Optimize thumbnail generation
4. Mobile-specific optimizations

### Backward Compatibility

- Existing slides without names will use default "Slide N"
- Existing recordings without per-slide thumbnails will use first thumbnail for all slides
- Feature flag defaults to `false` for safe rollout
- All existing drag-and-drop functionality preserved
