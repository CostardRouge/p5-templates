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
- **5.1**: Consistent directory structure under `src/app/templates/gsap/` ✓
- **5.2**: Separate files for component, options, and types ✓
- **7.2**: TypeScript interfaces from options schema ✓

## Next Steps

1. Implement the main page.tsx component with GSAP integration
2. Migrate ExifInfo and ImageDropzone components
3. Add GSAP animations for data reveal
4. Integrate with capture API
