# FormUndoRedo - Enhanced Undo/Redo System

A robust, feature-rich undo/redo system for React Hook Form with advanced capabilities including patches, batching, persistence, and debugging tools.

## Features

### Core Features
- ✅ **Undo/Redo** - Full history navigation with keyboard shortcuts
- ✅ **Auto-capture** - Debounced or immediate change tracking
- ✅ **Immer Patches** - Efficient memory usage with structural diffs
- ✅ **Type Safety** - Full TypeScript support with generics
- ✅ **Path Watching** - Track specific form fields only
- ✅ **Batch Operations** - Group related changes together
- ✅ **History Jumping** - Jump to any point in history
- ✅ **Persistence** - Optional localStorage support
- ✅ **Performance Metrics** - Monitor memory and operation timing
- ✅ **Debug Mode** - Detailed logging and visualization

### Improvements Over Previous Version
1. **Fixed critical bugs** in undo/redo state capture
2. **Memory efficient** - Uses Immer patches instead of full snapshots
3. **Better TypeScript** - Generics and strict typing
4. **Metadata tracking** - Timestamps, descriptions, affected paths
5. **Batch operations** - Group multiple changes
6. **History visualization** - Debug component for development
7. **Performance monitoring** - Track memory and timing
8. **Proper disabled states** - UI reflects actual state

## Installation

The component uses `immer` for efficient state management:

```bash
npm install immer
```

## Basic Usage

```tsx
import { FormProvider, useForm } from "react-hook-form";
import { FormUndoRedo } from "./components/FormUndoRedo";
import UndoRedo from "./components/UndoRedo";

function MyForm() {
  const methods = useForm();

  return (
    <FormProvider {...methods}>
      <FormUndoRedo
        maxHistory={50}
        hotkeys
        autoCapture="debounced"
        debounceMs={400}
        watchPaths={["content", "slides"]}
        captureInitial
      >
        <UndoRedo />
      </FormUndoRedo>

      {/* Your form fields */}
    </FormProvider>
  );
}
```

## Configuration Options

```typescript
type FormUndoRedoConfig = {
  maxHistory?: number;              // Max history entries (default: 50)
  hotkeys?: boolean;                // Enable Cmd/Ctrl+Z shortcuts (default: true)
  captureInitial?: boolean;         // Capture initial state (default: false)
  autoCapture?: "off" | "debounced" | "immediate"; // Auto-capture mode (default: "off")
  debounceMs?: number;              // Debounce delay in ms (default: 400)
  watchPaths?: string[];            // Specific paths to track (default: all)
  usePatches?: boolean;             // Use Immer patches (default: true)
  enablePersistence?: boolean;      // Save to localStorage (default: false)
  persistenceKey?: string;          // localStorage key (default: "form-undo-redo")
  debug?: boolean;                  // Enable debug logging (default: false)
};
```

## Hooks

### useFormUndoRedo

Main hook for undo/redo operations:

```tsx
import { useFormUndoRedo } from "./components/FormUndoRedo";

function MyComponent() {
  const {
    undo,
    redo,
    clear,
    canUndo,
    canRedo,
    capture,
    pause,
    resume,
  } = useFormUndoRedo();

  return (
    <div>
      <button onClick={undo} disabled={!canUndo}>Undo</button>
      <button onClick={redo} disabled={!canRedo}>Redo</button>
      <button onClick={() => capture("Manual save")}>Save Point</button>
    </div>
  );
}
```

### useFormUndoRedoBatch

Hook for batch operations:

```tsx
import { useFormUndoRedoBatch } from "./components/FormUndoRedo";

function MyComponent() {
  const { withBatch, withBatchAsync } = useFormUndoRedoBatch();
  const { setValue } = useFormContext();

  const updateMultipleFields = () => {
    withBatch(() => {
      setValue("field1", "value1");
      setValue("field2", "value2");
      setValue("field3", "value3");
    }, "Update multiple fields");
  };

  const asyncUpdate = async () => {
    await withBatchAsync(async () => {
      const data = await fetchData();
      setValue("field1", data.value1);
      setValue("field2", data.value2);
    }, "Async batch update");
  };

  return (
    <button onClick={updateMultipleFields}>
      Update All
    </button>
  );
}
```

### useFormUndoRedoHistory

Hook for accessing history:

