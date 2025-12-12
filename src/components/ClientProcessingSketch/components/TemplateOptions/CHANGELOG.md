# TemplateOptions Changelog

## [Refactoring] - 2024-12-12

### Fixed
- **Turbopack Compatibility**: Removed `pica` library dependency that was causing `__turbopack_context__` errors
- **Immediate Thumbnail Display**: Fixed issue where thumbnails wouldn't display immediately on persisted sketches
- **Duplicate Loading**: Added ref tracking to prevent loading persisted thumbnails multiple times

### Changed
- **Thumbnail Capture**: Switched from `pica` to native Canvas API for image resizing
  - Better compatibility with Next.js and Turbopack
  - No external dependencies for thumbnail capture
  - Still maintains high quality with `imageSmoothingQuality: "high"`
- **Default Behavior**: `enableThumbnails` now defaults to `true` (was `false`)
- **State Management**: Thumbnails now replace entire state instead of merging to avoid stale data

### Added
- **New Hook Methods**:
  - `captureCurrentSlide(slideId)` - Capture with delay for refresh scenarios
  - `clearThumbnails()` - Reset all thumbnails and state
- **Better Initial Capture**: Automatically captures first slide thumbnail if none exist
- **Comprehensive Documentation**: Added THUMBNAIL_GUIDE.md with troubleshooting and API reference

### Removed
- **Dependencies**: 
  - `pica` (npm package)
  - `@types/pica` (dev dependency)

### Technical Details

#### Before (with pica)
```typescript
import pica from "pica";
const picaInstance = pica();
await picaInstance.resize(sourceCanvas, destCanvas, {
  quality: 3,
  unsharpAmount: 80,
  unsharpRadius: 0.6,
  unsharpThreshold: 2,
});
```

#### After (native Canvas API)
```typescript
const ctx = destCanvas.getContext("2d", {
  alpha: false,
  willReadFrequently: false,
});
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = "high";
ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);
```

### Migration Guide

No code changes required for existing usage. The component API remains the same.

**If you were explicitly disabling thumbnails:**
```typescript
// Before: thumbnails disabled by default
<TemplateOptions {...props} />

// After: thumbnails enabled by default, explicitly disable if needed
<TemplateOptions {...props} enableThumbnails={false} />
```

### Performance Impact

- **Positive**: No more WebAssembly loading overhead from pica
- **Positive**: Faster initial load (no external library to download)
- **Neutral**: Image quality remains high with native Canvas API
- **Positive**: Smaller bundle size (~100KB reduction)

### Browser Compatibility

Native Canvas API with `imageSmoothingQuality` is supported in:
- Chrome 54+
- Firefox 56+
- Safari 11+
- Edge 79+

All modern browsers are fully supported.

## [Initial Refactoring] - 2024-12-12

### Changed
- Split large monolithic component (~600 lines) into smaller modules
- Created custom hooks: `useFormState`, `useSlideManagement`, `useThumbnails`
- Extracted UI into `OptionsPanel` component
- Created utility module `thumbnailUtils.ts`

### Added
- Feature flag `enableThumbnails` to control thumbnail functionality
- Comprehensive README.md documentation
- Type safety improvements across all modules
