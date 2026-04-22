import React, {
  useState, useEffect, useRef
} from "react";
import {
  Copy, Trash2, Edit2, Check
} from "lucide-react";
import clsx from "clsx";
import {
  DragBinder
} from "./ContentItems/ContentItems";
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
  dragBinder,
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
    isActive,
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
      ref={dragBinder?.setHandleRef}
      {...( dragBinder?.handleProps ?? {
      } )}
      className={clsx(
        "group relative flex flex-col gap-1",
        "cursor-pointer",
        {
          "opacity-50": dragBinder?.isDragging,
        }
      )}
      onClick={onSelect}
    >
      {/* Thumbnail Container */}
      <div
        className={clsx(
          "relative w-full overflow-hidden rounded-lg transition-all",
          {
            "outline outline-2 outline-offset-1 outline-primary": isActive,
            "outline outline-2 outline-offset-1 outline-transparent hover:outline-theme":
              !isActive,
          }
        )}
        style={{
          aspectRatio,
        }}
      >
        {liveEnabled ? (
          <>
            {/* Canvas stays mounted so its last frame is preserved when isActive
                goes false — this eliminates the white flash between live and static. */}
            <canvas
              ref={thumbCanvasRef}
              className="absolute inset-0 w-full h-full"
              style={{
                display: "block",
              }}
            />
            {/* Static img layers on top once inactive; canvas last-frame shows
                through during the brief img load so there is no blank gap. */}
            {!isActive && thumbnailUrl && (
              <img
                src={thumbnailUrl}
                alt={name}
                className="absolute inset-0 w-full h-full object-cover"
                style={{
                  transform: "translateZ(0)",
                }}
                draggable={false}
              />
            )}
            {!isActive && !thumbnailUrl && (
              <div className="absolute inset-0 w-full h-full bg-secondary/20 flex items-center justify-center p-2 text-center">
                <span className="text-xs text-muted-foreground font-medium truncate w-full">
                  {name}
                </span>
              </div>
            )}
          </>
        ) : thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={name}
            className="w-full h-full object-cover"
            style={{
              imageRendering: "auto",
              width: "100%",
              height: "100%",
              transform: "translateZ(0)",
            }}
            loading="lazy"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full bg-secondary/20 flex items-center justify-center p-2 text-center">
            <span className="text-xs text-muted-foreground font-medium truncate w-full">
              {name}
            </span>
          </div>
        )}

        {/* Overlay Actions */}
        <div className="absolute top-1 right-1 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={( e ) => {
              e.stopPropagation();
              onDuplicate();
            }}
            className="p-1 bg-background/80 backdrop-blur-sm rounded-md hover:bg-background text-foreground shadow-sm"
            title="Duplicate"
          >
            <Copy className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={( e ) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 bg-background/80 backdrop-blur-sm rounded-md hover:bg-red-100 text-red-500 shadow-sm"
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Name / Rename Input */}
      <div className="h-4 flex items-center justify-center px-1">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editedName}
            onChange={( e ) => setEditedName( e.target.value )}
            onBlur={handleRenameSubmit}
            onKeyDown={handleKeyDown}
            onPointerDown={( e ) => e.stopPropagation()}
            onMouseDown={( e ) => e.stopPropagation()}
            onTouchStart={( e ) => e.stopPropagation()}
            onDragStart={( e ) => e.preventDefault()}
            onClick={( e ) => e.stopPropagation()}
            className="w-full text-xs text-center bg-background border border-theme rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary cursor-text"
            autoFocus
          />
        ) : (
          <div
            className="flex items-center gap-1 max-w-full group/name"
            onDoubleClick={( e ) => {
              e.stopPropagation();
              setIsEditing( true );
            }}
          >
            <span className="text-xs text-foreground truncate font-medium">
              {name}
            </span>
            <button
              type="button"
              onClick={( e ) => {
                e.stopPropagation();
                setIsEditing( true );
              }}
              className="p-0 text-muted-foreground hover:text-foreground"
            >
              <Edit2 className="w-2.5 h-2.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
