# GSAP HTML Templates

## Overview

GSAP HTML Templates are React-based animation templates that use GSAP (GreenSock Animation Platform) for smooth, professional animations. These templates can be used interactively in the browser or captured as videos.

## Features

- **GSAP-powered animations**: Smooth, professional animations using industry-standard GSAP library
- **Frame-accurate capture**: Record animations as high-quality videos with precise frame control
- **Interactive preview**: Play, pause, scrub, and preview animations in real-time
- **Configurable options**: Customize animations through a structured options system
- **TypeScript support**: Full type safety and IntelliSense support

## Architecture

### Template Structure

Each GSAP template follows this structure:

```
src/app/templates/gsap/[template-name]/
├── page.tsx              # Main template component
├── options.ts            # Configuration schema and defaults
├── types/                # TypeScript type definitions
│   └── index.ts
├── components/           # Template-specific components
│   └── ...
└── README.md            # Template documentation
```

### Key Components

1. **useGSAPTimeline Hook**: Manages GSAP timeline lifecycle and synchronization
2. **Template Component**: React component that renders the animation
3. **Options Configuration**: Defines customizable parameters
4. **Capture API**: Server-side endpoint for video generation

## Creating a New Template

### 1. Create Template Directory

```bash
mkdir -p src/app/templates/gsap/my-template/{components,types}
```

### 2. Define Types

Create `src/app/templates/gsap/my-template/types/index.ts`:

```typescript
import { GSAPTemplateOptions } from '@/types/gsap-template.types';

export interface MyTemplateOptions extends GSAPTemplateOptions {
  animation: {
    duration: number;
    framerate: number;
  };
  // Add your custom options
  text: {
    content: string;
    color: [number, number, number];
  };
}
```

### 3. Define Options

Create `src/app/templates/gsap/my-template/options.ts`:

```typescript
import { MyTemplateOptions } from './types';

export const defaultOptions: MyTemplateOptions = {
  animation: {
    duration: 5,
    framerate: 30,
  },
  text: {
    content: 'Hello World',
    color: [0, 0, 0],
  },
};

export const formConfiguration = {
  animation: {
    label: 'Animation',
    component: 'nested-object',
    fields: {
      duration: {
        label: 'Duration (seconds)',
        component: 'slider',
        min: 1,
        max: 60,
        step: 0.5,
      },
      framerate: {
        label: 'Framerate (fps)',
        component: 'select',
        options: [24, 30, 60],
      },
    },
  },
  text: {
    label: 'Text',
    component: 'nested-object',
    fields: {
      content: {
        label: 'Content',
        component: 'text',
      },
      color: {
        label: 'Color',
        component: 'color',
      },
    },
  },
};
```

### 4. Create Template Component

Create `src/app/templates/gsap/my-template/page.tsx`:

```typescript
"use client";

import React, { useEffect, useState, useRef } from "react";
import gsap from "gsap";
import { useGSAPTimeline } from "@/lib/gsap/useGSAPTimeline";
import { MyTemplateOptions } from "./types";
import { defaultOptions } from "./options";
import ScalableViewport from "@/components/ScalableViewport/ScalableViewport";
import GSAPTemplateControls from "@/components/GSAPTemplateControls/GSAPTemplateControls";

export default function MyTemplate() {
  const [options, setOptions] = useState<MyTemplateOptions | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Initialize GSAP timeline
  const { timeline, progress, isReady: timelineReady, currentFrame, totalFrames } = useGSAPTimeline({
    container: containerRef as React.RefObject<HTMLElement>,
    options: options?.animation,
    capturing,
    onComplete: () => {
      if (capturing) {
        document.body.setAttribute('data-capture-complete', 'true');
      }
      setIsPlaying(false);
    }
  });

  // Load options
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    setCapturing(searchParams.has('capturing'));
    
    const optionsParam = searchParams.get('options');
    if (optionsParam) {
      try {
        setOptions(JSON.parse(optionsParam));
      } catch {
        setOptions(defaultOptions);
      }
    } else {
      setOptions(defaultOptions);
    }
  }, []);

  // Mark as ready
  useEffect(() => {
    if (options && timelineReady) {
      setIsReady(true);
    }
  }, [options, timelineReady]);

  // Define animations
  useEffect(() => {
    if (!timeline || !isReady || !options) return;

    timeline.clear();

    // Add your GSAP animations here
    gsap.set('#animated-text', { opacity: 0, y: 50 });
    
    timeline
      .to('#animated-text', {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: 'power2.out',
      })
      .to('#animated-text', {
        scale: 1.2,
        duration: 1,
      })
      .to('#animated-text', {
        rotation: 360,
        duration: 2,
      });

  }, [timeline, isReady, options]);

  if (!options) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <>
      <ScalableViewport
        initialScale={capturing ? 1 : undefined}
        showZoomControls={!capturing}
        disable={capturing}
      >
        <div className="flex items-center justify-center h-screen">
          <div
            id="capture-container"
            ref={containerRef}
            className="w-[1080px] h-[1350px] bg-white p-16"
            data-ready={isReady}
          >
            <h1
              id="animated-text"
              style={{ color: `rgb(${options.text.color.join(',')})` }}
            >
              {options.text.content}
            </h1>
          </div>
        </div>
      </ScalableViewport>

      {!capturing && isReady && (
        <GSAPTemplateControls
          isPlaying={isPlaying}
          progress={progress}
          currentFrame={currentFrame}
          totalFrames={totalFrames}
          onPlayPause={() => {
            if (isPlaying) timeline?.pause();
            else timeline?.play();
            setIsPlaying(!isPlaying);
          }}
          onRestart={() => {
            timeline?.restart();
            setIsPlaying(true);
          }}
          onSeek={(p) => {
            timeline?.pause();
            timeline?.progress(p);
            setIsPlaying(false);
          }}
        />
      )}
    </>
  );
}
```

