# Design Document

## Overview

This design introduces a GSAP-based HTML template system that runs alongside the existing p5.js sketch infrastructure. Templates are React components that use GSAP for animations, Tailwind for styling, and can optionally integrate HTML5 Canvas for custom rendering. The system synchronizes GSAP timelines with the recording infrastructure's framerate and duration settings, enabling frame-accurate video capture.

The design leverages the existing HTML template structure (currently used by `exif-detail`) and extends it with:
- GSAP timeline management synchronized to `options.animation.framerate/duration`
- Options configuration system matching p5.js patterns
- Server-side capture integration for video generation
- Shared utilities for common animation patterns

## Architecture

### High-Level Structure

```
src/
├── app/
│   ├── templates/
│   │   └── gsap/
│   │       ├── photo-exif/              # First GSAP template (migrated from html/exif-detail)
│   │       │   ├── page.tsx             # Main template component
│   │       │   ├── options.ts           # Configuration schema
│   │       │   ├── components/          # Template-specific components
│   │       │   ├── types/               # TypeScript types
│   │       │   └── styles.css           # Custom styles (if needed)
│   │       └── [template-name]/         # Additional templates follow same pattern
│   │
│   └── api/
│       └── capture/
│           └── gsap/
│               └── [template]/
│                   └── route.ts         # Capture API endpoint
│
├── lib/
│   └── gsap/
│       ├── useGSAPTimeline.ts           # Hook for timeline management
│       ├── syncWithRecording.ts         # Frame synchronization utilities
│       └── types.ts                     # Shared GSAP types
│
└── types/
    └── gsap-template.types.ts           # Template option types
```

### Component Flow

```
User Interaction (Interactive Mode)
    ↓
Template Component (page.tsx)
    ↓
useGSAPTimeline Hook
    ↓
GSAP Timeline (synced to options.animation)
    ↓
React State Updates → Re-render
    ↓
Visual Output

Recording Flow (Capture Mode)
    ↓
API Route (/api/capture/gsap/[template])
    ↓
Puppeteer Browser Instance
    ↓
Template Component (with ?capturing=true)
    ↓
Frame-by-Frame Timeline Progression
    ↓
Screenshot Capture → Video Generation
```

## Components and Interfaces

### 1. Template Component Structure

Each GSAP template follows this pattern:

```typescript
// src/app/templates/gsap/[template-name]/page.tsx
"use client";

import React, { useEffect, useState, useRef } from "react";
import { useGSAPTimeline } from "@/lib/gsap/useGSAPTimeline";
import { TemplateOptions } from "./options";
import ScalableViewport from "@/components/ScalableViewport/ScalableViewport";

export default function TemplatePage() {
  const [options, setOptions] = useState<TemplateOptions | null>(null);
  const [capturing, setCapturing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Initialize GSAP timeline synced to options.animation
  const { timeline, progress, isReady } = useGSAPTimeline({
    container: containerRef,
    options: options?.animation,
    capturing,
    onComplete: () => {
      // Signal capture completion
      if (capturing) {
        document.body.setAttribute('data-capture-complete', 'true');
      }
    }
  });

  // Load options from URL params (for capture mode) or state
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    setCapturing(searchParams.has('capturing'));
    
    // Load options from query params or API
    // ...
  }, []);

  // Define GSAP animations
  useEffect(() => {
    if (!timeline || !isReady || !options) return;

    // Clear previous animations
    timeline.clear();

    // Add animations synchronized to timeline duration
    timeline
      .from('.element', { opacity: 0, y: 50, duration: 0.5 })
      .to('.element', { scale: 1.2, duration: 1 }, '+=0.5')
      .to('.element', { rotation: 360, duration: 2 });

    // Timeline automatically matches options.animation.duration
  }, [timeline, isReady, options]);

  return (
    <ScalableViewport
      initialScale={capturing ? 1 : undefined}
      showZoomControls={!capturing}
    >
      <div className="flex items-center justify-center h-screen">
        <div
          id="capture-container"
          ref={containerRef}
          className="w-[1080px] h-[1350px] bg-background p-16"
          data-ready={isReady}
        >
          {/* Template content */}
        </div>
      </div>
    </ScalableViewport>
  );
}
```

### 2. Options Configuration

Templates define options using the same pattern as p5.js sketches:

