"use client";

import React, {
  useRef
} from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import {
  CSS
} from "@dnd-kit/utilities";
import {
  GripVertical, TrashIcon, Plus
} from "lucide-react";

import {
  resolveAssetURL
} from "@/shared/utils";
import {
  setSketchOptions
} from "@/shared/syncSketchOptions";
import useAssetDrop from "@/hooks/useAssetDrop";

import {
  JobId
} from "@/types/recording.types";
import {
  AssetsOption
} from "@/types/sketch.types";

export default function ImageAssets( {
  assets,
  scope,
  id
}: {
  assets: AssetsOption;
  scope: "global" | {
   slide: number
  },
  id: JobId
} ) {
  const {
    addAssets, removeAsset
  } = useAssetDrop();
  const fileInputRef = useRef<HTMLInputElement>( null );

  const sensors = useSensors( useSensor(
    PointerSensor,
    {
      activationConstraint: {
        distance: 5
      }
    }
  ) );

  const handleDragEnd = ( evt: DragEndEvent ) => {
    const {
      active, over
    } = evt;

    if ( !over || active.id === over.id ) {
      return;
    }

    const list = [
      ...( assets?.images ?? [
      ] )
    ];
    const oldIdx = list.indexOf( active.id as string );
    const newIdx = list.indexOf( over.id as string );

    if ( oldIdx < 0 || newIdx < 0 ) {
      return;
    }

    const reordered = arrayMove(
      list,
      oldIdx,
      newIdx
    );

    const patch =
      scope === "global"
        ? {
          assets: {
            images: reordered
          }
        }
        : {
          slides: {
            [ scope.slide ]: {
              assets: {
                images: reordered
              }
            }
          }
        };

    setSketchOptions(
      patch,
      "react"
    );
  };

  async function handleExternalDrop( e: React.DragEvent ) {
    e.preventDefault();

    if ( e.dataTransfer.files?.length ) {
      await addAssets( {
        files: e.dataTransfer.files,
        type: "images",
        scope,
      } );
    }
  }

  const imgPaths: string[] = assets?.images ?? [
  ];

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      sensors={sensors}
    >
      <div
        onDragOver={( e ) => e.preventDefault()}
        onDrop={handleExternalDrop}
        className="p-1 grid grid-cols-3 gap-1 min-h-8"
      >
        <SortableContext
          items={imgPaths}
          strategy={rectSortingStrategy}
        >
          {imgPaths.map( (
            path, i
          ) => (
            <SortableThumb
              key={path}
              id={path}
              url={resolveAssetURL(
                path,
                id
              )}
              onDelete={() =>
                removeAsset( {
                  type: "images",
                  index: i,
                  scope
                } )
              }
            />
          ) )}
        </SortableContext>

        <button
          type="button"
          onClick={( e ) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
          className="flex items-center justify-center h-20 border border-dashed border-gray-300 text-gray-400 hover:bg-gray-100"
        >
          <Plus className="h-6 w-6" />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={ async( e ) => {
            if ( null === e.target.files ) {
              return;
            }

            await addAssets( {
              files: e.target.files,
              type: "images",
              scope,
            } );

            e.target.value = "";
          } }
          className="hidden"
        />
      </div>
    </DndContext>
  );
}

function SortableThumb( {
  id,
  url,
  onDelete,
}: {
  id: string;
  url: string;
  onDelete: () => void;
} ) {
  const {
    attributes, listeners, setNodeRef, transform, transition
  } = useSortable( {
    id
  } );

  const style = {
    transform: CSS.Transform.toString( transform ),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative h-20 bg-white"
    >
      <GripVertical
        className="absolute right-1 top-1 h-4 w-4 text-white cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      />

      <TrashIcon
        onClick={( e ) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute left-1 top-1 h-5 w-5 text-red-500 cursor-pointer bg-white opacity-50 active:opacity-100 hover:opacity-100 rounded p-0.5"
      />

      <img src={url} className="object-cover h-full w-full" alt={id} />
    </div>
  );
}
