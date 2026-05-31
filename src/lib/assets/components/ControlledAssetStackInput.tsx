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
import useTemplateAssets from "@/components/ClientProcessingSketch/components/TemplateOptions/components/TemplateAssetsProvider/hooks/useTemplateAssets";
import DropZoneButton from "@/components/DropZoneButton";
import {
  resolveAssetURL
} from "@/lib/assets";

import useAssetField from "../hooks/useAssetField";
import type {
  AssetInstance, AssetKind
} from "../types";
import AssetParamsDialog from "./AssetParamsDialog";

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
    transition
  } = useSortable( {
    id: instance.id
  } );
  const style = {
    transform: CSS.Transform.toString( transform ),
    transition
  };

  const [
    paramsOpen,
    setParamsOpen
  ] = useState( false );

  const Preview = kind.PreviewComponent;
  const hasParams = Boolean( kind.hasParams && kind.ParamsEditor );

  return (
    <>
      <div
        ref={ setNodeRef }
        style={ style }
        className="relative h-20 bg-background rounded-lg border border-theme overflow-hidden"
      >
        <Preview url={ url } path={ instance.path } />

        {/* Action bar above the preview. `pointer-events-none` on the strip
            keeps the preview's mouseenter/leave reachable; each button
            re-enables pointer events so its click always lands. */}
        <div className="absolute inset-x-1 top-1 flex items-center justify-between gap-1 z-10 pointer-events-none">
          <ThumbButton
            onClick={ onDelete }
            ariaLabel="Remove"
            className="text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </ThumbButton>

          <div className="flex items-center gap-1">
            {hasParams ? (
              <ThumbButton
                onClick={ () => setParamsOpen( true ) }
                ariaLabel="Edit params"
              >
                <Settings2 className="h-3.5 w-3.5" />
              </ThumbButton>
            ) : null}

            <button
              type="button"
              ref={ setActivatorNodeRef }
              { ...attributes }
              { ...listeners }
              aria-label="Drag handle"
              className="pointer-events-auto h-6 w-6 grid place-items-center text-gray-600 cursor-grab active:cursor-grabbing bg-background/90 hover:bg-background rounded-md border border-theme touch-none"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {hasParams ? (
        <AssetParamsDialog
          open={ paramsOpen }
          onClose={ () => setParamsOpen( false ) }
          kind={ kind }
          instance={ instance }
          url={ url }
          onParamsChange={ onParamsChange }
        />
      ) : null}
    </>
  );
}

function ThumbButton( {
  onClick,
  ariaLabel,
  className,
  children
}: {
  onClick: () => void;
  ariaLabel: string;
  className?: string;
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
      className={ `pointer-events-auto h-6 w-6 grid place-items-center bg-background/90 hover:bg-background rounded-md border border-theme text-foreground ${ className ?? "" }` }
    >
      {children}
    </button>
  );
}
