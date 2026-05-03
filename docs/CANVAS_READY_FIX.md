# Canvas Ready Event Fix

## Problem
When opening a sketch (`/templates/[engine]/[sketch]`), the canvas was sometimes not centered properly. The issue was a race condition where we were marking the sketch as "loaded" before the canvas was actually rendered and ready to be measured.

### Previous Flow (Problematic)
1. `EngineSketchRenderer` calls `instance.init()`
2. `init()` Promise resolves immediately after `sketch.start()` completes
3. `SET_LOADED` is dispatched right away
4. `ScalableViewport` sees `isReady=true`, waits 100ms, then calls `fitToViewport()`
5. **Problem**: For heavy sketches, the canvas might not be fully rendered yet, causing centering to fail

## Solution
Use the engine's internal lifecycle events to know when the first frame is actually rendered.

### New Flow (Fixed)
1. `EngineSketchRenderer` calls `instance.init()` and listens to the `ready` event
2. `P5Engine.init()` waits for the first `post-draw` event before emitting `ready`
3. `ready` event fires only after the canvas has completed its first draw cycle
4. `SET_LOADED` is dispatched in response to the `ready` event
5. `ScalableViewport` fits immediately (no timeout needed)

## Changes Made

### 1. P5Engine.ts
- Added a Promise that waits for the first `post-draw` event from p5.js
- The `ready` event is now emitted only after the first frame is fully rendered
- Uses p5.js's internal event system for perfect synchronization

```typescript
// Wait for the first draw cycle to complete before marking as ready.
await new Promise<void>(async (resolve) => {
  const { default: events } = await import("@/templates/p5/utils/events.js");
  
  const unregister = events.register("post-draw", () => {
    unregister(); // Only listen to the first draw
    resolve();
  });
});

this._isReady = true;
this.emit("ready", undefined as any);
```

### 2. EngineSketchRenderer.tsx
- Now listens to the engine's `ready` event instead of the `init()` Promise resolution
- Properly cleans up the event listener on unmount
- Separates engine initialization from ready state

```typescript
const handleReady = () => {
  dispatch({ type: "SET_LOADED", payload: true });
  containerRef.current?.setAttribute("data-engine-ready", engineId);
};

instance.on("ready", handleReady);

// Cleanup
instance.off("ready", handleReady);
```

### 3. ScalableViewport.tsx
- Removed the arbitrary 100ms timeout
- Fits immediately when `isReady` becomes true
- More responsive and reliable

```typescript
useEffect(() => {
  if (!isReady) return;
  
  // Fit immediately - no timeout needed since the engine
  // guarantees the canvas is fully rendered via its ready event.
  fitToViewport(false);
}, [resolutionKey, isReady, fitToViewport]);
```

## Benefits

✅ **No race conditions**: Canvas is guaranteed to be rendered before centering  
✅ **No arbitrary timeouts**: Event-driven, not time-based  
✅ **Engine-specific**: Uses p5.js's internal `post-draw` event for perfect timing  
✅ **Extensible**: Future engines can implement their own ready logic  
✅ **Proper cleanup**: Event listeners are properly removed on unmount  
✅ **More responsive**: Fits immediately when ready instead of waiting 100ms  

## Future Engines
When adding new engines (Three.js, GSAP, etc.), implement the `ready` event emission after the first frame is rendered. For engines without internal lifecycle hooks, use `requestAnimationFrame` as a fallback:

```typescript
await new Promise(resolve => {
  requestAnimationFrame(() => {
    requestAnimationFrame(resolve); // Double RAF for safety
  });
});

this._isReady = true;
this.emit("ready", undefined as any);
```
