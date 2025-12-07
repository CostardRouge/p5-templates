# Implementation Plan

- [x] 1. Set up GSAP infrastructure and shared utilities
  - Create TypeScript types for GSAP templates
  - Install GSAP library and TypeScript definitions
  - Create `useGSAPTimeline` hook for timeline management
  - Create frame synchronization utilities
  - _Requirements: 1.1, 1.3, 2.1, 2.2, 2.3, 7.1, 7.3_

- [x] 1.1 Write property test for timeline duration consistency
  - **Property 1: Timeline Duration Consistency**
  - **Validates: Requirements 2.2**

- [x] 2. Create photo-exif GSAP template structure
  - Create directory structure under `src/app/templates/gsap/photo-exif/`
  - Define options configuration with animation settings
  - Create TypeScript types for template options
  - Set up form configuration for UI controls
  - _Requirements: 3.1, 3.2, 5.1, 5.2, 7.2_

- [x] 3. Implement photo-exif template component
  - Create main page.tsx component with React hooks
  - Integrate useGSAPTimeline hook
  - Implement options loading from URL params
  - Add ScalableViewport wrapper for zoom controls
  - Handle capture mode vs interactive mode
  - _Requirements: 1.1, 1.3, 2.1, 6.1, 6.2_

- [ ]* 3.1 Write property test for options reactivity
  - **Property 4: Options Reactivity**
  - **Validates: Requirements 3.3**

- [x] 4. Migrate EXIF functionality to GSAP template
  - Port ExifInfo component to new template
  - Port ImageDropzone component
  - Implement image loading and EXIF parsing
  - Add GPS coordinate formatting
  - Maintain existing EXIF display functionality
  - _Requirements: 1.1, 1.4, 3.4_

- [ ] 5. Add GSAP animations to photo-exif template
  - Create timeline animations for EXIF data reveal
  - Animate image entrance
  - Add smooth transitions for text elements
  - Sync animations to options.animation.duration
  - _Requirements: 2.2, 2.3, 2.4_

- [ ] 5.1 Write property test for timeline progress monotonicity
  - **Property 3: Timeline Progress Monotonicity**
  - **Validates: Requirements 2.3**

- [ ] 6. Implement GSAP capture API route
  - Create `/api/capture/gsap/[template]/route.ts`
  - Set up Puppeteer browser instance
  - Implement frame-by-frame capture logic
  - Add timeline seek functionality
  - Handle frame synchronization events
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 7. Add video generation from captured frames
  - Integrate ffmpeg for frame-to-video conversion
  - Support multiple output formats (mp4, gif)
  - Add progress tracking for encoding
  - Handle cleanup of temporary files
  - _Requirements: 4.4_

- [ ] 8. Create template discovery and listing system
  - Scan `src/app/templates/gsap/` directory
  - Generate template metadata
  - Create template registry
  - Add template thumbnails
  - _Requirements: 5.3, 8.1, 8.2_
- [ ] 9. Integrate GSAP templates with existing UI
  - Update template browser to show GSAP templates
  - Add filter for template type (p5.js vs GSAP)
  - Create template selection flow
  - Add category organization
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 10. Add interactive preview controls
  - Implement timeline scrubbing
  - Add play/pause controls
  - Show current frame number
  - Display animation progress
  - Add "Record" button to trigger capture
  - _Requirements: 6.1, 6.3, 6.4, 6.5_

- [ ] 11. Implement options UI for GSAP templates
  - Generate form controls from options configuration
  - Support all field types (slider, color, image, etc.)
  - Add real-time option updates
  - Persist options to URL params
  - Handle asset uploads
  - _Requirements: 3.2, 3.3, 3.4_

- [ ] 12. Add error handling and validation
  - Validate template options schema
  - Handle missing assets gracefully
  - Add timeout protection for capture
  - Implement error boundaries
  - Show user-friendly error messages
  - _Requirements: 4.5, 7.4_

- [ ] 13. Add TypeScript type safety
  - Create comprehensive type definitions
  - Add type guards for options validation
  - Ensure compile-time type checking
  - Generate types from options schema
  - _Requirements: 7.1, 7.2, 7.3, 7.4_
- [ ] 14. Create documentation and examples
  - Write template creation guide
  - Document useGSAPTimeline hook API
  - Add code examples for common patterns
  - Create migration guide from HTML templates
  - Document options configuration format
  - _Requirements: 5.2, 5.4_

- [ ] 15. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Optimize performance
  - Implement lazy loading for GSAP
  - Add timeline caching
  - Optimize asset preloading
  - Add memory cleanup on unmount
  - Test with complex animations
  - _Requirements: 1.1, 4.3, 4.5_

- [ ] 17. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
