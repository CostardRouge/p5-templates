"use client";

import React from "react";
import { Clock, ArrowLeft, ArrowRight } from "lucide-react";
import useFormUndoRedoHistory from "../hooks/useFormUndoRedoHistory";
import useFormUndoRedoMetrics from "../hooks/useFormUndoRedoMetrics";

type HistoryVisualizerProps = {
  maxItems?: number;
  showMetrics?: boolean;
};

/**
 * Debug component to visualize undo/redo history
 */
export default function HistoryVisualizer({
  maxItems = 10,
  showMetrics = true,
}: HistoryVisualizerProps) {
  const { getHistoryItems, jumpTo, clear } = useFormUndoRedoHistory();
  const metrics = useFormUndoRedoMetrics();
  const { past, future } = getHistoryItems();

  const displayPast = past.slice(-maxItems);
  const displayFuture = future.slice(0, maxItems);

  return (
    <div className="p-2 border border-theme rounded-lg bg-background text-xs space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">History Debug</h3>
        <button
          onClick={clear}
          className="px-2 py-0.5 text-xs rounded bg-red-500/20 hover:bg-red-500/30 text-red-400"
        >
          Clear
        </button>
      </div>

      {showMetrics && (
        <div className="grid grid-cols-2 gap-2 p-2 bg-muted/50 rounded text-muted-foreground">
          <div>
            <div className="text-[10px] opacity-70">Total Entries</div>
            <div className="font-mono">{metrics.historySize}</div>
          </div>
          <div>
            <div className="text-[10px] opacity-70">Memory</div>
            <div className="font-mono">{metrics.formattedMemory}</div>
          </div>
          <div>
            <div className="text-[10px] opacity-70">Last Op</div>
            <div className="font-mono">{metrics.lastOperationTime.toFixed(2)}ms</div>
          </div>
          <div>
            <div className="text-[10px] opacity-70">Total Ops</div>
            <div className="font-mono">{metrics.totalOperations}</div>
          </div>
        </div>
      )}

      <div className="space-y-1">
        <div className="flex items-center gap-1 text-muted-foreground">
          <ArrowLeft className="h-3 w-3" />
          <span className="text-[10px] font-semibold">PAST ({past.length})</span>
        </div>
        
        {displayPast.length === 0 ? (
          <div className="text-muted-foreground/50 text-[10px] italic pl-4">
            No history
          </div>
        ) : (
          <div className="space-y-0.5">
            {displayPast.map((item) => (
              <button
                key={`past-${item.index}`}
                onClick={() => jumpTo(item.index, "past")}
                className="w-full text-left p-1.5 rounded hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-foreground truncate">
                      {item.description}
                    </div>
                    {item.affectedPaths.length > 0 && (
                      <div className="text-[10px] text-muted-foreground truncate">
                        {item.affectedPaths.join(", ")}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="h-2.5 w-2.5" />
                    <span>{item.formattedTime}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-theme pt-1 space-y-1">
        <div className="flex items-center gap-1 text-muted-foreground">
          <ArrowRight className="h-3 w-3" />
          <span className="text-[10px] font-semibold">FUTURE ({future.length})</span>
        </div>
        
        {displayFuture.length === 0 ? (
          <div className="text-muted-foreground/50 text-[10px] italic pl-4">
            No future states
          </div>
        ) : (
          <div className="space-y-0.5">
            {displayFuture.map((item) => (
              <button
                key={`future-${item.index}`}
                onClick={() => jumpTo(item.index, "future")}
                className="w-full text-left p-1.5 rounded hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-foreground truncate">
                      {item.description}
                    </div>
                    {item.affectedPaths.length > 0 && (
                      <div className="text-[10px] text-muted-foreground truncate">
                        {item.affectedPaths.join(", ")}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="h-2.5 w-2.5" />
                    <span>{item.formattedTime}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
