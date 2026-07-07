import React from "react";
import useFormUndoRedo from "./useFormUndoRedo";
import type {
  HistoryEntry
} from "../types/FormUndoRedo.types";

/**
 * Hook for accessing and visualizing history
 */
export default function useFormUndoRedoHistory() {
  const context = useFormUndoRedo();
  const [
    history,
    setHistory
  ] = React.useState<{
    past: HistoryEntry[];
    future: HistoryEntry[];
  }>( {
    past: [],
    future: []
  } );

  // Poll history (could be optimized with events)
  React.useEffect(
    () => {
      const interval = setInterval(
        () => {
          setHistory( context.getHistory() );
        },
        100
      );

      return () => clearInterval( interval );
    },
    [
      context
    ]
  );

  const formatTimestamp = ( timestamp: number ) => {
    const date = new Date( timestamp );

    return date.toLocaleTimeString();
  };

  const getHistoryItems = () => {
    return {
      past: history.past.map( (
        entry, index
      ) => ( {
        index,
        direction: "past" as const,
        timestamp: entry.timestamp,
        formattedTime: formatTimestamp( entry.timestamp ),
        description: entry.description || "Change",
        affectedPaths: entry.affectedPaths || [],
        hasPatch: !!entry.patches
      } ) ),
      future: history.future.map( (
        entry, index
      ) => ( {
        index,
        direction: "future" as const,
        timestamp: entry.timestamp,
        formattedTime: formatTimestamp( entry.timestamp ),
        description: entry.description || "Change",
        affectedPaths: entry.affectedPaths || [],
        hasPatch: !!entry.patches
      } ) )
    };
  };

  return {
    ...context,
    history,
    getHistoryItems
  };
}
