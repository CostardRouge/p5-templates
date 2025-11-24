# Requirements Document

## Introduction

This feature enables per-slide configuration of capture settings (size, duration, framerate) in P5.js sketch templates. Currently, these settings are only configurable at the root level and apply uniformly to all slides. This enhancement allows individual slides to override root settings, providing flexibility for creating varied content within a single sketch.

## Glossary

- **Root Settings**: Global capture configuration defined at the sketch level that applies to all slides by default
- **Slide Settings**: Per-slide capture configuration that overrides root settings for specific slides
- **Capture Settings**: Configuration parameters including size (width/height), duration, and framerate
- **Template Options UI**: The React component interface where users configure sketch settings
- **P5 Sketch**: The JavaScript-based sketch that renders visual content using the p5.js library
- **Slide**: An individual segment or scene within a multi-slide sketch presentation

## Requirements

### Requirement 1

**User Story:** As a content creator, I want to configure different sizes for individual slides, so that I can create varied aspect ratios within a single sketch.

#### Acceptance Criteria

1. WHEN a user views slide settings in the Template Options UI THEN the system SHALL display size configuration fields (width and height) for each slide
2. WHEN a user sets a size value for a specific slide THEN the system SHALL store that value in the slide's settings object
3. WHEN a slide has no size setting defined THEN the system SHALL use the root-level size settings as the default
4. WHEN a slide has a size setting defined THEN the system SHALL apply that size instead of the root-level size during rendering
5. WHERE a slide specifies custom size settings, THE system SHALL validate that width and height are positive integers

### Requirement 2

**User Story:** As a content creator, I want to configure different durations for individual slides, so that I can control how long each slide displays independently.

#### Acceptance Criteria

1. WHEN a user views slide settings in the Template Options UI THEN the system SHALL display a duration configuration field for each slide
2. WHEN a user sets a duration value for a specific slide THEN the system SHALL store that value in the slide's settings object
3. WHEN a slide has no duration setting defined THEN the system SHALL use the root-level duration setting as the default
4. WHEN a slide has a duration setting defined THEN the system SHALL apply that duration instead of the root-level duration during rendering
5. WHERE a slide specifies custom duration, THE system SHALL validate that duration is a positive number

### Requirement 3

**User Story:** As a content creator, I want to configure different framerates for individual slides, so that I can optimize performance or achieve specific visual effects per slide.

#### Acceptance Criteria

1. WHEN a user views slide settings in the Template Options UI THEN the system SHALL display a framerate configuration field for each slide
2. WHEN a user sets a framerate value for a specific slide THEN the system SHALL store that value in the slide's settings object
3. WHEN a slide has no framerate setting defined THEN the system SHALL use the root-level framerate setting as the default
4. WHEN a slide has a framerate setting defined THEN the system SHALL apply that framerate instead of the root-level framerate during rendering
5. WHERE a slide specifies custom framerate, THE system SHALL validate that framerate is a positive number

### Requirement 4

**User Story:** As a content creator, I want the P5 sketch to automatically apply per-slide settings during rendering, so that I don't need to manually manage setting transitions between slides.

#### Acceptance Criteria

1. WHEN the P5 sketch transitions to a new slide THEN the system SHALL check if that slide has custom capture settings defined
2. WHEN a slide has custom size settings THEN the system SHALL apply those dimensions to the canvas
3. WHEN a slide has custom duration settings THEN the system SHALL use that duration for the slide's playback time
4. WHEN a slide has custom framerate settings THEN the system SHALL adjust the rendering framerate accordingly
5. WHEN the P5 sketch accesses slide settings THEN the system SHALL provide a merged settings object with slide-specific values overriding root values

### Requirement 5

**User Story:** As a developer, I want a clear data structure for per-slide settings, so that the system can efficiently merge and apply settings at runtime.

#### Acceptance Criteria

1. THE system SHALL define a slide settings schema that includes optional size, duration, and framerate fields
2. THE system SHALL maintain backward compatibility with sketches that only use root-level settings
3. WHEN merging settings THEN the system SHALL prioritize slide-specific values over root values
4. WHEN serializing options THEN the system SHALL include both root and per-slide settings in the output
5. THE system SHALL provide utility functions for accessing merged settings for any given slide index