```typescript
// src/app/templates/gsap/[template-name]/options.ts

export interface TemplateOptions {
  animation: {
    duration: number;      // Total animation duration in seconds
    framerate: number;     // Frames per second for recording
  };
  // Template-specific options
  photo: {
    image: string | null;
    scale: number;
    position: { x: number; y: number };
  };
  text: {
    title: string;
    color: [number, number, number];
    fontSize: number;
  };
  // ... other options
}

export const defaultOptions: TemplateOptions = {
  animation: {
    duration: 5,
    framerate: 30,
  },
  photo: {
    image: null,
    scale: 1,
    position: { x: 0.5, y: 0.5 },
  },
  text: {
    title: "My Animation",
    color: [255, 255, 255],
    fontSize: 48,
  },
};

// Form configuration for UI generation
export const formConfiguration = {
  animation: {
    label: "Animation",
    component: "nested-object",
    fields: {
      duration: {
        label: "Duration (seconds)",
        component: "slider",
        min: 1,
        max: 60,
        step: 0.5,
      },
      framerate: {
        label: "Framerate (fps)",
        component: "select",
        options: [24, 30, 60],
      },
    },
  },
  photo: {
    label: "Photo",
    component: "nested-object",
    fields: {
      image: {
        component: "image",
        label: "Image",
      },
      scale: {
        label: "Scale",
        component: "slider",
        min: 0.1,
        max: 3,
        step: 0.1,
      },
    },
  },
  // ... other field configurations
};
```

### 3. GSAP Timeline Hook

Core hook for managing GSAP timelines synchronized with recording:

```typescript
// src/lib/gsap/useGSAPTimeline.ts

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

interface UseGSAPTimelineOptions {
  container: React.RefObject<HTMLElement>;
  options?: {
    duration: number;
    framerate: number;
  };
  capturing: boolean;
  onComplete?: () => void;
}

export function useGSAPTimeline({
  container,
  options,
  capturing,
  onComplete,
}: UseGSAPTimelineOptions) {
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!container.current || !options) return;

    // Create timeline with duration from options
    const tl = gsap.timeline({
      paused: true,
      duration: options.duration,
      onUpdate: () => {
        setProgress(tl.progress());
      },
      onComplete: () => {
        onComplete?.();
      },
    });

    timelineRef.current = tl;
    setIsReady(true);

    // In capture mode, sync timeline to frame number
    if (capturing) {
      setupFrameSync(tl, options);
    } else {
      // In interactive mode, play normally
      tl.play();
    }

    return () => {
      tl.kill();
      timelineRef.current = null;
      setIsReady(false);
    };
  }, [container, options, capturing]);

  return {
    timeline: timelineRef.current,
    progress,
    isReady,
  };
}

function setupFrameSync(
  timeline: gsap.core.Timeline,
  options: { duration: number; framerate: number }
) {
  // Listen for frame updates from capture system
  const totalFrames = options.duration * options.framerate;
  
  window.addEventListener('capture:seek-frame', ((event: CustomEvent) => {
    const frameNumber = event.detail.frame;
    const progress = frameNumber / totalFrames;
    timeline.progress(progress);
  }) as EventListener);
}
```

### 4. Capture API Route

Server-side endpoint for recording GSAP templates:

```typescript
// src/app/api/capture/gsap/[template]/route.ts

import { NextRequest } from 'next/server';
import createBrowserPage from '@/utils/createBrowserPage';
import { captureGSAPAnimation } from '@/lib/gsap/captureAnimation';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ template: string }> }
) {
  const { template } = await params;
  const body = await request.json();
  
  const {
    options,
    outputFormat = 'video', // 'video' | 'frames' | 'gif'
  } = body;

  // Validate options
  if (!options?.animation) {
    return Response.json(
      { error: 'Missing animation options' },
      { status: 400 }
    );
  }

  const { duration, framerate } = options.animation;
  const totalFrames = Math.ceil(duration * framerate);

  // Create browser instance
  const { createPage, browser } = await createBrowserPage({
    headless: true,
    deviceScaleFactor: 2,
  });

  const page = await createPage();

  try {
    // Navigate to template with options
    const url = new URL(`http://localhost:3000/templates/gsap/${template}`);
    url.searchParams.set('capturing', 'true');
    url.searchParams.set('options', JSON.stringify(options));

    await page.goto(url.toString(), { waitUntil: 'networkidle0' });

    // Wait for template to be ready
    await page.waitForSelector('[data-ready="true"]');

    // Capture frames
    const frames = [];
    for (let frame = 0; frame < totalFrames; frame++) {
      // Seek timeline to frame
      await page.evaluate((frameNum) => {
        window.dispatchEvent(
          new CustomEvent('capture:seek-frame', {
            detail: { frame: frameNum },
          })
        );
      }, frame);

      // Wait for animations to settle
      await page.waitForTimeout(100);

      // Capture frame
      const screenshot = await page.screenshot({
        type: 'png',
        clip: {
          x: 0,
          y: 0,
          width: 1080,
          height: 1350,
        },
      });

      frames.push(screenshot);
    }

    // Generate video from frames using ffmpeg
    const videoBuffer = await generateVideo(frames, framerate);

    return new Response(videoBuffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${template}.mp4"`,
      },
    });
  } finally {
    await page.close();
    await browser.close();
  }
}
```

## Data Models

### Template Options Type

```typescript
// src/types/gsap-template.types.ts

