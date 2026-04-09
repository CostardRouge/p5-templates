# Photo EXIF GSAP Template

A GSAP-based HTML template that displays photos with EXIF metadata using smooth animations.

## Structure

```
photo-exif/
├── page.tsx              # Main template component (React + GSAP)
├── options.ts            # Configuration schema and form definitions
├── types/
│   └── index.ts         # TypeScript type definitions
└── components/          # Template-specific components
    └── README.md
```

## Options

The template supports the following configurable options:

### Animation
- **duration**: Total animation duration in seconds (1-60s)
- **framerate**: Frames per second for recording (24, 30, or 60 fps)

### Photo
- **image**: Image file to display
- **margin**: Image margin (0-0.45)
- **backgroundColor**: Background color as RGB array

### Font
- **face**: Font family name
- **size**: Font size (1-244)
- **color**: Font color as RGB array
- **stroke**: Font stroke color as RGB array

### Text Overrides
- **topLeft**: Custom text for top-left corner
- **topRight**: Custom text for top-right corner
- **bottomLeft**: Custom text for bottom-left corner
- **bottomRight**: Custom text for bottom-right corner

## Requirements Addressed

- **3.1**: Options configuration file with animation settings ✓
- **3.2**: Form configuration for UI controls ✓
- **5.1**: Consistent directory structure under `src/app/gsap/` ✓
- **5.2**: Separate files for component, options, and types ✓
- **7.2**: TypeScript interfaces from options schema ✓

## Features

- ✅ GSAP-powered smooth animations
- ✅ Automatic EXIF data extraction
- ✅ Interactive preview with playback controls
- ✅ Frame-accurate video capture
- ✅ Customizable colors, fonts, and timing
- ✅ Support for JPEG, PNG, GIF, and WebP

## Usage

### Interactive Mode

Navigate to `/gsap/photo-exif`:
1. Upload a photo
2. Preview the animation
3. Use controls to play/pause/scrub
4. Click "Record" to capture as MP4

### API Capture

```typescript
const response = await fetch('/api/capture/gsap/photo-exif', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ options }),
});
const video = await response.blob();
```

## Animation Timeline

- **Phase 1 (0-30%)**: Image entrance with fade and scale
- **Phase 2 (20-60%)**: EXIF data reveal with stagger
- **Phase 3 (60-100%)**: Hold final state

## Status

✅ **Complete and Production Ready**
