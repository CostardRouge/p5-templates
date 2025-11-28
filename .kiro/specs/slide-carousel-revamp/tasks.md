# Implementation Plan

- [-] 1. Set up thumbnail infrastructure and utilities
  - Create thumbnail generation utilities for canvas-to-image conversion
  - Implement thumbnail cache management with LRU eviction
  - Add thumbnail size calculation and aspect ratio utilities
  - _Requirements: 1.2, 8.2, 8.5_

- [ ] 1.1 Write property test for thumbnail aspect ratio preservation
  - **Property 2: Thumbnail aspect ratio preservation**
  - **Validates: Requirements 1.2, 5.3**

- [ ] 1.2 Write property test for thumbnail cache eviction
  - **Property 8: Thumbnail cache eviction**
  - **Validates: Requirements 8.5**

- [ ] 2. Create thumbnail manager hook
  - Implement `useThumbnailManager` hook with cache state management
  - Add methods for getting, generating, and invalidating thumbnails
  - Implement thumbnail source priority logic (S3 → cache → placeholder)
  - Add memory monitoring and cache size tracking
  - _Requirements: 1.4, 1.5, 8.1, 8.3, 8.4_

- [ ] 2.1 Write property test for thumbnail source priority
  - **Property 4: Thumbnail source priority**
  - **Validates: Requirements 1.4, 1.5, 8.4**

- [ ] 3. Implement slide name editing functionality
  - Create `SlideNameEditor` component with inline editing
  - Add name validation and whitespace trimming
  - Implement default name fallback logic ("Slide N")
  - Add keyboard shortcuts (Enter to save, Escape to cancel)
  - Update slide schema handling for name field
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 3.1 Write property test for slide name fallback
  - **Property 6: Slide name fallback**
  - **Validates: Requirements 2.5, 10.5**

- [ ] 3.2 Write unit tests for slide name editor
  - Test name validation (empty, whitespace)
  - Test save/cancel behavior
  - Test keyboard shortcuts
  - _Requirements: 2.1, 2.2, 2.5_

- [ ] 4. Create thumbnail display components
  - Create `ThumbnailImage` component for displaying S3 or cached thumbnails
  - Create `ThumbnailPlaceholder` component with centered slide name
  - Implement aspect ratio preservation in thumbnail rendering
  - Add loading states and error handling for thumbnail images
  - _Requirements: 1.2, 1.4, 1.5, 10.1, 10.2, 10.3, 10.4_

- [ ] 5. Build SlideThumbnail component
  - Create `SlideThumbnail` component with thumbnail, name, and actions
  - Integrate thumbnail manager for image source resolution
  - Add active/inactive state styling
  - Implement click handler for slide activation
  - Add duplicate and delete action buttons
  - Integrate `SlideNameEditor` for name editing
  - _Requirements: 1.1, 2.3, 3.1, 3.5, 10.4_

- [ ] 5.1 Write property test for active slide exclusivity
  - **Property 1: Active slide exclusivity**
  - **Validates: Requirements 3.2, 6.1**

- [ ] 5.2 Write unit tests for SlideThumbnail component
  - Test rendering logic (S3 → cache → placeholder)
  - Test active state styling
  - Test click handlers
  - _Requirements: 1.4, 1.5, 3.1_

- [ ] 6. Revamp SlideCarousel with grid layout
  - Update `SlideCarousel` component to use grid layout instead of list
  - Implement responsive grid (2-3 columns desktop, 2 columns mobile)
  - Replace old `SlideThumbnail` with new thumbnail component
  - Pass thumbnail URLs from job metadata to carousel
  - Maintain existing drag-and-drop functionality with @dnd-kit
  - Add slide name change handler
  - _Requirements: 1.1, 1.3, 2.2, 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 6.1 Write property test for drag-and-drop order consistency
  - **Property 3: Drag-and-drop order consistency**
  - **Validates: Requirements 4.3, 4.4**

- [ ] 6.2 Write property test for active slide persistence during reorder
  - **Property 9: Active slide persistence during reorder**
  - **Validates: Requirements 4.4**

- [ ] 7. Optimize mobile touch interactions
  - Configure @dnd-kit touch sensor with appropriate delays and tolerances
  - Test and tune activation constraints for mobile devices
  - Ensure smooth scrolling performance on mobile
  - Add touch-specific visual feedback
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 7.1 Write integration test for mobile touch interactions
  - Test drag-and-drop with touch events
  - Test tap-to-activate
  - Verify no conflicts between tap and drag
  - _Requirements: 9.1, 9.4_

