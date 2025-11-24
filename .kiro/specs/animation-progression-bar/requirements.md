# Requirements Document

## Introduction

This feature adds an interactive animation progression bar to the sketch page that displays and controls the animation timeline. The bar will show the current position in the animation loop (0-1 progression from `animation.progression`) and allow users to seek to any point in the animation by clicking or dragging on the bar.

## Glossary

- **Animation Progression**: A normalized value (0-1) representing the current position in the animation loop, provided by `animation.progression` from p5 utils
- **Sketch Page**: The page displaying a p5.js sketch with controls and options
- **P5 Canvas**: The HTML canvas element where the p5.js sketch renders
- **Seek**: The action of jumping to a specific point in the animation timeline
- **Progression Bar**: An interactive UI component that visualizes and controls animation progression
- **Animation Loop**: The cyclical playback of an animation from start (0) to end (1)

## Requirements

### Requirement 1

**User Story:** As a user, I want to see the current animation progression visually, so that I understand where I am in the animation loop.

#### Acceptance Criteria

1. WHEN the sketch is playing THEN the Progression Bar SHALL display a visual indicator showing the current progression value from 0 to 1
2. WHEN the animation progresses THEN the Progression Bar SHALL update smoothly in real-time to reflect the current position
3. WHEN the progression reaches 1.0 THEN the Progression Bar SHALL wrap back to 0 for continuous loop playback
4. WHEN the sketch is paused THEN the Progression Bar SHALL display the frozen progression value
5. THE Progression Bar SHALL display the progression value as a percentage (0-100%)

### Requirement 2

**User Story:** As a user, I want to click on the progression bar to seek to a specific time, so that I can quickly navigate to any point in the animation.

#### Acceptance Criteria

1. WHEN a user clicks on the Progression Bar THEN the System SHALL calculate the target progression based on click position
2. WHEN a user clicks on the Progression Bar THEN the System SHALL update the animation to the target progression immediately
3. WHEN seeking occurs THEN the System SHALL maintain the current play/pause state
4. WHEN a user clicks at the start of the bar THEN the System SHALL set progression to 0
5. WHEN a user clicks at the end of the bar THEN the System SHALL set progression to 1.0

### Requirement 3

**User Story:** As a user, I want to drag along the progression bar to scrub through the animation, so that I can preview different moments smoothly.

#### Acceptance Criteria

1. WHEN a user initiates a drag on the Progression Bar THEN the System SHALL enter scrubbing mode
2. WHILE scrubbing THEN the System SHALL update progression continuously based on pointer position
3. WHEN the user releases the drag THEN the System SHALL exit scrubbing mode and resume normal playback
4. WHILE scrubbing THEN the System SHALL pause the animation loop
5. WHEN scrubbing ends THEN the System SHALL restore the previous play/pause state

### Requirement 4

**User Story:** As a user, I want the progression bar to match the visual style of the application, so that it feels integrated and professional.

#### Acceptance Criteria

1. THE Progression Bar SHALL use the application theme colors defined in CSS variables
2. THE Progression Bar SHALL support both light and dark themes
3. THE Progression Bar SHALL use a blue gradient for the filled portion matching existing progress bars
4. THE Progression Bar SHALL have smooth transitions and animations
5. THE Progression Bar SHALL include hover states that provide visual feedback

### Requirement 5

**User Story:** As a user, I want the progression bar positioned logically on the sketch page, so that it's accessible without obscuring the canvas.

#### Acceptance Criteria

1. THE Progression Bar SHALL be positioned below the P5 Canvas
2. THE Progression Bar SHALL be horizontally centered relative to the canvas
3. THE Progression Bar SHALL remain visible when the sketch is playing or paused
4. THE Progression Bar SHALL hide when recording is active
5. THE Progression Bar SHALL scale appropriately with the viewport

### Requirement 6

**User Story:** As a developer, I want the progression bar to integrate with existing p5 sketch utilities, so that it works seamlessly with the animation system.

#### Acceptance Criteria

1. THE Progression Bar SHALL read progression values from `animation.progression` utility
2. WHEN seeking THEN the System SHALL update the sketch time to match the target progression
3. THE Progression Bar SHALL work with all sketch animation modes (loop, no-loop)
4. THE Progression Bar SHALL not interfere with existing sketch controls
5. THE Progression Bar SHALL handle edge cases where animation duration is undefined

### Requirement 7

**User Story:** As a user, I want visual feedback when interacting with the progression bar, so that I understand my actions are being registered.

#### Acceptance Criteria

1. WHEN hovering over the Progression Bar THEN the System SHALL display a preview indicator at the hover position
2. WHEN hovering THEN the System SHALL show the target progression percentage
3. WHEN clicking or dragging THEN the System SHALL provide immediate visual feedback
4. THE Progression Bar SHALL use cursor changes to indicate interactivity
5. WHEN the bar is disabled THEN the System SHALL display a disabled state with reduced opacity
