# Design Document

## Overview

The Animation Progression Bar is an interactive UI component that visualizes and controls the animation timeline for p5.js sketches. It displays the current position in the animation loop (0-1 progression) and allows users to seek to any point by clicking or dragging. The component will be positioned below the canvas, styled to match the application's minimal design language, and integrate seamlessly with the existing p5 animation utilities.

## Architecture

### Component Hierarchy

```
ClientProcessingSketch
├── ScalableViewport
│   ├── P5Sketch
│   └── AnimationProgressionBar (NEW)
├── P5Controls
└── TemplateOptions
```

The `AnimationProgressionBar` component will be placed inside the `ScalableViewport` component, positioned below the canvas. This ensures it scales appropriately with the viewport and remains visually connected to the sketch.

### Data Flow

1. **Read Progression**: Component polls `window.animation?.progression` or reads from a shared state
2. **User Interaction**: Click/drag events calculate target progression (0-1)
3. **Update Animation**: Component calls `window.setAnimationProgression(value)` to seek
4. **Visual Update**: Component re-renders to reflect new progression

## Components and Interfaces

### AnimationProgressionBar Component

**Location**: `src/components/AnimationProgressionBar.tsx`

**Props Interface**:
```typescript
interface AnimationProgressionBarProps {
  className?: string;
  disabled?: boolean; // Hide when recording
}
```

**State**:
```typescript
{
  progression: number;        // Current progression (0-1)
  isDragging: boolean;        // User is scrubbing
  hoverPosition: number | null; // Mouse hover position (0-1)
  wasLooping: boolean;        // Store loop state before scrubbing
}
```

**Key Methods**:
- `handleClick(event)`: Calculate and seek to click position
- `handleDragStart(event)`: Enter scrubbing mode, pause animation
- `handleDragMove(event)`: Update progression during drag
- `handleDragEnd(event)`: Exit scrubbing mode, restore loop state
- `handleHover(event)`: Update hover preview position
- `calculateProgressionFromEvent(event)`: Convert mouse position to progression value

### Integration with P5 Utilities

**Global Functions** (to be added to `src/p5-sketches/utils/time.js`):

```javascript
// Set animation to specific progression (0-1)
window.setAnimationProgression = function(progression) {
  const duration = sketch?.sketchOptions?.animation?.duration || 10;
  time.elapsed = progression * duration * 1000; // Convert to milliseconds
};

// Get current progression (0-1)
window.getAnimationProgression = function() {
  return animation.progression;
};
```

## Data Models

### Progression Value
- **Type**: `number`
- **Range**: 0.0 to 1.0
- **Description**: Normalized position in animation loop where 0 is start and 1 is end

