# FormUndoRedo Examples

## Example 1: Basic Setup

```tsx
import { FormProvider, useForm } from "react-hook-form";
import { FormUndoRedo } from "./components/FormUndoRedo";
import UndoRedo from "./components/UndoRedo";

function BasicForm() {
  const methods = useForm({
    defaultValues: {
      title: "",
      description: "",
    },
  });

  return (
    <FormProvider {...methods}>
      <FormUndoRedo
        maxHistory={50}
        hotkeys
        autoCapture="debounced"
        captureInitial
      >
        <UndoRedo />
      </FormUndoRedo>

      <input {...methods.register("title")} />
      <textarea {...methods.register("description")} />
    </FormProvider>
  );
}
```

## Example 2: With History Visualizer (Debug)

```tsx
import { FormUndoRedo, HistoryVisualizer } from "./components/FormUndoRedo";

function FormWithDebug() {
  const methods = useForm();

  return (
    <FormProvider {...methods}>
      <div className="flex gap-4">
        <div className="flex-1">
          <FormUndoRedo
            maxHistory={50}
            hotkeys
            autoCapture="debounced"
            debug={true}
          >
            <UndoRedo />
          </FormUndoRedo>

          {/* Your form */}
        </div>

        {/* Debug panel */}
        <div className="w-64">
          <HistoryVisualizer maxItems={10} showMetrics />
        </div>
      </div>
    </FormProvider>
  );
}
```

## Example 3: Batch Operations

```tsx
import { useFormUndoRedoBatch } from "./components/FormUndoRedo";

function SlideEditor() {
  const { withBatch } = useFormUndoRedoBatch();
  const { setValue } = useFormContext();

  const duplicateSlide = (slideIndex: number) => {
    withBatch(() => {
      const slides = getValues("slides");
      const newSlide = { ...slides[slideIndex] };
      setValue(`slides.${slides.length}`, newSlide);
      setValue("activeSlideIndex", slides.length);
    }, "Duplicate slide");
  };

  const resetAllSlides = () => {
    withBatch(() => {
      const slides = getValues("slides");
      slides.forEach((_, index) => {
        setValue(`slides.${index}.content`, "");
        setValue(`slides.${index}.style`, {});
      });
    }, "Reset all slides");
  };

  return (
    <div>
      <button onClick={() => duplicateSlide(0)}>
        Duplicate Slide
      </button>
      <button onClick={resetAllSlides}>
        Reset All
      </button>
    </div>
  );
}
```

## Example 4: Manual Capture Points

```tsx
import { useFormUndoRedo } from "./components/FormUndoRedo";

function ComplexEditor() {
  const { capture, runSilently } = useFormUndoRedo();
  const { setValue, getValues } = useFormContext();

  const applyTemplate = (template: Template) => {
    // Capture before applying template
    capture("Before template application");

    // Apply template changes
    setValue("content", template.content);
    setValue("style", template.style);
    setValue("animation", template.animation);

    // Capture after
    capture("After template application");
  };

  const autoSave = () => {
    // Silent save without creating history
    runSilently(() => {
      const data = getValues();
      localStorage.setItem("autosave", JSON.stringify(data));
    });
  };

  return (
    <div>
      <button onClick={() => applyTemplate(myTemplate)}>
        Apply Template
      </button>
      <button onClick={autoSave}>
        Auto Save
      </button>
    </div>
  );
}
```

## Example 5: Custom History UI

```tsx
import { useFormUndoRedoHistory } from "./components/FormUndoRedo";

function CustomHistoryPanel() {
  const { getHistoryItems, jumpTo, clear, canUndo, canRedo } = 
    useFormUndoRedoHistory();
  const { past, future } = getHistoryItems();

  return (
    <div className="history-panel">
      <div className="header">
        <h3>History</h3>
        <button onClick={clear}>Clear All</button>
      </div>

      <div className="timeline">
        {/* Future states */}
        {future.map((item) => (
          <div
            key={`future-${item.index}`}
            className="history-item future"
            onClick={() => jumpTo(item.index, "future")}
          >
            <div className="time">{item.formattedTime}</div>
            <div className="description">{item.description}</div>
            <div className="paths">
              {item.affectedPaths.join(", ")}
            </div>
          </div>
        ))}

        {/* Current state indicator */}
        <div className="current-state">
          <span>Current State</span>
        </div>

        {/* Past states */}
        {past.map((item) => (
          <div
            key={`past-${item.index}`}
            className="history-item past"
            onClick={() => jumpTo(item.index, "past")}
          >
            <div className="time">{item.formattedTime}</div>
            <div className="description">{item.description}</div>
            <div className="paths">
              {item.affectedPaths.join(", ")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Example 6: Performance Monitoring

```tsx
import { useFormUndoRedoMetrics } from "./components/FormUndoRedo";

