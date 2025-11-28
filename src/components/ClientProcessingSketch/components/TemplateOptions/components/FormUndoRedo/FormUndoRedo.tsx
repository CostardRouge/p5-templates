"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import { nanoid } from "nanoid";

import FormUndoRedoContext from "./contexts/FormUndoRedoContext";
import {
  createHistoryEntry,
  createStateHash,
  safeDeepClone,
  shouldTrackPath,
  compressHistory,
  estimateHistorySize,
  extractAffectedPaths,
} from "./utils/historyUtils";

import type {
  FormUndoRedoStacks,
  FormUndoRedoContextType,
  HistoryEntry,
  PerformanceMetrics,
  FormUndoRedoConfig,
} from "./types/FormUndoRedo.types";

export type FormUndoRedoProps<T = any> = FormUndoRedoConfig & {
  resetOptions?: Parameters<ReturnType<typeof useFormContext>["reset"]>[1];
  children?: React.ReactNode;
};

export default function FormUndoRedo<T = any>({
  maxHistory = 50,
  hotkeys = true,
  captureInitial = false,
  autoCapture = "off",
  debounceMs = 400,
  watchPaths,
  usePatches = true,
  enablePersistence = false,
  persistenceKey = "form-undo-redo",
  debug = false,
  resetOptions,
  children,
}: FormUndoRedoProps<T>) {
  const { watch, getValues, reset } = useFormContext();

  // State
  const stacksRef = React.useRef<FormUndoRedoStacks<T>>({
    past: [],
    future: [],
  });

  const [canUndo, setCanUndo] = React.useState(false);
  const [canRedo, setCanRedo] = React.useState(false);

  // Tracking refs
  const lastCommittedRef = React.useRef<T | null>(null);
  const lastCommittedHashRef = React.useRef<string | null>(null);
  const inReplayRef = React.useRef(false);
  const pauseCountRef = React.useRef(0);
  const debounceTimerRef = React.useRef<number | null>(null);
  const currentBatchIdRef = React.useRef<string | null>(null);
  const currentBatchDescriptionRef = React.useRef<string | null>(null);

  // Performance metrics
  const metricsRef = React.useRef<PerformanceMetrics>({
    historySize: 0,
    memoryEstimate: 0,
    lastOperationTime: 0,
    totalOperations: 0,
  });

  const debugLog = React.useCallback(
    (...args: any[]) => {
      if (debug) {
        console.log("[FormUndoRedo]", ...args);
      }
    },
    [debug]
  );

  const paused = () => pauseCountRef.current > 0;

  const snapshot = React.useCallback((): T => {
    return safeDeepClone(getValues()) as T;
  }, [getValues]);

  const syncFlags = React.useCallback(() => {
    const { past, future } = stacksRef.current;
    setCanUndo(past.length > 0);
    setCanRedo(future.length > 0);

    // Update metrics
    metricsRef.current.historySize = past.length + future.length;
    metricsRef.current.memoryEstimate = estimateHistorySize(stacksRef.current);
  }, []);

  const persistHistory = React.useCallback(() => {
    if (!enablePersistence) return;

    try {
      const data = {
        past: stacksRef.current.past.slice(-10), // Only persist last 10
        timestamp: Date.now(),
      };
      localStorage.setItem(persistenceKey, JSON.stringify(data));
    } catch (error) {
      debugLog("Failed to persist history:", error);
    }
  }, [enablePersistence, persistenceKey, debugLog]);

  const loadPersistedHistory = React.useCallback(() => {
    if (!enablePersistence) return;

    try {
      const stored = localStorage.getItem(persistenceKey);
      if (stored) {
        const data = JSON.parse(stored);
        // Only load if less than 1 hour old
        if (Date.now() - data.timestamp < 3600000) {
          stacksRef.current.past = data.past || [];
          syncFlags();
          debugLog("Loaded persisted history:", data.past.length, "entries");
        }
      }
    } catch (error) {
      debugLog("Failed to load persisted history:", error);
    }
  }, [enablePersistence, persistenceKey, syncFlags, debugLog]);

  const pushToHistory = React.useCallback(
    (entry: HistoryEntry<T>) => {
      const startTime = performance.now();
      const stacks = stacksRef.current;

      stacks.past.push(entry);

      // Compress if needed
      if (stacks.past.length > maxHistory) {
        stacks.past = compressHistory(stacks.past, maxHistory);
      }

      // Clear future on new change
      stacks.future = [];

      syncFlags();
      persistHistory();

      const duration = performance.now() - startTime;
      metricsRef.current.lastOperationTime = duration;
      metricsRef.current.totalOperations++;

      debugLog("Pushed to history:", {
        description: entry.description,
        affectedPaths: entry.affectedPaths,
        duration: `${duration.toFixed(2)}ms`,
      });
    },
    [maxHistory, syncFlags, persistHistory, debugLog]
  );

  const setCommitted = React.useCallback(
    (state: T) => {
      lastCommittedRef.current = safeDeepClone(state);
      lastCommittedHashRef.current = createStateHash(state);
    },
    []
  );

  const capture = React.useCallback(
    (description?: string) => {
      if (inReplayRef.current || paused()) return;

      const current = snapshot();
      const currentHash = createStateHash(current);

      // Skip if no change
      if (currentHash === lastCommittedHashRef.current) {
        debugLog("Skipped capture: no changes detected");
        return;
      }

      const previous = lastCommittedRef.current;
      const entry = createHistoryEntry(
        current,
        usePatches ? previous || undefined : undefined,
        description,
        undefined,
        currentBatchIdRef.current || undefined
      );

      // Extract affected paths from patches if available
      if (entry.patches) {
        entry.affectedPaths = extractAffectedPaths(entry.patches);
      }

      pushToHistory(entry);
      setCommitted(current);
    },
    [snapshot, usePatches, pushToHistory, setCommitted, debugLog]
  );

  const undo = React.useCallback(() => {
    const stacks = stacksRef.current;
    if (!stacks.past.length) {
      debugLog("Undo: no history");
      return;
    }

    const startTime = performance.now();
    inReplayRef.current = true;

    try {
      const prevEntry = stacks.past.pop()!;
      
      // Capture current state BEFORE reset
      const currentState = snapshot();
      const currentEntry = createHistoryEntry(
        currentState,
        usePatches ? prevEntry.state : undefined,
        "Redo point"
      );

      // Push to future for redo
      stacks.future.push(currentEntry);

      // Reset to previous state
      reset(prevEntry.state, resetOptions);
      setCommitted(prevEntry.state);
      syncFlags();

      const duration = performance.now() - startTime;
      debugLog("Undo:", {
        description: prevEntry.description,
        duration: `${duration.toFixed(2)}ms`,
      });
    } catch (error) {
      console.error("Undo failed:", error);
    } finally {
      queueMicrotask(() => {
        inReplayRef.current = false;
      });
    }
  }, [reset, resetOptions, snapshot, setCommitted, syncFlags, usePatches, debugLog]);

  const redo = React.useCallback(() => {
    const stacks = stacksRef.current;
    if (!stacks.future.length) {
      debugLog("Redo: no future");
      return;
    }

    const startTime = performance.now();
    inReplayRef.current = true;

    try {
      const nextEntry = stacks.future.pop()!;
      
      // Capture current state BEFORE reset
      const currentState = snapshot();
      const currentEntry = createHistoryEntry(
        currentState,
        usePatches ? nextEntry.state : undefined,
        "Undo point"
      );

      // Push to past for undo
      stacks.past.push(currentEntry);

      // Reset to next state
      reset(nextEntry.state, resetOptions);
      setCommitted(nextEntry.state);
      syncFlags();

      const duration = performance.now() - startTime;
      debugLog("Redo:", {
        description: nextEntry.description,
        duration: `${duration.toFixed(2)}ms`,
      });
    } catch (error) {
      console.error("Redo failed:", error);
    } finally {
      queueMicrotask(() => {
        inReplayRef.current = false;
      });
    }
  }, [reset, resetOptions, snapshot, setCommitted, syncFlags, usePatches, debugLog]);

  const jumpTo = React.useCallback(
    (index: number, direction: "past" | "future") => {
      const stacks = stacksRef.current;
      const targetStack = direction === "past" ? stacks.past : stacks.future;

      if (index < 0 || index >= targetStack.length) {
        debugLog("JumpTo: invalid index", index);
        return;
      }

      inReplayRef.current = true;

      try {
        const targetEntry = targetStack[index];
        reset(targetEntry.state, resetOptions);
        setCommitted(targetEntry.state);

        // Reorganize stacks
        if (direction === "past") {
          stacks.future = [...stacks.past.slice(index + 1), ...stacks.future];
          stacks.past = stacks.past.slice(0, index);
        } else {
          stacks.past = [...stacks.past, ...stacks.future.slice(0, index)];
          stacks.future = stacks.future.slice(index + 1);
        }

        syncFlags();
        debugLog("Jumped to:", { index, direction });
      } catch (error) {
        console.error("JumpTo failed:", error);
      } finally {
        queueMicrotask(() => {
          inReplayRef.current = false;
        });
      }
    },
    [reset, resetOptions, setCommitted, syncFlags, debugLog]
  );

  const clear = React.useCallback(() => {
    stacksRef.current = { past: [], future: [] };
    syncFlags();
    if (enablePersistence) {
      localStorage.removeItem(persistenceKey);
    }
    debugLog("Cleared history");
  }, [syncFlags, enablePersistence, persistenceKey, debugLog]);

  const startBatch = React.useCallback(
    (description?: string): string => {
      const batchId = nanoid(8);
      currentBatchIdRef.current = batchId;
      currentBatchDescriptionRef.current = description || null;
      debugLog("Started batch:", batchId, description);
      return batchId;
    },
    [debugLog]
  );

  const endBatch = React.useCallback(() => {
    currentBatchIdRef.current = null;
    currentBatchDescriptionRef.current = null;
    debugLog("Ended batch");
  }, [debugLog]);

  const pause = React.useCallback(() => {
    pauseCountRef.current += 1;
    debugLog("Paused (count:", pauseCountRef.current, ")");
  }, [debugLog]);

  const resume = React.useCallback(() => {
    pauseCountRef.current = Math.max(0, pauseCountRef.current - 1);
    debugLog("Resumed (count:", pauseCountRef.current, ")");
  }, [debugLog]);

  const runSilently = React.useCallback(
    (fn: () => void) => {
      pause();
      try {
        fn();
      } finally {
        resume();
      }
    },
    [pause, resume]
  );

  const getHistory = React.useCallback(() => {
    return {
      past: [...stacksRef.current.past],
      future: [...stacksRef.current.future],
    };
  }, []);

  const getMetrics = React.useCallback((): PerformanceMetrics => {
    return { ...metricsRef.current };
  }, []);

  const [debugEnabled, setDebugEnabled] = React.useState(debug);
  const enableDebug = React.useCallback((enabled: boolean) => {
    setDebugEnabled(enabled);
  }, []);

  // Initialize
  React.useEffect(() => {
    loadPersistedHistory();

    const initial = snapshot();
    setCommitted(initial);

    if (captureInitial) {
      const entry = createHistoryEntry(initial, undefined, "Initial state");
      stacksRef.current.past.push(entry);
      syncFlags();
    }

    debugLog("Initialized", {
      captureInitial,
      autoCapture,
      maxHistory,
      usePatches,
    });
  }, []);

  // Hotkeys
  React.useEffect(() => {
    if (!hotkeys) return;

    const isTextEditingTarget = (el: EventTarget | null) => {
      const node = el as HTMLElement | null;
      if (!node) return false;
      const tag = node.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (node.isContentEditable) return true;
      return false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (isTextEditingTarget(e.target)) return;

      const key = e.key.toLowerCase();

      if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (key === "y") {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hotkeys, undo, redo]);

  // Auto-capture
  React.useEffect(() => {
    if (autoCapture === "off") return;

    const sub = watch((_, info) => {
      if (inReplayRef.current || paused()) return;
      if (!shouldTrackPath(info?.name, watchPaths)) return;

      if (autoCapture === "immediate") {
        capture();
      } else if (autoCapture === "debounced") {
        if (debounceTimerRef.current) {
          window.clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = window.setTimeout(() => {
          capture();
        }, debounceMs);
      }
    });

    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
      sub.unsubscribe();
    };
  }, [autoCapture, debounceMs, watch, watchPaths, capture]);

  const value = React.useMemo<FormUndoRedoContextType<T>>(
    () => ({
      undo,
      redo,
      clear,
      canUndo,
      canRedo,
      getHistory,
      jumpTo,
      capture,
      startBatch,
      endBatch,
      pause,
      resume,
      runSilently,
      getMetrics,
      enableDebug,
    }),
    [
      undo,
      redo,
      clear,
      canUndo,
      canRedo,
      getHistory,
      jumpTo,
      capture,
      startBatch,
      endBatch,
      pause,
      resume,
      runSilently,
      getMetrics,
      enableDebug,
    ]
  );

  return (
    <FormUndoRedoContext.Provider value={value}>
      {children ?? null}
    </FormUndoRedoContext.Provider>
  );
}
