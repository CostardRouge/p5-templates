"use client";

import {
  MenuBarSlot
} from "@/components/MenuBarPortal";
import {
  EngineControls
} from "@/components/SketchPage/EngineControls";
import {
  getEngineLabel
} from "@/engines/engineCatalog";
import useSketch from "@/components/ClientProcessingSketch/components/SketchProvider/hooks/useSketch";
import SketchPerformanceLabel from "@/components/SketchPage/SketchPerformanceLabel";

/**
 * The docked workspace's top rail. A full-width, squared bar flush to the top
 * edge that frames the viewport together with the left/right rails. It hosts
 * the global menu (relocated here through {@link MenuBarSlot}), the engine +
 * category + sketch name, the engine playback controls, and — via
 * `zoomSlotRef` — the viewport's zoom controls, each rendered flat and
 * separated by full-height dividers instead of as floating islands. The fps
 * readout sits undivided against the zoom controls, reading as one cluster.
 *
 * Desktop-only; rendered by {@link SketchPage} only in the docked
 * layout. `items-stretch` + `h-full` cells make every divider span the whole
 * bar height edge-to-edge.
 */
export default function DockedTopBar( {
  zoomSlotRef,
  actionsSlotRef,
  targetFps,
  interactionMode
}: {
  /** Portal target for the ScalableViewport's zoom controls. */
  zoomSlotRef: ( el: HTMLDivElement | null ) => void;
  /** Portal target for the options form's bar actions (undo/redo). Filled by
   *  SketchOptions, which owns the form context they need. */
  actionsSlotRef?: ( el: HTMLDivElement | null ) => void;
  /** Sketch's target framerate, for the fps readout beside the zoom controls. */
  targetFps: number;
  /** Current viewport gesture, shown in place of the fps value. */
  interactionMode?: "panning" | "zooming" | "seeking" | null;
} ) {
  const [
    {
      engineId, name, category
    }
  ] = useSketch();

  return (
    <div className="absolute top-0 left-0 right-0 h-12 z-50 flex items-stretch glass border-b border-theme">
      <div className="flex items-center px-2">
        <MenuBarSlot />
      </div>

      <Divider />

      <div className="flex items-center gap-1.5 px-3 text-sm truncate">
        <span className="text-foreground/60">{getEngineLabel( engineId )}</span>

        {category && (
          <>
            <span className="text-foreground/30">/</span>
            <span className="text-foreground/60">{category}</span>
          </>
        )}

        <span className="text-foreground/30">/</span>
        <span className="font-medium truncate">{name}</span>
      </div>

      <Divider />

      <EngineControls variant="bar" />

      <div className="flex-1" />

      <Divider />

      <div className="flex items-center px-3 text-xs font-mono tabular-nums text-foreground/70">
        <SketchPerformanceLabel
          targetFps={ targetFps }
          interactionMode={ interactionMode }
        />
      </div>

      <div
        ref={ zoomSlotRef }
        className="flex items-stretch"
      />

      <div
        ref={ actionsSlotRef }
        className="flex items-stretch"
      />
    </div>
  );
}

function Divider() {
  return <div className="w-px bg-border" />;
}