- [ ] 8. Implement lazy loading for slide canvases
  - Update slide rendering to only load active slide canvas
  - Unload inactive slide canvases to free memory
  - Ensure proper cleanup on slide deactivation
  - Add canvas ready state tracking
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 8.1 Write property test for memory conservation
  - **Property 5: Memory conservation**
  - **Validates: Requirements 6.1, 6.2, 6.3**

- [ ] 9. Update recording process for per-slide thumbnails
  - Verify `recordSketch.ts` generates one thumbnail per slide
  - Ensure thumbnail URLs are stored in correct order in job metadata
  - Add error handling for thumbnail generation failures
  - Test thumbnail upload to S3 for multi-slide recordings
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 9.1 Write property test for S3 thumbnail count consistency
  - **Property 10: S3 thumbnail count consistency**
  - **Validates: Requirements 7.4**

- [ ] 9.2 Write unit tests for recording thumbnail generation
  - Test thumbnail generation for single slide
  - Test thumbnail generation for multiple slides
  - Test error handling for thumbnail failures
  - _Requirements: 7.1, 7.4, 7.5_

- [ ] 10. Implement in-memory thumbnail generation
  - Add thumbnail generation on slide activation for unsaved slides
  - Cache generated thumbnails in thumbnail manager
  - Implement thumbnail invalidation on slide content changes
  - Add debouncing for thumbnail regeneration
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 11. Integrate thumbnail manager with TemplateOptions
  - Pass job ID and thumbnail URLs to SlideCarousel
  - Initialize thumbnail manager in TemplateOptions
  - Connect thumbnail invalidation to form changes
  - Handle thumbnail loading states in UI
  - _Requirements: 1.4, 7.3, 8.1_

- [ ] 12. Checkpoint - Ensure all tests pass for core carousel functionality
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Implement feature flag system
  - Add environment variable for viewport thumbnails feature flag
  - Create `useFeatureFlag` hook or utility function
  - Implement device capability detection (memory, mobile)
  - Add runtime configuration support
  - _Requirements: 11.3, 11.5_

- [ ] 13.1 Write property test for feature flag isolation
  - **Property 7: Feature flag isolation**
  - **Validates: Requirements 11.1, 11.4**

- [ ] 14. Create ViewportThumbnailNav component (optional)
  - Create `ViewportThumbnailNav` component for viewport thumbnail display
  - Implement thumbnail grid layout for viewport
  - Add click handlers for slide navigation from viewport
  - Integrate with feature flag to conditionally render
  - Position thumbnails to not obscure canvas content
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 11.1, 11.2_

- [ ] 14.1 Write unit tests for ViewportThumbnailNav
  - Test conditional rendering based on feature flag
  - Test thumbnail click navigation
  - Test positioning logic
  - _Requirements: 5.4, 11.1, 11.2_

- [ ] 15. Update TemplateOptions to support viewport thumbnails
  - Add viewport thumbnail navigation to canvas viewport area
  - Pass feature flag state to viewport component
  - Ensure viewport thumbnails use same thumbnail manager
  - Test viewport thumbnail display with feature flag enabled/disabled
  - _Requirements: 5.1, 5.2, 11.1, 11.2, 11.4_

- [ ] 16. Add error handling and fallbacks
  - Implement error handling for thumbnail generation failures
  - Add fallback to placeholder on S3 thumbnail load errors
  - Handle memory pressure with cache eviction
  - Add error logging without blocking UI
  - Test drag-and-drop during thumbnail generation
  - _Requirements: 7.5, 8.4_

- [ ] 16.1 Write unit tests for error handling
  - Test thumbnail generation failure fallback
  - Test S3 thumbnail load error fallback
  - Test memory pressure handling
  - _Requirements: 7.5, 8.4_

- [ ] 17. Optimize performance for mobile devices
  - Test memory usage with 10+ slides on mobile
  - Optimize thumbnail generation speed (target < 100ms)
  - Ensure smooth drag-and-drop on mobile (target > 30fps)
  - Add performance monitoring and logging
  - _Requirements: 6.4, 6.5, 9.1, 9.2, 9.3, 9.5_

- [ ] 17.1 Write performance tests
  - Test memory usage with 20 slides
  - Test thumbnail generation speed
  - Test mobile frame rate during drag-and-drop
  - _Requirements: 6.4, 6.5, 9.5_

- [ ] 18. Update documentation and examples
  - Document new slide carousel features in user guide
  - Add examples of slide naming and thumbnail management
  - Document feature flag configuration
  - Add troubleshooting guide for thumbnail issues
  - _Requirements: All_

- [ ] 19. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