export interface GSAPTemplateOptions {
  // Required animation configuration
  animation: {
    duration: number;      // Total duration in seconds
    framerate: number;     // FPS for recording
  };
  
  // Template-specific options (defined per template)
  [key: string]: any;
}

export interface GSAPTemplateMetadata {
  id: string;
  name: string;
  description: string;
  category: 'photo' | 'text' | 'motion' | 'mixed';
  thumbnail: string;
  defaultOptions: GSAPTemplateOptions;
}

export interface CaptureRequest {
  template: string;
  options: GSAPTemplateOptions;
  outputFormat: 'video' | 'frames' | 'gif';
}

export interface CaptureProgress {
  currentFrame: number;
  totalFrames: number;
  progress: number;
  status: 'initializing' | 'capturing' | 'encoding' | 'complete' | 'error';
}
```

### Timeline Sync State

```typescript
export interface TimelineSyncState {
  timeline: gsap.core.Timeline | null;
  currentFrame: number;
  totalFrames: number;
  progress: number;
  isCapturing: boolean;
  isReady: boolean;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Timeline Duration Consistency
*For any* GSAP template with animation options, the GSAP timeline duration should exactly match `options.animation.duration`
**Validates: Requirements 2.2**

### Property 2: Frame Count Accuracy
*For any* animation with duration D seconds and framerate F fps, the total number of captured frames should equal `Math.ceil(D * F)`
**Validates: Requirements 2.4**

### Property 3: Timeline Progress Monotonicity
*For any* sequence of frame captures, the timeline progress should be monotonically increasing from 0 to 1
**Validates: Requirements 2.3**

### Property 4: Options Reactivity
*For any* change to template options in Interactive Mode, the template should update within one render cycle
**Validates: Requirements 3.3**

### Property 5: Capture Readiness
*For any* template in Capture Mode, frame capture should not begin until the `data-ready` attribute is true
**Validates: Requirements 4.3**

### Property 6: Asset Loading Completion
*For any* template with async asset loading, all assets should be loaded before the first frame is captured
**Validates: Requirements 4.5**

### Property 7: Template Discovery
*For any* valid template directory under `src/app/templates/gsap/`, the Template System should discover and list it
**Validates: Requirements 5.3**

### Property 8: TypeScript Type Safety
*For any* template options object, TypeScript should enforce type correctness at compile time
**Validates: Requirements 7.4**

## Error Handling

### Template Loading Errors

```typescript
try {
  // Load template options
  const options = await loadTemplateOptions(templateId);
} catch (error) {
  if (error instanceof TemplateNotFoundError) {
    return <ErrorPage message="Template not found" />;
  }
  if (error instanceof InvalidOptionsError) {
    return <ErrorPage message="Invalid template configuration" />;
  }
  throw error;
}
```

### GSAP Timeline Errors

```typescript
useEffect(() => {
  try {
    if (!timeline) return;
    
    timeline
      .from('.element', { opacity: 0 })
      .to('.element', { x: 100 });
  } catch (error) {
    console.error('GSAP animation error:', error);
    // Fallback to static display
    setAnimationFailed(true);
  }
}, [timeline]);
```

### Capture Errors

```typescript
// In capture API route
try {
  const frames = await captureFrames(page, options);
  const video = await generateVideo(frames, framerate);
  return video;
} catch (error) {
  if (error instanceof TimeoutError) {
    return Response.json(
      { error: 'Capture timeout - animation too complex' },
      { status: 408 }
    );
  }
  if (error instanceof MemoryError) {
    return Response.json(
      { error: 'Insufficient memory for capture' },
      { status: 507 }
    );
  }
  throw error;
}
```

### Asset Loading Errors

```typescript
const [imageError, setImageError] = useState(false);

<img
  src={options.photo.image}
  onError={() => {
    setImageError(true);
    console.error('Failed to load image');
  }}
  onLoad={() => {
    setImageError(false);
  }}
/>

{imageError && (
  <div className="text-red-500">
    Failed to load image. Please try another.
  </div>
)}
```

### Unit Testing

**Framework**: Jest + React Testing Library

**Test Coverage**:
- `useGSAPTimeline` hook behavior
- Options parsing and validation
- Component rendering with different option sets
- Error boundary behavior

**Example Tests**:
```typescript
describe('useGSAPTimeline', () => {
  it('creates timeline with correct duration', () => {
    const { result } = renderHook(() =>
      useGSAPTimeline({
        container: mockRef,
        options: { duration: 5, framerate: 30 },
        capturing: false,
      })
    );
    
    expect(result.current.timeline?.duration()).toBe(5);
  });

  it('syncs to frame number in capture mode', async () => {
    const { result } = renderHook(() =>
      useGSAPTimeline({
        container: mockRef,
        options: { duration: 5, framerate: 30 },
        capturing: true,
      })
    );

    // Simulate frame 75 (halfway through 150 frames)
    window.dispatchEvent(
      new CustomEvent('capture:seek-frame', { detail: { frame: 75 } })
    );

    await waitFor(() => {
      expect(result.current.progress).toBeCloseTo(0.5);
    });
  });
});
```

### Property-Based Testing

**Framework**: fast-check (JavaScript property testing library)

**Configuration**: Minimum 100 iterations per property test

**Property Tests**:

```typescript
import fc from 'fast-check';

describe('GSAP Template Properties', () => {
  it('Property 1: Timeline duration matches options', () => {
    fc.assert(
      fc.property(
        fc.record({
          duration: fc.float({ min: 0.1, max: 60 }),
          framerate: fc.integer({ min: 1, max: 120 }),
        }),
        (animationOptions) => {
          const timeline = createTimeline(animationOptions);
          expect(timeline.duration()).toBe(animationOptions.duration);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2: Frame count accuracy', () => {
    fc.assert(
      fc.property(
        fc.record({
          duration: fc.float({ min: 1, max: 30 }),
          framerate: fc.constantFrom(24, 30, 60),
        }),
        (options) => {
          const expectedFrames = Math.ceil(options.duration * options.framerate);
          const actualFrames = calculateTotalFrames(options);
          expect(actualFrames).toBe(expectedFrames);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 3: Timeline progress monotonicity', () => {
    fc.assert(
      fc.property(
        fc.record({
          duration: fc.float({ min: 1, max: 10 }),
          framerate: fc.integer({ min: 10, max: 60 }),
        }),
        (options) => {
          const timeline = createTimeline(options);
          const totalFrames = Math.ceil(options.duration * options.framerate);
          const progressValues: number[] = [];

          for (let frame = 0; frame < totalFrames; frame++) {
            timeline.progress(frame / totalFrames);
            progressValues.push(timeline.progress());
          }

          // Check monotonicity
          for (let i = 1; i < progressValues.length; i++) {
            expect(progressValues[i]).toBeGreaterThanOrEqual(progressValues[i - 1]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Integration Testing

**Test Scenarios**:
1. Full capture flow from template load to video generation
2. Options updates triggering re-renders
3. Asset loading and EXIF parsing
4. Interactive mode → Capture mode transition

**Example**:
```typescript
describe('Photo EXIF Template Integration', () => {
  it('captures full animation with EXIF data', async () => {
    const options = {
      animation: { duration: 3, framerate: 30 },
      photo: { image: 'test-image.jpg', showExif: true },
    };

    const response = await fetch('/api/capture/gsap/photo-exif', {
      method: 'POST',
      body: JSON.stringify({ options }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('video/mp4');
    
    const videoBuffer = await response.arrayBuffer();
    expect(videoBuffer.byteLength).toBeGreaterThan(0);
  });
});
```

### End-to-End Testing

**Framework**: Playwright

**Test Coverage**:
- User creates template with custom options
- User previews animation in interactive mode
- User triggers recording
- System generates and downloads video

## Implementation Notes

### GSAP Plugin Support

Templates can import additional GSAP plugins as needed:

```typescript
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';

gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);
```

### Performance Considerations

1. **Lazy Loading**: Load GSAP and plugins only when template is active
2. **Timeline Caching**: Reuse timeline instances when options don't change
3. **Asset Preloading**: Load all images/fonts before starting capture
4. **Memory Management**: Clear timeline and dispose resources on unmount

### Canvas Integration

Templates can mix HTML/CSS with Canvas:

```typescript
const canvasRef = useRef<HTMLCanvasElement>(null);

useEffect(() => {
  if (!canvasRef.current) return;
  
  const ctx = canvasRef.current.getContext('2d');
  
  // Sync canvas drawing with GSAP timeline
  timeline?.eventCallback('onUpdate', () => {
    const progress = timeline.progress();
    drawFrame(ctx, progress);
  });
}, [timeline]);

return (
  <div className="relative">
    <canvas ref={canvasRef} width={1080} height={1350} />
    <div className="absolute inset-0">
      {/* HTML content overlaid on canvas */}
    </div>
  </div>
);
```

### Migration Path for Existing HTML Templates

The existing `exif-detail` template can be migrated to the GSAP system:

1. Move from `src/app/templates/html/exif-detail` to `src/app/templates/gsap/photo-exif`
2. Add `options.ts` with animation configuration
3. Integrate `useGSAPTimeline` hook
4. Add GSAP animations for EXIF data reveal
5. Update capture API route to use new GSAP capture system

This provides a reference implementation for future templates.
