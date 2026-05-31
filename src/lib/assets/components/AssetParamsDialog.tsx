"use client";
import {
  Dialog, DialogBackdrop, DialogPanel, DialogTitle
} from "@headlessui/react";
import {
  X
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
};

const fileName = ( p: string ) => p.split( /[\\/]/ ).pop() || p;

/**
 * Centered, focus-trapped modal that hosts a kind's `ParamsEditor`
 * alongside a large preview of the asset. Works on desktop (max-w-md)
 * and mobile (full-width with margin), with the native dismiss behaviour
 * Headless UI gives us (overlay click, Escape, focus restore).
 *
 * Rendered for any kind that opts in via `hasParams` and ships a
 * `ParamsEditor` — videos today, audios / json / future kinds tomorrow.
 */
export default function AssetParamsDialog<P>( {
  open,
  onClose,
  kind,
  instance,
  url,
  onParamsChange
}: Props<P> ) {
  const Preview = kind.PreviewComponent;
  const ParamsEditor = kind.ParamsEditor;

  if ( !ParamsEditor ) {
    return null;
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

          <div className="p-3 overflow-y-auto">
            <ParamsEditor value={ instance.params } onChange={ onParamsChange } />
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
