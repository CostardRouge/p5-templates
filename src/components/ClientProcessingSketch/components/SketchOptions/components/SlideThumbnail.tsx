import React, {
  useState, useEffect, useRef
} from "react";
import {
  Copy, Trash2, Check
} from "lucide-react";
import clsx from "clsx";
import {
  DragBinder
} from "./SortableRow";
import {
  useLiveThumbnail
} from "../utils/useLiveThumbnail";

interface SlideThumbnailProps {
  id: string;
  name: string;
  isActive: boolean;
  thumbnailUrl: string | null;
  aspectRatio: number;
  onSelect: () => void;
  onRename: ( newName: string ) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  dragBinder?: DragBinder;
}

export default function SlideThumbnail( {
  id,
  name,
  isActive,
  thumbnailUrl,
  aspectRatio,
  onSelect,
  onRename,
  onDelete,
  onDuplicate,
  dragBinder
}: SlideThumbnailProps ) {
  const [
    isEditing,
    setIsEditing
  ] = useState( false );
  const [
    editedName,
    setEditedName
  ] = useState( name );
  const inputRef = useRef<HTMLInputElement>( null );
  const thumbCanvasRef = useRef<HTMLCanvasElement>( null );
  const liveEnabled = useLiveThumbnail( {
    thumbCanvasRef,
    isActive
  } );

  useEffect(
    () => {
      setEditedName( name );
    },
    [
      name
    ]
  );

  useEffect(
    () => {
      if ( isEditing && inputRef.current ) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    },
    [
      isEditing
    ]
  );

  const handleRenameSubmit = () => {
    if ( editedName.trim() ) {
      onRename( editedName.trim() );
    } else {
      setEditedName( name ); // Revert if empty
    }
    setIsEditing( false );
  };

  const handleKeyDown = ( e: React.KeyboardEvent ) => {
    if ( e.key === "Enter" ) {
      handleRenameSubmit();
    } else if ( e.key === "Escape" ) {
      setEditedName( name );
      setIsEditing( false );
    }
  };

  return (
    <div
      ref={ dragBinder?.setHandleRef }
      { ...( dragBinder?.handleProps ?? {} ) }
      className={ clsx(
        "group relative cursor-pointer",
        {
          "opacity-50": dragBinder?.isDragging
        }
      ) }
      onClick={ onSelect }
    >
      {/* Thumbnail Container */}
      <div
        className={ clsx(
          "relative w-full overflow-hidden rounded-lg transition-all",
          {
            // "primary" was never a defined Tailwind color (no --primary token
            // in globals.css / tailwind.config.ts) — the active ring silently
            // rendered as nothing. "focus" is the token globals.css itself
            // documents as the ring/outline color.
            "outline outline-2 outline-offset-1 outline-focus": isActive,
            "outline outline-2 outline-offset-1 outline-transparent hover:outline-theme":
              !isActive
          }
        ) }
        style={ {
          aspectRatio
        } }
      >
        {liveEnabled ? (
          <>
            {/* Canvas stays mounted so its last frame is preserved when isActive
                goes false — this eliminates the white flash between live and static. */}
            <canvas
              ref={ thumbCanvasRef }
              className="absolute inset-0 w-full h-full"
              style={ {
                display: "block"
              } }
            />
            {/* Static img layers on top once inactive; canvas last-frame shows
                through during the brief img load so there is no blank gap. */}
            {!isActive && thumbnailUrl && (
              <img
                src={ thumbnailUrl }
                alt={ name }
                className="absolute inset-0 w-full h-full object-cover"
                style={ {
                  transform: "translateZ(0)"
                } }
                draggable={ false }
              />
            )}
            {!isActive && !thumbnailUrl && (
              <div className="absolute inset-0 w-full h-full bg-hover flex items-center justify-center p-2 text-center">
                <span className="text-xs text-label font-medium truncate w-full">
                  {name}
                </span>
              </div>
            )}
          </>
        ) : thumbnailUrl ? (
          <img
            src={ thumbnailUrl }
            alt={ name }
            className="w-full h-full object-cover"
            style={ {
              imageRendering: "auto",
              width: "100%",
              height: "100%",
              transform: "translateZ(0)"
            } }
            loading="lazy"
            draggable={ false }
          />
        ) : (
          <div className="w-full h-full bg-hover flex items-center justify-center p-2 text-center">
            <span className="text-xs text-label font-medium truncate w-full">
              {name}
            </span>
          </div>
        )}

        {/* Name badge — the slide is named *inside* its own tile, so the cell
            stays a plain rectangle. That is what lets the strip use one
            uniform padding and keep the tile's radius concentric with the
            filmstrip card's; a name line under the thumbnail forced 6px above
            it against 26px below and made the radii impossible to reconcile.
            Clicking the badge renames — the hover toolbar stays at two
            buttons, since a third would be wider than the tile itself. */}
        {isEditing ? (
          <input
            ref={ inputRef }
            type="text"
            value={ editedName }
            onChange={ ( e ) => setEditedName( e.target.value ) }
            onBlur={ handleRenameSubmit }
            onKeyDown={ handleKeyDown }
            onPointerDown={ ( e ) => e.stopPropagation() }
            onMouseDown={ ( e ) => e.stopPropagation() }
            onTouchStart={ ( e ) => e.stopPropagation() }
            onDragStart={ ( e ) => e.preventDefault() }
            onClick={ ( e ) => e.stopPropagation() }
            className="absolute top-1 left-1 right-1 z-10 text-xs bg-background border border-theme rounded-md px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-focus cursor-text"
            autoFocus
          />
        ) : (
          <button
            type="button"
            onClick={ ( e ) => {
              e.stopPropagation();
              setIsEditing( true );
            } }
            onPointerDown={ ( e ) => e.stopPropagation() }
            className="glass absolute top-1 left-1 z-10 max-w-[calc(100%-0.5rem)] truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-tight text-foreground hover:bg-hover"
            title="Rename slide"
          >
            {name}
          </button>
        )}

        {/* Overlay Actions — one toolbar on a bottom scrim, not two icons
            pinned on the artwork. Always visible on touch (no hover state to
            reveal it), fades in on desktop hover/focus like the old corner
            icons did. */}
        <div className="absolute inset-x-0 bottom-0 flex justify-center pb-1.5 pt-6 bg-gradient-to-t from-black/45 to-transparent opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity">
          {/* rounded-lg, not a pill: the block echoes the tile's own radius so
              it reads as part of the thumbnail rather than a badge dropped on
              it. Buttons are rounded-md so they nest inside it correctly. */}
          <div className="glass flex gap-0.5 rounded-lg p-0.5 shadow-sm">
            <button
              type="button"
              onClick={ ( e ) => {
                e.stopPropagation();
                onDuplicate();
              } }
              className="flex items-center justify-center w-7 h-7 rounded-md text-foreground hover:bg-hover"
              title="Duplicate"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={ ( e ) => {
                e.stopPropagation();
                onDelete();
              } }
              className="flex items-center justify-center w-7 h-7 rounded-md text-foreground hover:bg-red-500/15 hover:text-red-500"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
