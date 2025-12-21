import React from "react";
import useFormUndoRedo from "./useFormUndoRedo";

/**
 * Hook for batch operations
 */
export default function useFormUndoRedoBatch() {
  const context = useFormUndoRedo();
  const batchIdRef = React.useRef<string | null>( null );

  const withBatch = React.useCallback(
    <T>( fn: () => T, description?: string ): T => {
      const batchId = context.startBatch( description );

      batchIdRef.current = batchId;

      try {
        return fn();
      } finally {
        context.endBatch();
        batchIdRef.current = null;
      }
    },
    [
      context
    ]
  );

  const withBatchAsync = React.useCallback(
    async <T>( fn: () => Promise<T>, description?: string ): Promise<T> => {
      const batchId = context.startBatch( description );

      batchIdRef.current = batchId;

      try {
        return await fn();
      } finally {
        context.endBatch();
        batchIdRef.current = null;
      }
    },
    [
      context
    ]
  );

  return {
    withBatch,
    withBatchAsync,
    isInBatch: () => batchIdRef.current !== null,
    currentBatchId: batchIdRef.current,
  };
}
