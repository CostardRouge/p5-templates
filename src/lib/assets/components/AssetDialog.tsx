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
 * `ParamsEditor` and a Remove action. Tapping a thumbnail opens it, so all
 * per-asset controls live here instead of being crammed onto a small tile.
 *
 * Rendered in a portal at the top of the tree (Headless UI `Dialog`), so its
 * controls are never clipped by the thumbnail's `overflow-hidden` nor
 * captured by the options panel — which is exactly what broke the previous
 * on-tile buttons. Centered on desktop, bottom-anchored full-width on mobile,
 * with focus trap, Escape, and overlay-click to close.
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
    <Dialog open={ open } onClose={ onClose } className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-black/60" />

      <div className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <DialogPanel className="w-full sm:max-w-md bg-background border border-theme rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
          <header className="flex items-center justify-between gap-2 px-3 py-2 border-b border-theme">
            <DialogTitle className="text-xs font-medium truncate" title={ instance.path }>
              {kind.label} · {fileName( instance.path )}
            </DialogTitle>
            <button
              type="button"
              onClick={ onClose }
              className="h-7 w-7 grid place-items-center text-gray-500 hover:text-foreground hover:bg-theme/20 rounded-md"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="aspect-video bg-black grid place-items-center overflow-hidden">
            <Preview url={ url } path={ instance.path } />
          </div>

          <div className="p-3 overflow-y-auto flex flex-col gap-3">
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
        </DialogPanel>
      </div>
    </Dialog>
  );
}
