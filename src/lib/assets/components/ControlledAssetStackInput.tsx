"use client";
import React, {
  useState
} from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  rectSortingStrategy,
  SortableContext,
  useSortable
} from "@dnd-kit/sortable";
import {
  CSS
} from "@dnd-kit/utilities";
import {
  GripVertical, Settings2, Trash2
} from "lucide-react";

import useAssetsBridge from "@/hooks/useAssetsBridge";
import useSketchAssets from "@/components/ClientProcessingSketch/components/SketchOptions/components/SketchAssetsProvider/hooks/useSketchAssets";
import DropZoneButton from "@/components/DropZoneButton";
import {
  resolveAssetURL
} from "@/lib/assets";

import useAssetField from "../hooks/useAssetField";
import type {
  AssetInstance, AssetKind
} from "../types";
import AssetDialog from "./AssetDialog";

type Props = {
  name: string;
  /** Asset kind id (e.g. "images", "videos"). Defaults to "images". */
  kind?: string;
};

export default function ControlledAssetStackInput<P>( {
  name, kind: kindId = "images"
}: Props ) {
  const {
    uploadFiles, maybeRemoveFromAssets
  } = useAssetsBridge();
  const {
    jobId
  } = useSketchAssets();

  const {
    kind, instances, appendPaths, removeAt, reorder, updateParams
  } = useAssetField<P>( {
    name,
    kindId
  } );

  const sensors = useSensors( useSensor(
    PointerSensor,
    {
      activationConstraint: {
        distance: 5
      }
    }
  ) );

  const rows = instances.map( ( instance ) => ( {
    instance,
    url: resolveAssetURL(
      instance.path,
      jobId
    )
  } ) );

  /** Kinds with params get a "Settings" banner at the bottom of each tile, so
   *  their tiles (and the matching DropZone slot) need extra height to keep
   *  the preview area readable. */
  const hasParams = Boolean( kind.hasParams && kind.ParamsEditor );
  const tileHeightClass = hasParams ? "h-32" : "h-24";

  async function onFiles( files: FileList ) {
    const paths = await uploadFiles(
      files,
      kindId as any
    );

    if ( paths.length ) {
      appendPaths( paths );
    }
  }

  function onDelete( index: number ) {
    const removed = removeAt( index );

    if ( removed ) {
      maybeRemoveFromAssets(
        removed,
        kindId as any
      );
    }
  }

  function onDragEnd( evt: DragEndEvent ) {
    const {
      active, over
    } = evt;

    if ( !over || active.id === over.id ) {
      return;
    }

    const oldIdx = instances.findIndex( ( i ) => i.id === active.id );
    const newIdx = instances.findIndex( ( i ) => i.id === over.id );

    reorder(
      oldIdx,
      newIdx
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <DndContext sensors={ sensors } onDragEnd={ onDragEnd }>
        <div className="grid grid-cols-2 gap-1.5">
          <SortableContext
            items={ rows.map( ( r ) => r.instance.id ) }
            strategy={ rectSortingStrategy }
          >
            {rows.map( (
              row, index
            ) => (
              <SortableThumb
                key={ row.instance.id }
                kind={ kind }
                instance={ row.instance }
                url={ row.url }
                heightClass={ tileHeightClass }
                onDelete={ () => onDelete( index ) }
                onParamsChange={ ( params ) => updateParams(
                  index,
                  params
                ) }
              />
            ) )}
          </SortableContext>

          <DropZoneButton
            onFiles={ onFiles }
            multiple
            className={ tileHeightClass }
            accept={ kind.accept }
          />
        </div>
      </DndContext>
    </div>
  );
}

/**
 * A single asset tile: delete and drag in the top corners (matching the
 * image tiles), and — for kinds with params — a full-width "Settings" banner
 * along the bottom. Legible even on a ~50 px mobile cell:
 *
 *   ┌─────────────┐
 *   │ 🗑        ⠿ │  delete (top-left) · drag (top-right, sole dnd-kit activator)
 *   │   preview   │
 *   │ ⚙ Settings  │  settings banner (full-width bottom)
 *   └─────────────┘
 *
 * No overlay button: the preview keeps `mouseenter` reachable (so the video
 * preview can hover-play), and clicks on the corner buttons and banner route
 * directly to their handlers — they explicitly `stopPropagation` on
 * `pointerdown` so dnd-kit's PointerSensor (attached to the drag handle only)
 * cannot pre-empt them.
 *
 * The settings banner opens an `AssetDialog` — portaled at the top of the
 * tree, so its own controls (Remove, ParamsEditor) cannot be clipped by the
 * tile or captured by the options panel. Kinds without params hide the
 * banner: images get Delete + Drag, videos add the bottom Settings banner.
 */
function SortableThumb<P>( {
  kind,
  instance,
  url,
  heightClass,
  onDelete,
  onParamsChange
}: {
  kind: AssetKind<P>;
  instance: AssetInstance<P>;
  url: string;
  heightClass: string;
  onDelete: () => void;
  onParamsChange: ( params: P ) => void;
} ) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable( {
    id: instance.id
  } );

  const style = {
    transform: CSS.Transform.toString( transform ),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  const [
    dialogOpen,
    setDialogOpen
  ] = useState( false );

  const Preview = kind.PreviewComponent;
  const hasParams = Boolean( kind.hasParams && kind.ParamsEditor );

  return (
    <>
      {/* Vertical layout: preview area (flex-1) on top, optional "Settings"
          banner in normal flow at the bottom. Using flex-col rather than
          absolute positioning for the banner makes its position unambiguous
          — it is always the last child, always at the bottom, regardless of
          transforms or stacking. */}
      <div
        ref={ setNodeRef }
        style={ style }
        className={ `relative ${ heightClass } rounded-lg border border-theme overflow-hidden bg-background flex flex-col` }
      >
        {/* Preview area: takes all remaining space above the banner. The
            preview itself absolutely fills it so it can never push the
            layout or shift the overlaid corner controls out of bounds,
            whatever the asset's intrinsic size. */}
        <div className="relative flex-1 min-h-0">
          <div className="absolute inset-0">
            <Preview url={ url } path={ instance.path } />
          </div>

          {/* Top-left: delete. Matches the image stack design. */}
          <CornerButton
            ariaLabel="Remove"
            onClick={ onDelete }
            tone="danger"
            className="left-1 top-1"
          >
            <Trash2 className="h-4 w-4" />
          </CornerButton>

          {/* Top-right: drag handle. Sole dnd-kit activator. `touch-none`
              lets it own touch gestures without blocking panel scroll. */}
          <button
            type="button"
            ref={ setActivatorNodeRef }
            { ...attributes }
            { ...listeners }
            aria-label="Drag to reorder"
            className="absolute right-1 top-1 z-10 h-7 w-7 grid place-items-center rounded-md text-foreground/70 hover:text-foreground bg-background/90 hover:bg-background border border-theme cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </div>

        {/* Bottom banner: opens the AssetDialog where the preview and params
            editor have room to breathe. Same stopPropagation guard as the
            corner buttons so dnd-kit's PointerSensor (on the drag handle)
            cannot read a tap as a drag. */}
        {hasParams ? (
          <button
            type="button"
            onClick={ ( e ) => {
              e.stopPropagation();
              setDialogOpen( true );
            } }
            onPointerDown={ ( e ) => e.stopPropagation() }
            aria-label="Open settings"
            className="flex h-7 flex-shrink-0 items-center justify-center gap-1.5 border-t border-theme bg-background text-xs font-medium text-foreground hover:bg-hover"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Settings
          </button>
        ) : null}
      </div>

      {hasParams ? (
        <AssetDialog
          open={ dialogOpen }
          onClose={ () => setDialogOpen( false ) }
          kind={ kind }
          instance={ instance }
          url={ url }
          onParamsChange={ onParamsChange }
        />
      ) : null}
    </>
  );
}

/**
 * Compact corner action button. Stops pointer-down propagation so that
 * dnd-kit's PointerSensor cannot intercept the gesture as a potential drag.
 */
function CornerButton( {
  onClick,
  ariaLabel,
  className,
  tone,
  children
}: {
  onClick: () => void;
  ariaLabel: string;
  className: string;
  tone?: "danger";
  children: React.ReactNode;
} ) {
  return (
    <button
      type="button"
      onClick={ ( e ) => {
        e.stopPropagation();
        onClick();
      } }
      onPointerDown={ ( e ) => e.stopPropagation() }
      aria-label={ ariaLabel }
      className={ `absolute z-10 h-7 w-7 grid place-items-center rounded-md bg-background/90 hover:bg-background border border-theme ${
        tone === "danger" ? "text-red-600 hover:text-red-700" : "text-foreground/70 hover:text-foreground"
      } ${ className }` }
    >
      {children}
    </button>
  );
}
