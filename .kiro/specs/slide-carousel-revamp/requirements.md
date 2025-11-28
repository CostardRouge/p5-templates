# Requirements Document

## Introduction

This document specifies requirements for revamping the slide carousel interface in the sketch template system. The current implementation displays slides as simple text rows with basic controls. The revamped system will provide a visual, thumbnail-based interface that displays slides as miniature canvases in a grid layout, with drag-and-drop reordering, individual slide naming, and performance optimizations for mobile devices. The system will leverage existing S3-stored thumbnails for recorded sketches and generate in-memory thumbnails for unsaved work.

## Glossary

- **Slide Carousel**: The UI component that displays all slides in a sketch as a navigable collection
- **Slide Thumbnail**: A visual preview of a slide's canvas content, displayed at the same aspect ratio as the full canvas
- **Active Slide**: The currently selected and loaded slide that is being edited or viewed
- **Inactive Slide**: A slide that is not currently active; only its thumbnail is displayed to conserve memory
- **S3 Thumbnail**: A thumbnail image stored in AWS S3, generated during the recording process
- **In-Memory Thumbnail**: A temporary thumbnail stored in browser memory for unsaved slides
- **Placeholder Thumbnail**: A temporary visual indicator (slide name centered) shown before a thumbnail is generated
- **Canvas Viewport**: The main viewing area where the active slide's full canvas is rendered
- **Template Options Panel**: The right-side panel containing sketch configuration controls
- **Recording**: The process of capturing and encoding slide animations to video

## Requirements

### Requirement 1

**User Story:** As a sketch creator, I want to see visual thumbnails of my slides in a grid layout, so that I can quickly identify and navigate between different slides visually.

#### Acceptance Criteria

1. WHEN the slide carousel is displayed THEN the system SHALL render slides as thumbnail previews in a grid layout
2. WHEN a slide thumbnail is rendered THEN the system SHALL maintain the same aspect ratio as the canvas size configuration
3. WHEN multiple slides exist THEN the system SHALL display all slide thumbnails in a responsive grid that adapts to available space
4. WHEN a slide has a saved recording THEN the system SHALL display the S3-stored thumbnail for that slide
5. WHEN a slide does not have a saved thumbnail THEN the system SHALL display a placeholder with the slide name centered

### Requirement 2

**User Story:** As a sketch creator, I want to name individual slides, so that I can organize and identify slides by meaningful labels rather than just numbers.

#### Acceptance Criteria

1. WHEN a slide is created THEN the system SHALL assign a default name following the pattern "Slide N" where N is the slide number
2. WHEN a user edits a slide name THEN the system SHALL update the slide's name property in the options schema
3. WHEN a slide name is displayed THEN the system SHALL show the custom name if set, otherwise the default name
4. WHEN a slide is duplicated THEN the system SHALL append " (copy)" to the duplicated slide's name
5. WHEN a slide name is empty or whitespace-only THEN the system SHALL display the default "Slide N" name

### Requirement 3

**User Story:** As a sketch creator, I want to click on a slide thumbnail to make it active, so that I can quickly switch between slides for editing.

#### Acceptance Criteria

1. WHEN a user clicks on an inactive slide thumbnail THEN the system SHALL set that slide as the active slide
2. WHEN a slide becomes active THEN the system SHALL load and render the full canvas for that slide
3. WHEN a slide becomes active THEN the system SHALL call window.setSlide() with the slide index
4. WHEN a slide becomes inactive THEN the system SHALL unload the full canvas to conserve memory
5. WHEN the active slide changes THEN the system SHALL visually highlight the active slide thumbnail with distinct styling

### Requirement 4

**User Story:** As a sketch creator, I want to drag and drop slide thumbnails to reorder them, so that I can organize my presentation sequence intuitively.

#### Acceptance Criteria

1. WHEN a user initiates a drag on a slide thumbnail THEN the system SHALL enable drag-and-drop reordering
2. WHEN a slide is dragged over another slide position THEN the system SHALL provide visual feedback of the potential new position
3. WHEN a slide is dropped in a new position THEN the system SHALL reorder the slides array and update the active index accordingly
4. WHEN slides are reordered THEN the system SHALL maintain the active slide selection on the moved slide
5. WHEN drag-and-drop is active THEN the system SHALL restrict dragging to the carousel container boundaries

### Requirement 5

**User Story:** As a sketch creator, I want the system to display slide thumbnails in the main viewport alongside the active slide, so that I can see my presentation structure while editing.

#### Acceptance Criteria

