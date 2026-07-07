import React from "react";
import useFormUndoRedo from "./useFormUndoRedo";
import type {
  PerformanceMetrics
} from "../types/FormUndoRedo.types";

/**
 * Hook for monitoring performance metrics
 */
export default function useFormUndoRedoMetrics() {
  const context = useFormUndoRedo();
  const [
    metrics,
    setMetrics
  ] = React.useState<PerformanceMetrics>( {
    historySize: 0,
    memoryEstimate: 0,
    lastOperationTime: 0,
    totalOperations: 0
  } );

  React.useEffect(
    () => {
      const interval = setInterval(
        () => {
          setMetrics( context.getMetrics() );
        },
        500
      );

      return () => clearInterval( interval );
    },
    [
      context
    ]
  );

  const formatBytes = ( bytes: number ) => {
    if ( bytes === 0 ) {
      return "0 B";
    }
    const k = 1024;
    const sizes = [
      "B",
      "KB",
      "MB",
      "GB"
    ];
    const i = Math.floor( Math.log( bytes ) / Math.log( k ) );

    return `${ ( bytes / Math.pow(
      k,
      i
    ) ).toFixed( 2 ) } ${ sizes[ i ] }`;
  };

  return {
    ...metrics,
    formattedMemory: formatBytes( metrics.memoryEstimate ),
    averageOperationTime:
      metrics.totalOperations > 0
        ? ( metrics.lastOperationTime / metrics.totalOperations ).toFixed( 2 )
        : "0"
  };
}
