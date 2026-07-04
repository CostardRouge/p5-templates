"use client";

import {
  MenuBarSlot
} from "@/components/MenuBarPortal";
import {
  EngineControls
} from "@/components/TemplateSketchPage/EngineControls";

/**
 * The docked workspace's top rail. A full-width, squared bar flush to the top
 * edge that frames the viewport together with the left/right rails. It hosts
 * the global menu (relocated here through {@link MenuBarSlot}), the engine
 * playback controls, and — via `zoomSlotRef` — the viewport's zoom controls,
 * each rendered flat and separated by dividers instead of as floating islands.
 *
 * Desktop-only; rendered by {@link TemplateSketchPage} only in the docked
 * layout.
 */
export default function DockedTopBar( {
  zoomSlotRef
}: {
  /** Portal target for the ScalableViewport's zoom controls. */
  zoomSlotRef: ( el: HTMLDivElement | null ) => void;
} ) {
  return (
    <div className="absolute top-0 left-0 right-0 h-12 z-50 flex items-stretch glass border-b border-theme">
      <div className="flex items-center px-2">
        <MenuBarSlot />
      </div>

      <Divider />

      <div className="flex items-center px-1">
        <EngineControls variant="bar" />
      </div>

      <div className="flex-1" />

      <Divider />

      <div
        ref={ zoomSlotRef }
        className="flex items-center px-1"
      />
    </div>
  );
}

function Divider() {
  return <div className="my-2 w-px bg-border" />;
}
