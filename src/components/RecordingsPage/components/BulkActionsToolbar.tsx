import {
  Trash2, X, RotateCcw, CheckSquare
} from "lucide-react";
import type {
  JobModel
} from "@/types/recording.types";

interface BulkActionsToolbarProps {
  selectedJobs: JobModel[];
  isProcessing: boolean;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onBulkCancel: () => void;
  onBulkRetry: () => void;
}

export default function BulkActionsToolbar( {
  selectedJobs,
  isProcessing,
  onClearSelection,
  onBulkDelete,
  onBulkCancel,
  onBulkRetry
}: BulkActionsToolbarProps ) {
  if ( selectedJobs.length === 0 ) return null;

  const canDelete = selectedJobs.some( j => [
    "completed",
    "cancelled",
    "draft",
    "failed"
  ].includes( j.status ) );
  const canCancel = selectedJobs.some( j => j.status === "queued" );
  const canRetry = selectedJobs.some( j => [
    "cancelled",
    "failed"
  ].includes( j.status ) );

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-background border border-border rounded-2xl shadow-xl px-6 py-4 flex items-center gap-4">
        {/* Selection Info */}
        <div className="flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-blue-600" />
          <span className="font-semibold text-foreground">
            {selectedJobs.length} selected
          </span>
        </div>

        <div className="w-px h-6 bg-border" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          {canCancel && (
            <button
              onClick={onBulkCancel}
              disabled={isProcessing}
              className="px-4 py-2 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          )}

          {canRetry && (
            <button
              onClick={onBulkRetry}
              disabled={isProcessing}
              className="px-4 py-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Retry
            </button>
          )}

          {canDelete && (
            <button
              onClick={onBulkDelete}
              disabled={isProcessing}
              className="px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
        </div>

        <div className="w-px h-6 bg-border" />

        {/* Clear Selection */}
        <button
          onClick={onClearSelection}
          disabled={isProcessing}
          className="p-2 rounded-lg hover:bg-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Clear selection"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
