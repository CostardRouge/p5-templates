"use client";
import {
  Dialog, DialogBackdrop, DialogPanel, DialogTitle
} from "@headlessui/react";
import {
  Trash2, X
} from "lucide-react";

import type {
  AssetInstance, AssetKind
} from "../types";

type Props<P> = {
  open: boolean;
  onClose: () => void;
  kind: AssetKind<P>;
  instance: AssetInstance<P>;
  url: string;
  onParamsChange: ( params: P ) => void;
  onRemove: () => void;
};

const fileName = ( p: string ) => p.split( /[\\/]/ ).pop() || p;

/**
 * Asset detail modal: a large preview plus the kind's optional
 * `ParamsEditor` and a Remove action. Opened from the "Settings" banner on a
 * stack tile, so all per-asset controls live here instead of being crammed
 * onto a small thumbnail.
 *
 * Full-screen layout (inspired by the recordings `VideoPreviewModal`): a
 * blurred backdrop with a near-viewport panel that always fits the screen.
 * The preview and the options sit side-by-side on desktop and stack
 * vertically on mobile; the body scrolls internally so the panel never grows
 * past the viewport — which is exactly what made the previous small dialog
 * unusable once the params editor and timeline were added.
 *
 * Rendered in a portal at the top of the tree (Headless UI `Dialog`), so its
 * controls are never clipped by the thumbnail's `overflow-hidden` nor
 * captured by the options panel, with focus trap, Escape, and overlay-click
 * to close.
 */
export default function AssetDialog<P>( {
  open,
  onClose,
  kind,
  instance,
  url,
  onParamsChange,
  onRemove
}: Props<P> ) {
  const Preview = kind.PreviewComponent;
  const ParamsEditor = kind.ParamsEditor;

  function handleRemove() {
    onRemove();
    onClose();
  }

  return (
    <Dialog open={ open } onClose={ onClose } className="relative z-[9999]">
      <DialogBackdrop className="fixed inset-0 bg-black/80 backdrop-blur-md" />

      <div className="fixed inset-0 flex items-center justify-center p-3 sm:p-4 md:p-8">
        <DialogPanel className="w-full md:w-[90vw] lg:w-[85vw] xl:w-[80vw] max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] md:max-h-[95vh] bg-background border border-theme rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col">
          <header className="flex items-center justify-between gap-2 px-4 py-3 sm:px-6 sm:py-4 border-b border-theme flex-shrink-0">
            <DialogTitle
              className="text-sm sm:text-base font-bold text-foreground truncate"
              title={ instance.path }
            >
              {kind.label} · {fileName( instance.path )}
            </DialogTitle>
            <button
              type="button"
              onClick={ onClose }
              className="flex-shrink-0 p-2 rounded-xl text-foreground/70 hover:text-foreground hover:bg-hover transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          {/* Body: preview + options side-by-side on desktop, stacked on
              mobile. Scrolls internally so the panel always fits the screen. */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 md:p-6 flex flex-col md:flex-row gap-4 md:gap-6">
            <div className="md:flex-1 md:min-w-0 flex items-start justify-center">
              <div className="w-full aspect-video bg-black rounded-xl sm:rounded-2xl border border-theme overflow-hidden grid place-items-center shadow-lg">
                <Preview url={ url } path={ instance.path } />
              </div>
            </div>

            <div className="md:w-80 lg:w-96 flex-shrink-0 flex flex-col gap-4">
              {ParamsEditor ? (
                <ParamsEditor value={ instance.params } onChange={ onParamsChange } />
              ) : null}

              <button
                type="button"
                onClick={ handleRemove }
                className="flex items-center justify-center gap-2 h-10 rounded-lg border border-red-500/40 text-red-600 hover:bg-red-500/10 text-sm font-medium"
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </button>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
