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
  GripVertical, Settings2, Trash2, X
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

type Props = {
  name: string;
  /** Asset kind id (e.g. "images", "videos"). Defaults to "images". */
  kind?: string;
};

const fileName = ( p: string ) => p.split( /[\\/]/ ).pop() || p;

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
    attributes, listeners, setNodeRef, transform, transition
  } =
    useSortable( {
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
  const ParamsEditor = kind.ParamsEditor;

  return (
    <div
      ref={ setNodeRef }
      style={ style }
      className="relative h-20 bg-background rounded-lg border border-theme overflow-hidden"
    >
      <GripVertical
        className="absolute right-1 top-1 h-5 w-5 text-gray-600 cursor-grab active:cursor-grabbing bg-background/90 hover:bg-background rounded-md border border-theme z-10"
        { ...attributes }
        { ...listeners }
        aria-label="Drag handle"
        role="button"
        tabIndex={ 0 }
      />

      <button
        type="button"
        onClick={ ( e ) => {
          e.stopPropagation();
          onDelete();
        } }
        className="absolute left-1 top-1 h-5 w-5 text-center text-red-600 bg-background/90 hover:bg-background rounded-md border border-theme p-0.5 z-10"
        aria-label="Remove"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      {kind.hasParams && ParamsEditor ? (
        <button
          type="button"
          onClick={ ( e ) => {
            e.stopPropagation();
            setParamsOpen( ( v ) => !v );
          } }
          className="absolute right-1 bottom-1 h-5 w-5 text-foreground bg-background/90 hover:bg-background rounded-md border border-theme p-0.5 z-10"
          aria-label="Edit params"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </button>
      ) : null}

      <Preview url={ url } path={ instance.path } />

      {paramsOpen && ParamsEditor ? (
        <div
          className="absolute inset-x-0 bottom-0 z-20 bg-background border-t border-theme p-2 max-h-72 overflow-y-auto"
          onClick={ ( e ) => e.stopPropagation() }
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500 truncate" title={ instance.path }>
              {fileName( instance.path )}
            </span>
            <button
              type="button"
              onClick={ () => setParamsOpen( false ) }
              className="h-5 w-5 text-gray-500 hover:text-foreground"
              aria-label="Close params"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <ParamsEditor value={ instance.params } onChange={ onParamsChange } />
        </div>
      ) : null}
    </div>
  );
}
