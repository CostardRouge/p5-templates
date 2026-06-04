"use client";
import {
  Dialog, DialogBackdrop, DialogPanel, DialogTitle
} from "@headlessui/react";
import {
  Trash2, X
} from "lucide-react";
import {
  useFormContext, useWatch
} from "react-hook-form";

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
 * On desktop (md+) the preview sits on the left and the params editor on
 * the right; on mobile they stack vertically and the body scrolls
 * internally so the panel never grows past the viewport — fixing the
 * previous small dialog that became unusable once the params editor and
 * mini timeline were added.
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
  const LayoutPreview = kind.LayoutPreviewComponent;
  const ParamsEditor = kind.ParamsEditor;

  // Mirror the target canvas aspect ratio so the layout preview shows the
  // video where it will actually land on the final render. Read straight
  // from the options form (same field the "Canvas size" select writes).
  const {
    control
  } = useFormContext();
  const sizeWidth = useWatch( {
    control,
    name: "size.width"
  } ) as number | undefined;
  const sizeHeight = useWatch( {
    control,
    name: "size.height"
  } ) as number | undefined;
  const canvasAspectRatio =
    sizeWidth && sizeHeight ? sizeWidth / sizeHeight : undefined;

  function handleRemove() {
    onRemove();
    onClose();
  }

  return (
    <Dialog open={ open } onClose={ onClose } className="relative z-[9999]">
      <DialogBackdrop className="fixed inset-0 bg-black/80 backdrop-blur-md" />

      <div className="fixed inset-0 flex items-center justify-center p-3 sm:p-4 md:p-8">
        <DialogPanel className="w-full md:w-[92vw] lg:w-[88vw] xl:w-[80vw] max-w-[1400px] max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] md:max-h-[95vh] bg-background border border-theme rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col">
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

          {/* Body: side-by-side on desktop (preview left, options right),
              stacked on mobile. The flex direction is set explicitly on
              md+ so it is unambiguous, and `min-h-0` lets both panes shrink
              within the panel's viewport-bound height. */}
          <div className="flex flex-1 min-h-0 flex-col md:flex-row">
            {/* Preview pane: the preview owns its own background (e.g. the
                <video> element); the pane just centers it and gives it room
                to breathe. When the kind ships a params-aware layout preview
                (videos), it renders a canvas-ratio box with the asset placed
                exactly where it will land; otherwise we fall back to the plain
                preview in an aspect-video wrapper. No rounded corners — the
                real canvas has none. */}
            <div className="flex items-center justify-center md:flex-1 md:min-w-0 p-3 sm:p-4 md:p-6">
              {LayoutPreview ? (
                <LayoutPreview
                  url={ url }
                  path={ instance.path }
                  params={ instance.params }
                  canvasAspectRatio={ canvasAspectRatio }
                />
              ) : (
                <div className="w-full aspect-video overflow-hidden">
                  <Preview url={ url } path={ instance.path } />
                </div>
              )}
            </div>

            {/* Options pane: fixed width on desktop, full width on mobile.
                Scrolls vertically when its content overflows so the modal
                never grows past the viewport. */}
            <div className="md:w-80 lg:w-96 flex-shrink-0 flex flex-col gap-4 p-3 sm:p-4 md:p-6 overflow-y-auto border-t border-theme md:border-t-0 md:border-l">
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
