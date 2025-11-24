# Implementation Plan

- [x] 1. Add global animation control functions to p5 utilities
  - Extend `src/p5-sketches/utils/time.js` with `setAnimationProgression()` and `getAnimationProgression()` functions
  - Expose functions on window object for React component access
  - Handle edge cases where animation duration is undefined
  - _Requirements: 6.1, 6.2, 6.5_

- [x] 2. Create AnimationProgressionBar component
  - Create `src/components/AnimationProgressionBar.tsx` with TypeScript interfaces
  - Implement component structure with progression state management
  - Add disabled prop handling for recording mode
  - _Requirements: 1.1, 5.4_

- [x] 2.1 Implement progression display logic
  - Read progression from `window.getAnimationProgression()` using polling or RAF
  - Convert progression (0-1) to percentage (0-100%)
  - Render visual indicator showing current position
  - _Requirements: 1.1, 1.2, 1.4, 1.5_

- [ ]* 2.2 Write property test for progression display
  - **Property 1: Progression display accuracy**
  - **Validates: Requirements 1.1, 1.5**

- [x] 2.3 Implement click-to-seek functionality
  - Add click event handler to calculate target progression from mouse position
  - Call `window.setAnimationProgression()` with calculated value
  - Clamp progression to [0, 1] range
  - Maintain play/pause state during seek
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ]* 2.4 Write property test for click position mapping
  - **Property 2: Click position to progression mapping**
  - **Validates: Requirements 2.1, 2.4, 2.5**

- [ ]* 2.5 Write property test for seek state preservation
  - **Property 3: Seeking maintains play/pause state**
  - **Validates: Requirements 2.3**

- [x] 2.6 Implement drag-to-scrub functionality
  - Add pointer down/move/up event handlers for scrubbing
  - Enter scrubbing mode on drag start, pause animation, store loop state
  - Update progression continuously during drag
  - Exit scrubbing mode on drag end, restore loop state
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ]* 2.7 Write property test for scrubbing bounds
  - **Property 3: Scrubbing maintains bounds**
  - **Validates: Requirements 3.2**

- [ ]* 2.8 Write property test for scrubbing state restoration
  - **Property 4: Scrubbing state restoration**
  - **Validates: Requirements 3.3, 3.5**

- [x] 2.9 Implement hover preview functionality
  - Add hover event handlers to track mouse position
  - Display vertical indicator line at hover position
  - Show tooltip with target percentage
  - Update hover state on mouse move
  - _Requirements: 7.1, 7.2, 7.3_

- [ ]* 2.10 Write property test for hover behavior
  - **Property 7: Hover preview display**
  - **Validates: Requirements 7.1, 7.2**

- [x] 3. Style the AnimationProgressionBar component
  - Apply layout styles (width, height, positioning)
  - Implement color scheme using CSS custom properties
  - Add blue gradient for filled track matching existing progress bars
  - Create hover, scrubbing, and disabled states
  - Add smooth transitions and animations
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2_

- [ ]* 3.1 Write property test for theme consistency
  - **Property 5: Theme consistency**
  - **Validates: Requirements 4.1, 4.2**

- [x] 4. Add accessibility features
  - Add ARIA attributes (role="slider", aria-label, aria-valuemin/max/now)
  - Implement keyboard navigation (Arrow keys, Home, End)
  - Add cursor changes for interactive states
  - Ensure focus states are visible
  - _Requirements: 7.4_

- [x] 5. Integrate AnimationProgressionBar into ClientProcessingSketch
  - Import and render AnimationProgressionBar inside ScalableViewport
  - Position below P5Sketch canvas with appropriate margin
  - Pass `capturing` prop to hide during recording
  - Apply viewport-aware scaling CSS
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ]* 5.1 Write property test for visibility control
  - **Property 6: Visibility during recording**
  - **Validates: Requirements 5.4**

- [ ]* 5.2 Write property test for viewport scaling
  - **Property 8: Viewport scaling**
  - **Validates: Requirements 5.5**

- [x] 6. Test integration with p5 animation system
  - Verify seeking updates `time.elapsed` correctly
  - Test with looping and non-looping animations
  - Verify existing controls (play/pause/save) still work
  - Test with various animation durations
  - _Requirements: 6.2, 6.3, 6.4_

- [ ]* 6.1 Write property test for progression synchronization
  - **Property 7: Progression synchronization**
  - **Validates: Requirements 6.2**

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
