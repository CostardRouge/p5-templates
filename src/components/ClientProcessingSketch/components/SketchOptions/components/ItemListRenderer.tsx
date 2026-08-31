import React, {
  useEffect, useRef, useState
} from "react";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import {
  restrictToParentElement,
  restrictToVerticalAxis
} from "@dnd-kit/modifiers";
import {
  CSS
} from "@dnd-kit/utilities";
import {
  useFormContext, useWatch
} from "react-hook-form";
import {
  ChevronDown, GripVertical, Plus, Trash2
} from "lucide-react";
import clsx from "clsx";
import FieldRenderer from "./FieldRenderer";
import CollapsibleItem from "@/components/CollapsibleItem";
import type {
  FieldConfig
} from "./ContentItems/constants/field-config";
import {
  useCollapsibleContext
} from "../hooks/useCollapsibleStates";
import {
  getSharedCollapsibleKey
} from "../utils/getSharedCollapsibleKey";

type ItemListRendererProps = {
  name: string;
  config: {
    component: "item-list";
    itemConfig: FieldConfig;
    minItems?: number;
    maxItems?: number;
    defaultItems?: any[];
    locked?: boolean;
    label?: string;
  };
  /** Nesting level, threaded from FieldRenderer — see its own doc comment.
   *  Depth 0 renders the header as a full-bleed band, exactly like a
   *  nested-object group at the same depth, so a section's fields read as one
   *  family regardless of which component backs each one. */
  depth?: number;
  /** Horizontal padding a depth-0 band applies to its own header, so the band
   *  itself can stay full-bleed. */
  leafPaddingClassName?: string;
};

type SortableItemProps = {
  id: string;
  fieldPath: string;
  itemConfig: FieldConfig;
  onRemove: () => void;
  locked?: boolean;
};

function createId() {
  if ( typeof crypto !== "undefined" && "randomUUID" in crypto ) {
    return crypto.randomUUID();
  }
  return `${ Date.now() }-${ Math.random().toString( 16 )
    .slice( 2 ) }`;
}

function arrayMove<T>(
  arr: T[], fromIndex: number, toIndex: number
) {
  const next = arr.slice();
  const [
    item
  ] = next.splice(
    fromIndex,
    1
  );

  next.splice(
    toIndex,
    0,
    item
  );
  return next;
}