function PerformanceMonitor() {
  const metrics = useFormUndoRedoMetrics();

  return (
    <div className="metrics-panel">
      <h4>Performance Metrics</h4>
      
      <div className="metric">
        <label>History Size:</label>
        <span>{metrics.historySize} entries</span>
      </div>

      <div className="metric">
        <label>Memory Usage:</label>
        <span>{metrics.formattedMemory}</span>
        {metrics.memoryEstimate > 1000000 && (
          <span className="warning">High memory usage!</span>
        )}
      </div>

      <div className="metric">
        <label>Last Operation:</label>
        <span>{metrics.lastOperationTime.toFixed(2)}ms</span>
      </div>

      <div className="metric">
        <label>Total Operations:</label>
        <span>{metrics.totalOperations}</span>
      </div>

      <div className="metric">
        <label>Avg Operation Time:</label>
        <span>{metrics.averageOperationTime}ms</span>
      </div>
    </div>
  );
}
```

## Example 7: Conditional Tracking

```tsx
function ConditionalTracking() {
  const methods = useForm();
  const [trackingEnabled, setTrackingEnabled] = useState(true);

  return (
    <FormProvider {...methods}>
      <FormUndoRedo
        maxHistory={50}
        hotkeys
        autoCapture={trackingEnabled ? "debounced" : "off"}
        watchPaths={["content", "slides"]} // Only track these paths
      >
        <div>
          <label>
            <input
              type="checkbox"
              checked={trackingEnabled}
              onChange={(e) => setTrackingEnabled(e.target.checked)}
            />
            Enable History Tracking
          </label>
          <UndoRedo />
        </div>
      </FormUndoRedo>

      {/* Form fields */}
    </FormProvider>
  );
}
```

## Example 8: Persistence

```tsx
function PersistentForm() {
  const methods = useForm();

  return (
    <FormProvider {...methods}>
      <FormUndoRedo
        maxHistory={50}
        hotkeys
        autoCapture="debounced"
        enablePersistence={true}
        persistenceKey="my-form-history"
      >
        <UndoRedo />
      </FormUndoRedo>

      {/* Form will restore last 10 history entries on reload */}
    </FormProvider>
  );
}
```

## Example 9: Async Batch Operations

```tsx
import { useFormUndoRedoBatch } from "./components/FormUndoRedo";

function AsyncOperations() {
  const { withBatchAsync } = useFormUndoRedoBatch();
  const { setValue } = useFormContext();

  const loadFromAPI = async () => {
    await withBatchAsync(async () => {
      const data = await fetch("/api/template").then(r => r.json());
      
      setValue("title", data.title);
      setValue("content", data.content);
      setValue("slides", data.slides);
      setValue("animation", data.animation);
    }, "Load from API");
  };

  const bulkUpdate = async () => {
    await withBatchAsync(async () => {
      const updates = await fetch("/api/updates").then(r => r.json());
      
      for (const update of updates) {
        setValue(update.path, update.value);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }, "Bulk update");
  };

  return (
    <div>
      <button onClick={loadFromAPI}>Load Template</button>
      <button onClick={bulkUpdate}>Apply Updates</button>
    </div>
  );
}
```

## Example 10: Integration with Existing Template System

```tsx
// Your current setup in SketchOptions.tsx
function SketchOptions() {
  const methods = useForm();

  return (
    <FormProvider {...methods}>
      <FormUndoRedo
        maxHistory={50}
        hotkeys
        autoCapture="debounced"
        debounceMs={400}
        watchPaths={[
          "content",
          "sketch",
          "slides",
          "animation"
        ]}
        captureInitial
        usePatches={true}
        debug={process.env.NODE_ENV === "development"}
      >
        <UndoRedo />
      </FormUndoRedo>

      <RootSettings />
      <ContentItems />
      <SketchSettings />
      {/* ... rest of your components */}
    </FormProvider>
  );
}
```
