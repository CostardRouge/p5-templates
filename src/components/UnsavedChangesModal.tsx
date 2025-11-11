"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Save, X } from "lucide-react";

type UnsavedChangesModalProps = {
  isOpen: boolean;
  onStay: () => void;
  onSaveAsDraft: () => void;
  onLeaveWithoutSaving?: () => void;
  isSaving?: boolean;
};

export default function UnsavedChangesModal( {
  isOpen,
  onStay,
  onSaveAsDraft,
  onLeaveWithoutSaving,
  isSaving = false,
}: UnsavedChangesModalProps ) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      console.log("[UnsavedChangesModal] Modal is now open");
    }
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 z-[9999]"
      onClick={onStay}
    >
      <div
        className="relative w-full max-w-md bg-background rounded-lg border border-theme shadow-2xl flex flex-col"
        onClick={( e ) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-theme">
          <h2 className="font-semibold">Unsaved changes</h2>
          <button
            onClick={onStay}
            aria-label="Close"
            disabled={isSaving}
            className="disabled:opacity-50 hover:opacity-70 transition-opacity"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm text-foreground/70 mb-4">
            You have unsaved changes. Save as draft before leaving?
          </p>

          <div className="flex flex-col gap-2">
            <button
              onClick={onSaveAsDraft}
              disabled={isSaving}
              className="w-full rounded-lg px-4 py-2 border border-theme bg-background text-foreground hover:bg-hover disabled:opacity-50 flex items-center justify-center gap-2 text-sm transition-colors"
            >
              <Save className="h-4 w-4" />
              <span>{isSaving ? "Saving..." : "Save as draft"}</span>
            </button>

            {onLeaveWithoutSaving && (
              <button
                onClick={onLeaveWithoutSaving}
                disabled={isSaving}
                className="w-full rounded-lg px-4 py-2 text-foreground/70 hover:text-foreground hover:bg-hover/50 disabled:opacity-50 text-sm transition-colors"
              >
                Leave without saving
              </button>
            )}

            <button
              onClick={onStay}
              disabled={isSaving}
              className="w-full rounded-lg px-4 py-2 text-foreground/70 hover:text-foreground hover:bg-hover/50 disabled:opacity-50 text-sm transition-colors"
            >
              Stay on page
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
