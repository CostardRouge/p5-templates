"use client";
import {
  Dialog, DialogBackdrop, DialogPanel, DialogTitle
} from "@headlessui/react";
import {
  X
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
};

const fileName = ( p: string ) => p.split( /[\\/]/ ).pop() || p;

/**
 * Asset detail modal: a large preview alongside the kind's optional
 * `ParamsEditor`. Opened from the "Settings" banner on a stack tile, so all
 * per-asset controls live here instead of being crammed onto a small
 * thumbnail. (Deletion stays on the tile's own trash button — the modal is
 * purely for settings.)
 *
 * Layout: a blurred backdrop with a near-viewport panel that always fits the
 * screen. The body splits the space evenly — preview and editor share 50/50
 * on desktop (md+, side by side) and stack on mobile, where the preview keeps
 * a capped height and the editor pane takes the remaining space and scrolls.
 * That guarantees every control (including the last ones) stays reachable on
 * small screens.
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
  onParamsChange
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

          {/* Body: 50/50 side-by-side on desktop (preview left, options
              right), stacked on mobile. `min-h-0` lets both panes shrink
              within the panel's viewport-bound height so the options pane can
              actually scroll. */}
          <div className="flex flex-1 min-h-0 flex-col md:flex-row">
            {/* Preview pane: the preview owns its own background (e.g. the
                <video> element); the pane just centers it. When the kind ships
                a params-aware layout preview (videos), it renders a
                canvas-ratio box with the asset placed exactly where it will
                land; otherwise we fall back to the plain preview in an
                aspect-video wrapper. No rounded corners — the real canvas has
                none. On mobile the pane keeps its (capped) intrinsic height
                so it never crowds out the scrollable options below. */}
            <div className="flex flex-shrink-0 items-center justify-center p-3 sm:p-4 md:p-6 md:flex-1 md:min-w-0 md:min-h-0">
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

            {/* Options pane: takes the remaining space and scrolls vertically
                so every control stays reachable, on desktop and mobile. */}
            <div className="flex flex-1 min-h-0 flex-col gap-4 overflow-y-auto p-3 sm:p-4 md:p-6 border-t border-theme md:border-t-0 md:border-l">
              {ParamsEditor ? (
                <ParamsEditor value={ instance.params } onChange={ onParamsChange } />
              ) : null}
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