### Interaction State
```typescript
type InteractionState = 'idle' | 'hovering' | 'scrubbing';
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Progression display accuracy
*For any* animation state, the displayed progression percentage should equal `Math.floor(animation.progression * 100)`
**Validates: Requirements 1.1, 1.5**

### Property 2: Click position to progression mapping
*For any* click position within the bar bounds, the calculated progression should be between 0 and 1 inclusive, and proportional to the click position relative to bar width
**Validates: Requirements 2.1, 2.4, 2.5**

### Property 3: Scrubbing maintains bounds
*For any* drag position during scrubbing, the progression value should remain clamped between 0 and 1
**Validates: Requirements 3.2**

### Property 4: Scrubbing state restoration
*For any* scrubbing session, when dragging ends, the animation loop state should be restored to its pre-scrubbing state
**Validates: Requirements 3.3, 3.5**

### Property 5: Theme consistency
*For any* theme (light or dark), all color values used by the progression bar should be derived from CSS custom properties
**Validates: Requirements 4.1, 4.2**

### Property 6: Visibility during recording
*For any* recording state, when `capturing` is true, the progression bar should not be rendered
**Validates: Requirements 5.4**

### Property 7: Progression synchronization
*For any* time value, reading `window.getAnimationProgression()` immediately after calling `window.setAnimationProgression(value)` should return a value equal to the input value (within floating-point precision)
**Validates: Requirements 6.2**

## Error Handling

### Missing Animation Utilities
- **Scenario**: `window.animation` or `animation.progression` is undefined
- **Handling**: Display bar in disabled state, show 0% progression, log warning to console

### Invalid Progression Values
- **Scenario**: Calculated progression is NaN, Infinity, or outside 0-1 range
- **Handling**: Clamp to valid range [0, 1], log warning for debugging

### Sketch Not Loaded
- **Scenario**: Component renders before p5 sketch initializes
- **Handling**: Hide component until `sketchLoaded` is true

### Recording Mode
- **Scenario**: User attempts to interact while recording
- **Handling**: Component is hidden when `capturing` prop is true

## Testing Strategy

### Unit Tests

**Test File**: `src/components/__tests__/AnimationProgressionBar.test.tsx`

Key test cases:
1. **Rendering**: Component renders with correct initial state
2. **Progression Display**: Shows correct percentage for various progression values
3. **Click Handling**: Calculates correct progression from click events
4. **Drag Handling**: Enters/exits scrubbing mode correctly
5. **Theme Support**: Applies correct CSS classes for light/dark themes
6. **Disabled State**: Hides when `disabled` prop is true
7. **Edge Cases**: Handles 0, 1, and mid-range progressions correctly

### Property-Based Tests

**Test File**: `src/components/__tests__/AnimationProgressionBar.property.test.tsx`

**Framework**: fast-check (JavaScript property-based testing library)

**Configuration**: Minimum 100 iterations per property test

Property tests will generate random:
- Progression values (0-1)
- Click positions (pixels within bar bounds)
- Drag sequences (start, move, end events)
- Theme states (light/dark)

Each test will verify the corresponding correctness property holds across all generated inputs.

### Integration Tests

**Test File**: `src/components/__tests__/AnimationProgressionBar.integration.test.tsx`

Key integration scenarios:
1. **P5 Integration**: Verify seeking updates `time.elapsed` correctly
2. **Loop State**: Verify pause/resume during scrubbing
3. **Multiple Interactions**: Rapid clicks and drags work correctly
4. **Viewport Scaling**: Bar scales with ScalableViewport

## Visual Design Specification

### Layout
- **Position**: Below canvas, inside ScalableViewport
- **Width**: 80% of canvas width, max 600px
- **Height**: 32px (touch-friendly)
- **Margin**: 16px top margin from canvas

### Color Scheme

**Light Theme**:
- Background track: `hsl(var(--border))` (gray)
- Filled track: `linear-gradient(to right, #3b82f6, #2563eb)` (blue gradient)
- Hover indicator: `hsl(var(--foreground) / 0.1)` (subtle overlay)
- Text: `hsl(var(--foreground) / 0.7)` (dimmed)

**Dark Theme**:
- Background track: `hsl(var(--border))` (dark gray)
- Filled track: `linear-gradient(to right, #60a5fa, #3b82f6)` (lighter blue gradient)
- Hover indicator: `hsl(var(--foreground) / 0.15)` (subtle overlay)
- Text: `hsl(var(--foreground) / 0.7)` (dimmed)

### Interactive States

**Idle**:
- Cursor: `pointer`
- Track opacity: 100%

**Hover**:
- Show vertical indicator line at hover position
- Display tooltip with target percentage
- Slight scale on hover: `transform: scaleY(1.1)`

**Scrubbing**:
- Cursor: `grabbing`
- Filled track has pulse animation
- Percentage updates in real-time

**Disabled**:
- Opacity: 40%
- Cursor: `not-allowed`
- No interactions

### Typography
- Font: System font stack (inherited)
- Size: 11px
- Weight: 500 (medium)
- Percentage display: Monospace font for alignment

### Animations
- Progression fill: `transition: width 0.1s ease-out`
- Hover scale: `transition: transform 0.15s ease-out`
- Tooltip fade: `transition: opacity 0.2s ease-in-out`

### Accessibility
- ARIA label: "Animation progression bar"
- ARIA role: "slider"
- ARIA valuemin: 0
- ARIA valuemax: 100
- ARIA valuenow: Current percentage
- Keyboard support: Arrow keys to seek (±1%), Home/End for 0%/100%

## Implementation Notes

### Performance Considerations
- Use `requestAnimationFrame` for smooth progression updates during playback
- Throttle drag events to avoid excessive re-renders (16ms / 60fps)
- Memoize progression calculations to avoid redundant math

### Browser Compatibility
- Use pointer events for unified mouse/touch handling
- Fallback to mouse events if pointer events unavailable
- Test on mobile devices for touch accuracy

### Integration Points
1. **ClientProcessingSketch**: Pass `capturing` prop to hide during recording
2. **ScalableViewport**: Position bar using viewport-aware CSS
3. **P5 Utilities**: Add global functions to time.js for seeking
4. **Theme System**: Use existing CSS custom properties

### Future Enhancements (Out of Scope)
- Keyframe markers on timeline
- Playback speed control
- Loop region selection
- Timeline zoom for precise seeking