function SortableItem( {
  id,
  fieldPath,
  itemConfig,
  onRemove,
  locked
}: SortableItemProps ) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable( {
    id
  } );

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString( transform ),
    transition
  };

  return (
    <div
      ref={ setNodeRef }
      style={ style }
      // A border, not just the space-y gap between rows: bg-background on a
      // bg-background/50 parent (see the box below) painted the same color as
      // the parent it sits in, so items had no visible edge of their own —
      // exactly what the parent's own "Add Item" row already avoids with this
      // same border.
      className={ clsx(
        "relative flex items-center gap-1 p-1 rounded-lg border border-theme bg-background",
        "data-[dragging=true]:opacity-70"
      ) }
      data-dragging={ isDragging ? "true" : "false" }
    >
      <button
        type="button"
        ref={ setActivatorNodeRef }
        { ...attributes }
        { ...listeners }
        className="cursor-grab active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-3.5 text-foreground" />
      </button>

      <div className="flex-1">
        <FieldRenderer
          fieldBasePath={ fieldPath }
          fieldName=""
          config={ itemConfig }
          hideLabel={ true }
        />
      </div>

      {!locked && (
        <button
          type="button"
          onClick={ onRemove }
          className="text-red-500 hover:text-red-700"
          aria-label="Remove item"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export default function ItemListRenderer( {
  name,
  config,
  depth = 0,
  leafPaddingClassName = "px-3"
}: ItemListRendererProps ) {
  const isBand = depth === 0;

  const {
    control, getValues, setValue
  } = useFormContext();

  const {
    getExpanded, setExpanded
  } = useCollapsibleContext();

  const collapsibleKey = `list-${ getSharedCollapsibleKey( name ) }`;
  const expanded = getExpanded(
    collapsibleKey,
    false
  );

  const watchedValue = useWatch( {
    control,
    name
  } );

  const values = Array.isArray( watchedValue ) ? watchedValue : [];

  const [
    itemIds,
    setItemIds
  ] = useState<string[]>( [] );
  const didInitRef = useRef( false );

  // Initialize values once (defaults/minItems) without clobbering existing values.
  useEffect(
    () => {
      if ( didInitRef.current ) {
        return;
      }

      const currentValue = getValues( name );
      const hasExistingValues =
        Array.isArray( currentValue ) && currentValue.length > 0;

      if ( !hasExistingValues ) {
        if ( config.defaultItems && config.defaultItems.length > 0 ) {
          setValue(
            name,
            config.defaultItems,
            {
              shouldDirty: false,
              shouldTouch: false
            }
          );
        } else if ( config.minItems && config.minItems > 0 ) {
          setValue(
            name,
            Array.from(
              {
                length: config.minItems
              },
              () =>
                getDefaultValueForConfig( config.itemConfig )
            ),
            {
              shouldDirty: false,
              shouldTouch: false
            }
          );
        }
      }

      didInitRef.current = true;
    },
    [
      config.defaultItems,
      config.itemConfig,
      config.minItems,
      getValues,
      name,
      setValue
    ]
  );

  // Keep stable ids aligned with array length.
  useEffect(
    () => {
      setItemIds( ( prev ) => {
        const next = prev.slice(
          0,
          values.length
        );

        while ( next.length < values.length ) {
          next.push( createId() );
        }
        return next;
      } );
    },
    [
      values.length
    ]
  );

  const sensors = useSensors(
    useSensor(
      MouseSensor,
      {
        activationConstraint: {
          distance: 8
        }
      }
    ),
    useSensor(
      TouchSensor,
      {
        activationConstraint: {
          delay: 200,
          tolerance: 5
        }
      }
    ),
    useSensor( KeyboardSensor )
  );

  const handleDragEnd = ( event: DragEndEvent ) => {
    const {
      active, over
    } = event;

    if ( !over || active.id === over.id ) {
      return;
    }

    const oldIndex = itemIds.indexOf( String( active.id ) );
    const newIndex = itemIds.indexOf( String( over.id ) );

    if ( oldIndex < 0 || newIndex < 0 || oldIndex === newIndex ) {
      return;
    }

    const currentValue = getValues( name );
    const currentArray = Array.isArray( currentValue ) ? currentValue : [];

    setItemIds( ( prev ) => arrayMove(
      prev,
      oldIndex,
      newIndex
    ) );
    setValue(
      name,
      arrayMove(
        currentArray,
        oldIndex,
        newIndex
      ),
      {
        shouldDirty: true,
        shouldTouch: true
      }
    );
  };

  const handleAdd = () => {
    if ( config.locked ) {
      return;
    }
    if ( config.maxItems && values.length >= config.maxItems ) {
      return;
    }

    const next = values.concat( getDefaultValueForConfig( config.itemConfig ) );

    setValue(
      name,
      next,
      {
        shouldDirty: true,
        shouldTouch: true
      }
    );
    setItemIds( ( prev ) => prev.concat( createId() ) );
  };

  const handleRemove = ( index: number ) => {
    if ( config.locked ) {
      return;
    }
    if ( config.minItems && values.length <= config.minItems ) {
      return;
    }

    const next = values.slice(
      0,
      index
    ).concat( values.slice( index + 1 ) );

    setValue(
      name,
      next,
      {
        shouldDirty: true,
        shouldTouch: true
      }
    );

    setItemIds( ( prev ) => prev.slice(
      0,
      index
    ).concat( prev.slice( index + 1 ) ) );
  };

  return (
    <div className="text-xs">
      <CollapsibleItem
        expanded={ expanded }
        onToggle={ ( isExpanded ) => setExpanded(
          collapsibleKey,
          isExpanded
        ) }
        header={ (
          expanded, title
        ) => (
          // Same header shape as a nested-object group at this depth (see
          // FieldRenderer) — chevron size/color, text color and vertical
          // rhythm all matched, so this list reads as one more field in the
          // section rather than a visually distinct component.
          <div
            className={ clsx(
              "cursor-pointer select-none flex items-center justify-between w-full gap-2 min-h-[2.5rem] md:min-h-0",
              isBand
                ? clsx(
                  "py-2 md:py-1.5",
                  leafPaddingClassName
                )
                : "py-1.5 md:py-1 text-label"
            ) }
            title={ title }
          >
            <div className="flex min-w-0 items-center gap-1.5">
              <ChevronDown
                className="w-4 h-4 md:w-3 md:h-3 shrink-0 text-label transition-transform"
                style={ {
                  transform: expanded ? "rotate(0deg)" : "rotate(-90deg)"
                } }
              />
              <span
                className={ clsx(
                  "truncate text-label",
                  isBand && "text-xs"
                ) }
              >
                {config.label ?? "Items"} ({values.length} items)
              </span>
            </div>
          </div>
        ) }
      >
        {/* Same outer treatment as a nested-object body at this depth: a
            band pads its own bottom/horizontal space (leafPaddingClassName),
            a deeper list falls back to the indent guide. The bordered box
            below it is specific to this component — item rows are draggable
            and benefit from a visible drop zone that nested-object's flat
            field list doesn't need. */}
        <div
          className={ clsx( isBand
            ? clsx(
              "pb-2 pt-0.5",
              leafPaddingClassName
            )
            : "ml-1.5 border-l border-theme pl-2.5 pb-1" ) }
        >
          <div className="space-y-1 p-1 border border-theme rounded-xl bg-background/50">
            <DndContext
              sensors={ sensors }
              collisionDetection={ closestCenter }
              onDragEnd={ handleDragEnd }
              modifiers={ [
                restrictToVerticalAxis,
                restrictToParentElement
              ] }
            >
              <SortableContext
                items={ itemIds }
                strategy={ verticalListSortingStrategy }
              >
                {itemIds.map( (
                  id, index
                ) => (
                  <SortableItem
                    key={ id }
                    id={ id }
                    fieldPath={ `${ name }.${ index }` }
                    itemConfig={ config.itemConfig }
                    onRemove={ () => handleRemove( index ) }
                    locked={ config.locked }
                  />
                ) )}
              </SortableContext>
            </DndContext>

            {!config.locked &&
              ( !config.maxItems || values.length < config.maxItems ) && (
              <button
                type="button"
                onClick={ handleAdd }
                className="w-full flex items-center gap-1 px-1 py-1 border border-theme rounded-lg bg-background hover:bg-theme/10"
              >
                <Plus className="h-4 w-4" />
                Add Item
              </button>
            )}
          </div>
        </div>
      </CollapsibleItem>
    </div>
  );
}

function getDefaultValueForConfig( config: FieldConfig ): any {
  switch ( config.component ) {
    case "text":
    case "textarea":
      return "";
    case "number": {
      return config.min ?? 0;
    }
    case "slider": {
      return config.min ?? 0;
    }
    case "checkbox":
      return false;
    case "color":
      return [
        255,
        255,
        255
      ];
    case "select": {
      return config.options[ 0 ]?.value ?? "";
    }
    // The pad edits an { x, y } pair in place: without a shaped default a new
    // row starts as "" and the pad has nothing to bind to. Centre of the range
    // is the neutral choice — the middle of the pad, whatever its bounds.
    case "vector2d": {
      const min = config.min ?? ( config.allowNegative === false ? 0 : -1 );
      const max = config.max ?? 1;
      const center = ( min + max ) / 2;

      return {
        x: center,
        y: center
      };
    }
    case "nested-object": {
      const obj: Record<string, any> = {};

      for ( const [
        key,
        subConfig
      ] of Object.entries( config.fields ) ) {
        obj[ key ] = getDefaultValueForConfig( subConfig );
      }
      return obj;
    }
    default:
      return "";
  }
}
