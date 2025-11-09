"use client";

import React from "react";
import { AlertCircle, Save, X } from "lucide-react";

type UnsavedChangesModalProps = {
  isOpen: boolean;
  onStay: () => void;
  onSaveAsDraft: () => void;
  onLeaveWithoutSaving?: () => void;
  isSaving?: boolean;
};

export default function UnsavedChangesModal({
  isOpen,
  onStay,
  onSaveAsDraft,
  onLeaveWithoutSaving,
  isSaving = false,
}: UnsavedChangesModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed top-0 left-0 w-full h-full flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 z-[100]"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onStay();
        }
      }}
    >
      <div
        className="relative w-full max-w-md bg-background rounded-lg border border-theme shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-background border-b border-theme flex-shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            <h2 className="font-semibold">Unsaved Changes</h2>
          </div>
          <button
            onClick={onStay}
            aria-label="Close"
            disabled={isSaving}
            className="disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm text-foreground/80 mb-6">
            You have unsaved changes. Would you like to save them as a draft before leaving?
          </p>

          <div className="flex flex-col gap-2">
            <button
              onClick={onSaveAsDraft}
              disabled={isSaving}
              className="w-full rounded-lg px-4 py-2.5 border border-theme border-b-2 bg-background text-foreground hover:bg-theme/10 disabled:opacity-50 flex items-center justify-center gap-2 text-sm font-medium transition-colors"
            >
              <Save className="h-4 w-4" />
              <span>{isSaving ? "Saving..." : "Save as draft"}</span>
            </button>

            {onLeaveWithoutSaving && (
              <button
                onClick={onLeaveWithoutSaving}
                disabled={isSaving}
                className="w-full rounded-lg px-4 py-2.5 border border-theme bg-background text-foreground/70 hover:bg-theme/10 hover:text-foreground disabled:opacity-50 flex items-center justify-center gap-2 text-sm transition-colors"
              >
                <span>Leave without saving</span>
              </button>
            )}

            <button
              onClick={onStay}
              disabled={isSaving}
              className="w-full rounded-lg px-4 py-2.5 bg-background text-foreground hover:bg-theme/5 disabled:opacity-50 flex items-center justify-center gap-2 text-sm transition-colors"
            >
              <span>Stay on this page</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
