# Per-Slide Sketch Settings Implementation

## Overview
This implementation adds support for per-slide sketch settings, allowing each slide to have its own independent sketch configuration that overrides global settings.

## Architecture Changes

### 1. Schema Updates (`src/types/sketch.types.ts`)
- Added `sketch: z.any().optional()` field to `SlideSchema`
- Each slide can now store its own sketch settings independently

### 2. P5 Slides Utility (`src/p5-sketches/utils/slides/index.js`)
- Added `getSketchSettings()` method that merges global and slide-specific settings
- Slide settings override global settings when both exist
- Exposed `window.getSketchSettings()` for p5 sketches to access merged settings

### 3. Options Proxy (`src/p5-sketches/utils/options.js`)
- Added a Proxy wrapper around `sketchOptions`
- When `options.sketch` is accessed, it automatically returns merged settings from current slide
- P5 sketches can continue using `options.sketch` without code changes

### 4. SketchSettings Component (`src/components/.../SketchSettings/SketchSettings.tsx`)
- Now accepts `activeSlideIndex?: number` prop
- Automatically uses slide-specific basePath when a slide is active:
  - With slide: `slides.{slideIndex}.sketch`
  - Without slide: `sketch` (global)
- Header shows slide indicator: "sketch options (slide 1)"

### 5. TemplateOptions Component (`src/components/.../TemplateOptions/TemplateOptions.tsx`)
- Passes `activeSlideIndex` to `SketchSettings` component
- Settings automatically switch context when user selects different slides

## How It Works

### For Users
1. **No slides**: SketchSettings edits global `sketch` settings
2. **With slides**: SketchSettings edits `slides[activeIndex].sketch` settings
3. Settings automatically switch when you select a different slide
4. Each slide can have completely different sketch configurations

### For P5 Sketches
- No code changes needed in existing sketches
- `options.sketch` automatically returns merged settings:
  - Global settings as base
  - Current slide settings override globals
- Example:
  ```javascript
  // Global: { backgroundColor: [255, 255, 255], fontSize: 20 }
  // Slide 0: { fontSize: 30 }
  // Result when on slide 0: { backgroundColor: [255, 255, 255], fontSize: 30 }
  ```

### Data Flow
```
User edits settings → Form updates slides[i].sketch → 
P5 options proxy intercepts → Merges global + slide settings → 
Sketch receives merged config
```

## Benefits

1. **Per-slide customization**: Each slide can have unique visual settings
2. **Global defaults**: Slides inherit global settings unless overridden
3. **Backward compatible**: Works with existing sketches without changes
4. **Drag & drop ready**: Sketch settings are part of slide data structure
5. **Clean separation**: Settings component remains reusable and simple

## Future Enhancements

- Could add "Reset to global" button for slide settings
- Could show visual diff between global and slide settings
- Could add "Apply to all slides" action
