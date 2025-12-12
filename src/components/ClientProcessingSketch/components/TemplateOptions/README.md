# TemplateOptions Component Refactoring

## Overview
The TemplateOptions component has been refactored from a large monolithic component (~600+ lines) into smaller, more maintainable pieces with clear separation of concerns.

## Structure

### Main Component
- **TemplateOptions.tsx** - Orchestrates all the pieces, now ~160 lines

### Custom Hooks

#### `useFormState.ts`
Manages form state, validation, auto-save, and unsaved changes detection.
- Form initialization with react-hook-form
- Auto-save every 10 seconds for draft recordings
- Unsaved changes modal integration
- Returns: methods, modal handlers, unsaved state

#### `useSlideManagement.ts`
Handles all slide operations and active slide tracking.
- Add, duplicate, delete, reorder, rename slides
- Active slide selection and navigation
- Automatic slide index adjustment
- Integration with thumbnail capture (when enabled)
- Returns: slide handlers and active index

#### `useThumbnails.ts`
Manages thumbnail capture and storage (feature-flagged).
- Thumbnail capture from canvas using pica
- Loading persisted thumbnails from jobs
- Support for both draft (data URLs) and completed (S3 URLs) recordings
- Returns: thumbnails map, capture function, pending ref

### Components

#### `OptionsPanel.tsx`
Renders the options UI panel with all controls.
- Root settings
- Global content section
- Slides carousel and editor
- Import/export functionality
- Receives all handlers as props

### Utils

#### `thumbnailUtils.ts`
Pure utility functions for thumbnail operations.
- `captureThumbnailFromCanvas()` - High-quality canvas capture using pica
- Configurable quality settings
- Error handling

## Feature Flag: `enableThumbnails`

The thumbnail feature is now controlled by an optional prop:

```tsx
<TemplateOptions
  name="my-sketch"
  options={options}
  onOptionsChange={handleChange}
  enableThumbnails={false} // Default: false (disabled)
/>
```

### When `enableThumbnails={false}` (default):
- No thumbnail capture logic runs
- No pica initialization
- Empty thumbnails object passed to components
- Reduced memory usage and processing

### When `enableThumbnails={true}`:
- Full thumbnail capture functionality
- Automatic capture on slide changes
- Persisted thumbnails loaded from jobs
- High-quality resizing with pica

## Benefits

1. **Modularity**: Each hook/component has a single responsibility
2. **Testability**: Hooks and utils can be tested independently
3. **Maintainability**: Easier to locate and modify specific functionality
4. **Performance**: Thumbnail feature can be disabled when not needed
5. **Reusability**: Hooks can be used in other components if needed
6. **Type Safety**: All pieces are fully typed

## Migration Guide

For existing usage, no changes required - the component API remains the same. To enable thumbnails:

```tsx
// Before (thumbnails always active)
<TemplateOptions {...props} />

// After (thumbnails disabled by default)
<TemplateOptions {...props} />

// After (thumbnails enabled)
<TemplateOptions {...props} enableThumbnails={true} />
```

## File Structure

```
TemplateOptions/
├── TemplateOptions.tsx          # Main orchestrator
├── README.md                    # This file
├── components/
│   ├── OptionsPanel.tsx         # UI panel component
│   ├── CaptureActions/
│   ├── SlideCarousel/
│   └── ...
├── hooks/
│   ├── useFormState.ts          # Form management
│   ├── useSlideManagement.ts    # Slide operations
│   └── useThumbnails.ts         # Thumbnail capture
└── utils/
    ├── thumbnailUtils.ts        # Thumbnail utilities
    └── makeDefaultSlide.ts
```