### 5. Register Template

Add your template to `src/lib/gsap/templateRegistry.ts`:

```typescript
{
  id: 'my-template',
  name: 'My Template',
  description: 'Description of what your template does',
  category: 'text',
  thumbnail: '/templates/gsap/my-template/thumbnail.png',
  defaultOptions: defaultOptions,
}
```

## Using Templates

### Interactive Mode

Navigate to `/templates/gsap/[template-name]` to use the template interactively:

- Use the play/pause button to control playback
- Scrub through the timeline with the progress slider
- Click "Record" to capture as video

### Capture Mode

Make a POST request to `/api/capture/gsap/[template-name]`:

```typescript
const response = await fetch('/api/capture/gsap/photo-exif', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    options: {
      animation: {
        duration: 5,
        framerate: 30,
      },
      // ... other options
    },
  }),
});

const blob = await response.blob();
// Download or use the video blob
```

## Animation Best Practices

### 1. Timeline Duration

Always ensure your timeline duration matches `options.animation.duration`:

```typescript
timeline.duration(options.animation.duration);
```

### 2. Initial States

Set initial states with `gsap.set()` before animating:

```typescript
gsap.set('#element', { opacity: 0, y: 50 });
timeline.to('#element', { opacity: 1, y: 0, duration: 1 });
```

### 3. Relative Timing

Use relative timing for better maintainability:

```typescript
const duration = options.animation.duration;
const phase1 = duration * 0.3;  // 30% of total duration
const phase2 = duration * 0.4;  // 40% of total duration

timeline
  .to('#element1', { opacity: 1, duration: phase1 }, 0)
  .to('#element2', { opacity: 1, duration: phase2 }, phase1);
```

### 4. Easing

Use appropriate easing functions for natural motion:

```typescript
timeline.to('#element', {
  x: 100,
  duration: 1,
  ease: 'power2.out',  // Smooth deceleration
});
```

### 5. Staggered Animations

Animate multiple elements with stagger:

```typescript
timeline.to('.items', {
  opacity: 1,
  y: 0,
  duration: 0.5,
  stagger: 0.1,  // 0.1s delay between each item
});
```

## Troubleshooting

### Timeline Not Playing

- Ensure `data-ready="true"` is set on the container
- Check that `useGSAPTimeline` hook receives valid options
- Verify timeline is not paused

### Capture Fails

- Check that ffmpeg is installed on the server
- Verify all assets are loaded before capture starts
- Ensure timeline duration is reasonable (< 5 minutes)

### Animations Choppy

- Reduce complexity of animations
- Use `will-change` CSS property for animated elements
- Avoid animating expensive properties (use transforms instead)

## API Reference

### useGSAPTimeline Hook

```typescript
const { timeline, progress, isReady, currentFrame, totalFrames } = useGSAPTimeline({
  container: React.RefObject<HTMLElement>,
  options: GSAPAnimationOptions,
  capturing: boolean,
  onComplete?: () => void,
  onUpdate?: (progress: number) => void,
});
```

### Validation Functions

```typescript
import { validateTemplateOptions, validateAnimationOptions } from '@/lib/gsap/validation';

// Validate full template options
validateTemplateOptions(options);

// Validate just animation options
validateAnimationOptions(options.animation);
```

## Examples

See the `photo-exif` template for a complete working example:
- `src/app/templates/gsap/photo-exif/`

This template demonstrates:
- Image loading and display
- EXIF data parsing
- Staggered text animations
- Interactive controls
- Error handling