1. WHEN the viewport is rendered THEN the system SHALL display the active slide canvas at full size
2. WHEN the viewport is rendered THEN the system SHALL display other slide thumbnails as page indicators
3. WHEN slide thumbnails are displayed in the viewport THEN the system SHALL render them at the same aspect ratio as the canvas
4. WHEN a user clicks a thumbnail in the viewport THEN the system SHALL make that slide active
5. WHEN the viewport layout is rendered THEN the system SHALL position thumbnails to not obscure the active canvas content

### Requirement 6

**User Story:** As a sketch creator, I want only the active slide to be fully loaded, so that the application performs well even with many slides on mobile devices.

#### Acceptance Criteria

1. WHEN a slide is not active THEN the system SHALL NOT load the full canvas or sketch logic for that slide
2. WHEN a slide is not active THEN the system SHALL display only the thumbnail image
3. WHEN the active slide changes THEN the system SHALL unload the previous slide's canvas and load the new slide's canvas
4. WHEN memory usage is measured THEN the system SHALL use significantly less memory than loading all slides simultaneously
5. WHEN the application runs on mobile devices THEN the system SHALL maintain responsive performance with 10+ slides

### Requirement 7

**User Story:** As a sketch creator, I want thumbnails to be automatically generated and stored during recording, so that I can see visual previews of my saved work.

#### Acceptance Criteria

1. WHEN a sketch recording completes THEN the system SHALL upload slide thumbnails to S3 storage
2. WHEN a slide thumbnail is stored in S3 THEN the system SHALL include the thumbnail URL in the job metadata
3. WHEN loading a saved recording THEN the system SHALL retrieve and display S3-stored thumbnails
4. WHEN a recording has multiple slides THEN the system SHALL store one thumbnail per slide in S3
5. WHEN thumbnail generation fails THEN the system SHALL continue the recording process and use placeholder thumbnails

### Requirement 8

**User Story:** As a sketch creator, I want thumbnails to be generated in memory for unsaved slides, so that I can see visual previews before recording.

#### Acceptance Criteria

1. WHEN a user clicks on an unsaved slide THEN the system SHALL capture a canvas thumbnail and store it in memory
2. WHEN an in-memory thumbnail is generated THEN the system SHALL use canvas.toDataURL() or equivalent to create the image
3. WHEN a slide is modified THEN the system SHALL invalidate the cached thumbnail for that slide
4. WHEN a slide thumbnail is requested and not cached THEN the system SHALL display the placeholder until generation completes
5. WHEN the browser memory is constrained THEN the system SHALL limit the number of cached in-memory thumbnails

### Requirement 9

**User Story:** As a sketch creator, I want the slide carousel to work smoothly on mobile devices, so that I can create and manage presentations on any device.

#### Acceptance Criteria

1. WHEN the carousel is displayed on mobile THEN the system SHALL use touch-optimized drag-and-drop interactions
2. WHEN thumbnails are rendered on mobile THEN the system SHALL scale appropriately for smaller screens
3. WHEN the grid layout is rendered on mobile THEN the system SHALL adjust column count based on available width
4. WHEN touch gestures are used THEN the system SHALL provide appropriate activation delays to distinguish taps from drags
5. WHEN the carousel is scrolled on mobile THEN the system SHALL use native scrolling performance optimizations

### Requirement 10

**User Story:** As a sketch creator, I want placeholder thumbnails to display the slide name, so that I can identify slides even before thumbnails are generated.

#### Acceptance Criteria

1. WHEN a placeholder thumbnail is displayed THEN the system SHALL render the slide name centered in the thumbnail area
2. WHEN a placeholder thumbnail is displayed THEN the system SHALL use the same aspect ratio as the canvas
3. WHEN a placeholder thumbnail is displayed THEN the system SHALL use styling that clearly indicates it is a placeholder
4. WHEN a thumbnail is generated THEN the system SHALL replace the placeholder with the actual thumbnail image
5. WHEN a slide has no custom name THEN the placeholder SHALL display the default "Slide N" label

### Requirement 11

**User Story:** As a system administrator, I want a feature flag to control viewport thumbnail display, so that I can progressively roll out this feature and disable it on specific devices or contexts.

#### Acceptance Criteria

1. WHEN the viewport thumbnail feature flag is disabled THEN the system SHALL NOT display slide thumbnails in the main viewport
2. WHEN the viewport thumbnail feature flag is enabled THEN the system SHALL display slide thumbnails in the main viewport as page indicators
3. WHEN the feature flag is evaluated THEN the system SHALL check environment variables or configuration settings
4. WHEN the feature flag is disabled THEN the system SHALL still display thumbnails in the slide carousel panel
5. WHEN the feature flag changes THEN the system SHALL apply the new setting without requiring a full page reload
