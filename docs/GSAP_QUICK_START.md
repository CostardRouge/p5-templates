# GSAP Templates - Quick Start Guide

Get started with GSAP HTML Templates in 5 minutes!

## 🚀 Try It Now

### 1. Start the Development Server

```bash
npm run dev
```

### 2. Open the Template Browser

Navigate to: **http://localhost:3000/templates/gsap**

You'll see the GSAP template gallery with available templates.

### 3. Try the Photo EXIF Template

Click on "Photo EXIF" or navigate to: **http://localhost:3000/templates/gsap/photo-exif**

#### Interactive Mode:
1. **Upload a photo** - Drag & drop or click to select
2. **Watch the animation** - EXIF data animates in smoothly
3. **Use the controls** - Play, pause, scrub through the timeline
4. **Record video** - Click the "Record" button to capture as MP4

## 📖 What You Can Do

### Browse Templates
```
http://localhost:3000/templates/gsap
```
- View all available templates
- Filter by category (photo, text, motion, mixed)
- Search by name or description

### Use Templates Interactively
```
http://localhost:3000/templates/gsap/[template-name]
```
- Preview animations in real-time
- Control playback (play/pause/scrub)
- Adjust options (if UI is available)
- Record as video with one click

### Capture Programmatically
```typescript
const response = await fetch('/api/capture/gsap/photo-exif', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    options: {
      animation: {
        duration: 5,      // 5 seconds
        framerate: 30,    // 30 fps
      },
      photo: {
        image: null,
        margin: 0.1,
        backgroundColor: [255, 255, 255],
      },
      font: {
        face: 'martian',
        size: 20,
        color: [0, 0, 0],
        stroke: [255, 255, 255],
      },
    },
  }),
});

const videoBlob = await response.blob();
const url = URL.createObjectURL(videoBlob);
// Use the video URL
```

## 🎨 Create Your First Template

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
  text: {
    content: string;
    color: [number, number, number];
  };
}
```

### 3. Create Options

Create `src/app/templates/gsap/my-template/options.ts`:

```typescript
import { MyTemplateOptions } from './types';

export const defaultOptions: MyTemplateOptions = {
  animation: {
    duration: 5,
    framerate: 30,
  },
  text: {
    content: 'Hello GSAP!',
    color: [0, 0, 0],
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

export default function MyTemplate() {
  const [options, setOptions] = useState<MyTemplateOptions | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { timeline, progress, isReady: timelineReady } = useGSAPTimeline({
    container: containerRef as React.RefObject<HTMLElement>,
    options: options?.animation,
    capturing,
  });

  // Load options
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    setCapturing(searchParams.has('capturing'));
    
    const optionsParam = searchParams.get('options');
    setOptions(optionsParam ? JSON.parse(optionsParam) : defaultOptions);
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
    
    gsap.set('#text', { opacity: 0, y: 50 });
    
    timeline.to('#text', {
      opacity: 1,
      y: 0,
      duration: 1,
      ease: 'power2.out',
    });

  }, [timeline, isReady, options]);

  if (!options) return <div>Loading...</div>;

  return (
    <ScalableViewport
      initialScale={capturing ? 1 : undefined}
      showZoomControls={!capturing}
      disable={capturing}
    >
      <div className="flex items-center justify-center h-screen">
        <div
          id="capture-container"
          ref={containerRef}
          className="w-[1080px] h-[1350px] bg-white flex items-center justify-center"
          data-ready={isReady}
        >
          <h1
            id="text"
            className="text-6xl font-bold"
            style={{ color: `rgb(${options.text.color.join(',')})` }}
          >
            {options.text.content}
          </h1>
        </div>
      </div>
    </ScalableViewport>
  );
}
```

### 5. Register Template

Add to `src/lib/gsap/templateRegistry.ts`:

```typescript
{
  id: 'my-template',
  name: 'My Template',
  description: 'My awesome GSAP template',
  category: 'text',
  thumbnail: '/templates/gsap/my-template/thumbnail.png',
  defaultOptions: defaultOptions,
}
```

### 6. Test It!

Navigate to: **http://localhost:3000/templates/gsap/my-template**

## 🎯 Key Concepts

### Timeline Hook
The `useGSAPTimeline` hook manages your GSAP timeline:
- Automatically syncs with animation duration
- Handles capture mode vs interactive mode
- Provides progress tracking

### Capture Container
The element with `id="capture-container"` is what gets captured:
- Must have `data-ready="true"` when ready
- Recommended size: 1080x1350px (4:5 aspect ratio)

### Animation Options
All templates must include:
```typescript
animation: {
  duration: number;  // Total duration in seconds
  framerate: number; // FPS for recording (24, 30, or 60)
}
```

## 📚 Learn More

- **Full Documentation**: `docs/GSAP_TEMPLATES.md`
- **Implementation Details**: `docs/GSAP_TEMPLATES_IMPLEMENTATION.md`
- **Example Template**: `src/app/templates/gsap/photo-exif/`

## 🆘 Troubleshooting

### Template Not Showing in Browser
- Check that it's registered in `templateRegistry.ts`
- Verify the directory structure is correct
- Restart the dev server

### Animation Not Playing
- Ensure `data-ready="true"` is set
- Check browser console for errors
- Verify timeline is not paused

### Capture Fails
- Ensure ffmpeg is installed on the server
- Check that all assets are loaded
- Verify options are valid

## 🎉 You're Ready!

You now know how to:
- ✅ Browse and use existing templates
- ✅ Capture animations as videos
- ✅ Create your own templates
- ✅ Understand the core concepts

Happy animating! 🚀
