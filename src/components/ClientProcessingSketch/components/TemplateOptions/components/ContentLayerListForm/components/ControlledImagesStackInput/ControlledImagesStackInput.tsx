// ControlledImagesStackInput.tsx
"use client";
import React from "react";
import {
  useController, useFormContext
} from "react-hook-form";
import {
  DndContext, PointerSensor, useSensor, useSensors, DragEndEvent
} from "@dnd-kit/core";
import {
  SortableContext, rectSortingStrategy, arrayMove, useSortable
} from "@dnd-kit/sortable";
import {
  CSS
} from "@dnd-kit/utilities";
import {
  Trash2, GripVertical
} from "lucide-react";
import useAssetsBridge from "@/hooks/useAssetsBridge";
import useTemplateAssets from "@/components/ClientProcessingSketch/components/TemplateOptions/components/TemplateAssetsProvider/hooks/useTemplateAssets";

import DropZoneButton from "@/components/DropZoneButton";
import {
  resolveAssetURL
} from "@/shared/utils";

type Props = {
 name: string
};

export default function ControlledImagesStackInput( {
  name
}: Props ) {
  const {
    control
  } = useFormContext();
  const {
    field, fieldState
  } = useController<string[]>( {
    name,
    control
  } );
  const {
    uploadFiles, maybeRemoveFromAssets
  } = useAssetsBridge();
  const {
    jobId
  } = useTemplateAssets();

  const sensors = useSensors( useSensor(
    PointerSensor,
    {
      activationConstraint: {
        distance: 5
      }
    }
  ) );

  async function onFiles( files: FileList ) {
    const paths = await uploadFiles( files );

    if ( paths.length ) field.onChange( [
      ...( field.value ?? [
      ] ),
      ...paths
    ] );
  }
  function onDelete( idx: number ) {
    const prev = field.value ?? [
    ];
    const removed = prev[ idx ];
    const next = prev.filter( (
      _, i
    ) => i !== idx );

    field.onChange( next );
    if ( removed ) maybeRemoveFromAssets( removed );
  }
  function onDragEnd( evt: DragEndEvent ) {
    const {
      active, over
    } = evt;

    if ( !over || active.id === over.id ) return;
    const list = field.value ?? [
    ];
    const oldIdx = list.findIndex( ( p ) => p === active.id );
    const newIdx = list.findIndex( ( p ) => p === over.id );

    if ( oldIdx < 0 || newIdx < 0 ) return;
    field.onChange( arrayMove(
      list,
      oldIdx,
      newIdx
    ) );
  }

  const items = field.value ?? [
  ];

  return (
    <div className="flex flex-col gap-2">
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="grid grid-cols-3 gap-1">
          <SortableContext items={items} strategy={rectSortingStrategy}>
            {items.map( (
              path, i
            ) => (
              <SortableThumb
                key={path}
                id={path}
                url={resolveAssetURL(
                  path,
                  jobId
                )}
                onDelete={() => onDelete( i )}
              />
            ) )}
          </SortableContext>

          <DropZoneButton onFiles={onFiles} multiple className="h-20"/>
        </div>
      </DndContext>
    </div>
  );
}

function SortableThumb( {
  id, url, onDelete,
}: {
 id: string; url: string; onDelete: () => void
} ) {
  const {
    attributes, listeners, setNodeRef, transform, transition
  } = useSortable( {
    id
  } );
  const style = {
    transform: CSS.Transform.toString( transform ),
    transition
  };

  return (
    <div ref={setNodeRef} style={style} className="relative h-20 bg-white rounded-sm border border-gray-200">
      <GripVertical
        className="absolute right-1 top-1 h-5 w-5 text-gray-600 cursor-grab active:cursor-grabbing bg-white/90 hover:bg-white rounded-sm border border-gray-200"
        {...attributes} {...listeners}
      />
      <button
        type="button"
        onClick={( e ) => { e.stopPropagation(); onDelete(); }}
        className="absolute left-1 top-1 h-5 w-5 text-center text-red-600 bg-white/90 hover:bg-white rounded border border-gray-200 p-0.5"
        aria-label="Remove image"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      <img src={url} className="object-cover h-full w-full rounded" alt={id} />
    </div>
  );
}
