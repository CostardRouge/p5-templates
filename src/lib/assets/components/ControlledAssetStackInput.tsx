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
  GripVertical
} from "lucide-react";

import useAssetsBridge from "@/hooks/useAssetsBridge";
import useTemplateAssets from "@/components/ClientProcessingSketch/components/TemplateOptions/components/TemplateAssetsProvider/hooks/useTemplateAssets";
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
  } = useTemplateAssets();

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
        <div className="grid grid-cols-3 gap-1">
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
            className="h-20"
            accept={ kind.accept }
          />
        </div>
      </DndContext>
    </div>
  );
}

/**
 * A single asset tile. The tile body is a tap target that opens the detail
 * dialog (preview + params + remove). Reordering is driven by one small drag
 * handle in the corner — the only dnd-kit activator — so the rest of the tile
 * stays scroll-friendly on touch and nothing competes for the tap.
 */
function SortableThumb<P>( {
  kind,
  instance,
  url,
  onDelete,
  onParamsChange
}: {
  kind: AssetKind<P>;
  instance: AssetInstance<P>;
  url: string;
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
    open,
    setOpen
  ] = useState( false );

  const Preview = kind.PreviewComponent;

  return (
    <>
      <div
        ref={ setNodeRef }
        style={ style }
        className="relative h-20 bg-background rounded-lg border border-theme overflow-hidden"
      >
        {/* Tap target: opens the detail dialog. Covers the whole tile and
            sits above the preview so the tap is reliable everywhere. */}
        <button
          type="button"
          onClick={ () => setOpen( true ) }
          aria-label={ `Edit ${ kind.label }` }
          className="absolute inset-0 z-10 cursor-pointer bg-transparent"
        />

        <Preview url={ url } path={ instance.path } />

        {/* Sole drag activator. `touch-none` lets it own touch gestures
            without blocking panel scroll elsewhere on the tile. */}
        <button
          type="button"
          ref={ setActivatorNodeRef }
          { ...attributes }
          { ...listeners }
          aria-label="Drag to reorder"
          className="absolute right-1 top-1 z-20 h-6 w-6 grid place-items-center text-gray-200 bg-black/45 hover:bg-black/65 rounded-md cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      </div>

      <AssetDialog
        open={ open }
        onClose={ () => setOpen( false ) }
        kind={ kind }
        instance={ instance }
        url={ url }
        onParamsChange={ onParamsChange }
        onRemove={ onDelete }
      />
    </>
  );
}