```tsx
import { useFormUndoRedoHistory } from "./components/FormUndoRedo";

function HistoryPanel() {
  const { history, getHistoryItems, jumpTo } = useFormUndoRedoHistory();
  const { past, future } = getHistoryItems();

  return (
    <div>
      <h3>Past ({past.length})</h3>
      {past.map((item) => (
        <button
          key={item.index}
          onClick={() => jumpTo(item.index, "past")}
        >
          {item.description} - {item.formattedTime}
        </button>
      ))}
    </div>
  );
}
```

### useFormUndoRedoMetrics

Hook for performance monitoring:

```tsx
import { useFormUndoRedoMetrics } from "./components/FormUndoRedo";

function MetricsPanel() {
  const {
    historySize,
    formattedMemory,
    lastOperationTime,
    totalOperations,
  } = useFormUndoRedoMetrics();

  return (
    <div>
      <div>History Size: {historySize}</div>
      <div>Memory: {formattedMemory}</div>
      <div>Last Op: {lastOperationTime.toFixed(2)}ms</div>
      <div>Total Ops: {totalOperations}</div>
    </div>
  );
}
```

## Components

### HistoryVisualizer

Debug component for visualizing history:

```tsx
import { HistoryVisualizer } from "./components/FormUndoRedo";

function DebugPanel() {
  return (
    <HistoryVisualizer
      maxItems={10}
      showMetrics={true}
    />
  );
}
```

## Advanced Usage

### Manual Capture

```tsx
const { capture } = useFormUndoRedo();

// Capture current state with description
capture("Before complex operation");
```

### Silent Operations

```tsx
const { runSilently } = useFormUndoRedo();
const { setValue } = useFormContext();

// Update without creating history entry
runSilently(() => {
  setValue("field", "value");
});
```

### Pause/Resume

```tsx
const { pause, resume } = useFormUndoRedo();
const { setValue } = useFormContext();

pause();
setValue("field1", "value1");
setValue("field2", "value2");
resume();
```

### Jump to Specific Point

```tsx
const { jumpTo, getHistory } = useFormUndoRedo();

// Jump to 3rd item in past
jumpTo(2, "past");

// Jump to 1st item in future
jumpTo(0, "future");
```

## Keyboard Shortcuts

- **Cmd/Ctrl + Z** - Undo
- **Cmd/Ctrl + Shift + Z** - Redo
- **Cmd/Ctrl + Y** - Redo (alternative)

Shortcuts are disabled when focus is in text inputs, textareas, or contentEditable elements.

## Performance

### Memory Optimization

The system uses Immer patches to store only the differences between states, significantly reducing memory usage for large forms:

- **Without patches**: Stores full state snapshots (~100KB per entry)
- **With patches**: Stores only changes (~5-10KB per entry)

### Debouncing

Auto-capture with debouncing prevents excessive history entries during rapid typing:

```tsx
<FormUndoRedo
  autoCapture="debounced"
  debounceMs={400}  // Wait 400ms after last change
/>
```

### Path Watching

Track only specific form paths to reduce overhead:

```tsx
<FormUndoRedo
  watchPaths={["content", "slides", "animation"]}
/>
```

## Debugging

Enable debug mode to see detailed logs:

```tsx
<FormUndoRedo debug={true} />
```

Or toggle at runtime:

```tsx
const { enableDebug } = useFormUndoRedo();
enableDebug(true);
```

## Migration from Old Version

The new API is mostly backward compatible. Key changes:

1. **Disabled states now work** - Remove commented `disabled` props
2. **New hooks available** - Use specialized hooks for advanced features
3. **Better TypeScript** - Add type parameters if needed
4. **Immer patches enabled by default** - Set `usePatches={false}` to disable

### Before

```tsx
<FormUndoRedo maxHistory={50} hotkeys autoCapture="debounced">
  <button onClick={undo} /* disabled={!canUndo} */>
    Undo
  </button>
</FormUndoRedo>
```

### After

```tsx
<FormUndoRedo maxHistory={50} hotkeys autoCapture="debounced">
  <button onClick={undo} disabled={!canUndo}>
    Undo
  </button>
</FormUndoRedo>
```

## Troubleshooting

### History not capturing

- Check if `autoCapture` is enabled
- Verify `watchPaths` includes the fields you're editing
- Ensure form is not paused

### Memory issues

- Reduce `maxHistory` limit
- Enable `usePatches` for efficient storage
- Clear history periodically with `clear()`

### TypeScript errors

- Add type parameter: `useFormUndoRedo<MyFormType>()`
- Ensure form values are serializable (no functions, symbols)

## License

Same as parent project.
