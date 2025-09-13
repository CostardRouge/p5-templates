"use client";
import React from "react";
import {
  useController,
  useFormContext,
  FieldPathByValue,
} from "react-hook-form";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
  useSortable,
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
import type {
  SketchOptionInput
} from "@/types/sketch.types";

// ---------- small utils ----------
const isNonEmptyString = ( v: unknown ): v is string =>
  typeof v === "string" && v.trim().length > 0;

const asStringList = ( v: unknown ): string[] =>
  Array.isArray( v ) ? ( v as unknown[] ).filter( isNonEmptyString ) : [
  ];

const fileName = ( p: string ) => p.split( /[\\/]/ ).pop() || p;

// ---------- props ----------
type Props = {
  name: string;
};

export default function ControlledImagesStackInput( {
  name
}: Props ) {
  const {
    control
  } = useFormContext<SketchOptionInput>();

  const {
    field
  } = useController<
    SketchOptionInput,
    FieldPathByValue<SketchOptionInput, string[]>
  >( {
    name: name as FieldPathByValue<SketchOptionInput, string[]>,
    control,
  } );

  const {
    uploadFiles, maybeRemoveFromAssets
  } = useAssetsBridge();
  const {
    jobId
  } = useTemplateAssets();

  // DnD sensors (drag starts after pointer moved 5px)
  const sensors = useSensors( useSensor(
    PointerSensor,
    {
      activationConstraint: {
        distance: 5
      },
    }
  ) );

  // Current sanitized list (no empty strings)
  const items = React.useMemo(
    () => asStringList( field.value ),
    [
      field.value
    ]
  );

  // Self-heal the list if it contains empty strings (once per change)
  React.useEffect(
    () => {
    // Only run if original value had empties or non-array
      const v = field.value as unknown;
      const originalLen = Array.isArray( v ) ? v.length : 0;

      if ( originalLen !== items.length ) {
        field.onChange( items );
      }
    },
    [
      items
    ]
  );

  // Build stable unique ids even when paths repeat
  const rows = React.useMemo(
    () =>
      items.map( (
        p, i
      ) => ( {
        id: `${ p }#${ i }`, // unique per position
        path: p,
        url: resolveAssetURL(
          p,
          jobId
        ),
      } ) ),
    [
      items,
      jobId
    ]
  );

  const onFiles = React.useCallback(
    async( files: FileList ) => {
      const paths = await uploadFiles( files );
      const validNew = paths.filter( isNonEmptyString );

      if ( !validNew.length ) return;

      const previous = asStringList( field.value );

      field.onChange( [
        ...previous,
        ...validNew
      ] );
    },
    [
      field,
      uploadFiles
    ]
  );

  const onDelete = React.useCallback(
    ( idx: number ) => {
      const previous = asStringList( field.value );
      const removed = previous[ idx ];
      const next = previous.filter( (
        _, i
      ) => i !== idx );

      field.onChange( next );
      if ( isNonEmptyString( removed ) ) {
        // only try to remove real assets
        maybeRemoveFromAssets( removed );
      }
    },
    [
      field,
      maybeRemoveFromAssets
    ]
  );

  const onDragEnd = React.useCallback(
    ( evt: DragEndEvent ) => {
      const {
        active, over
      } = evt;

      if ( !over || active.id === over.id ) return;

      const indexById = new Map( rows.map( (
        r, i
      ) => [
        r.id,
        i
      ] ) );
      const oldIdx = indexById.get( String( active.id ) );
      const newIdx = indexById.get( String( over.id ) );

      if ( oldIdx == null || newIdx == null ) return;

      field.onChange( arrayMove(
        items,
        oldIdx,
        newIdx
      ) );
    },
    [
      field,
      items,
      rows
    ]
  );

  return (
    <div className="flex flex-col gap-2">
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="grid grid-cols-3 gap-1">
          <SortableContext items={rows.map( ( r ) => r.id )} strategy={rectSortingStrategy}>
            {rows.map( (
              r, i
            ) => (
              <SortableThumb
                key={r.id}
                id={r.id}
                url={r.url}
                alt={fileName( r.path )}
                onDelete={() => onDelete( i )}
              />
            ) )}
          </SortableContext>

          <DropZoneButton onFiles={onFiles} multiple className="h-20" />
        </div>
      </DndContext>
    </div>
  );
}

function SortableThumb( {
  id,
  url,
  alt,
  onDelete,
}: {
  id: string;
  url: string;
  alt: string;
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
      className="relative h-20 bg-white rounded-sm border border-gray-200 overflow-hidden"
    >
      <GripVertical
        className="absolute right-1 top-1 h-5 w-5 text-gray-600 cursor-grab active:cursor-grabbing bg-white/90 hover:bg-white rounded-sm border border-gray-200"
        {...attributes}
        {...listeners}
        aria-label="Drag handle"
        role="button"
        tabIndex={0}
      />

      <button
        type="button"
        onClick={( e ) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute left-1 top-1 h-5 w-5 text-center text-red-600 bg-white/90 hover:bg-white rounded border border-gray-200 p-0.5"
        aria-label="Remove image"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      {/* Guarded image: url is only built from non-empty path; add fallback UI just in case */}
      {url ? (
        <img src={url} className="object-cover h-full w-full" alt={alt} />
      ) : (
        <div className="h-full w-full grid place-items-center text-xs text-gray-400 bg-gray-50">
          Invalid image
        </div>
      )}
    </div>
  );
}
