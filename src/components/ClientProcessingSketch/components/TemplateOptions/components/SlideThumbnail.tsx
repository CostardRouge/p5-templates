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

interface SlideThumbnailProps {
    id: string;
    name: string;
    isActive: boolean;
    thumbnailUrl: string | null;
    aspectRatio: number;
    onSelect: () => void;
    onRename: (newName: string) => void;
    onDelete: () => void;
    onDuplicate: () => void;
    dragBinder?: DragBinder;
}

export default function SlideThumbnail({
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
}: SlideThumbnailProps) {
    const [
        isEditing,
        setIsEditing
    ] = useState(false);
    const [
        editedName,
        setEditedName
    ] = useState(name);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(
        () => {
            setEditedName(name);
        },
        [
            name
        ]
    );

    useEffect(
        () => {
            if (isEditing && inputRef.current) {
                inputRef.current.focus();
                inputRef.current.select();
            }
        },
        [
            isEditing
        ]
    );

    const handleRenameSubmit = () => {
        if (editedName.trim()) {
            onRename(editedName.trim());
        } else {
            setEditedName(name); // Revert if empty
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleRenameSubmit();
        } else if (e.key === "Escape") {
            setEditedName(name);
            setIsEditing(false);
        }
    };

    return (
        <div
            ref={dragBinder?.setHandleRef}
            {...(dragBinder?.handleProps ?? {})}
            className={clsx(
                "group relative flex flex-col gap-1",
                "cursor-pointer",
                {
                    "opacity-50": dragBinder?.isDragging
                }
            )}
            onClick={onSelect}
        >
            {/* Thumbnail Container */}
            <div
                className={clsx(
                    "relative w-full overflow-hidden rounded-lg border-2 transition-all",
                    {
                        "border-primary shadow-md": isActive,
                        "border-transparent hover:border-theme": !isActive,
                    }
                )}
                style={{
                    aspectRatio
                }}
            >
                {thumbnailUrl ? (
                    <img
                        src={thumbnailUrl}
                        alt={name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full bg-secondary/20 flex items-center justify-center p-2 text-center">
                        <span className="text-xs text-muted-foreground font-medium truncate w-full">
                            {name}
                        </span>
                    </div>
                )}

                {/* Overlay Actions */}
                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        type="button"
                        onClick={(e) => {
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
                        onClick={(e) => {
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
            <div className="h-6 flex items-center justify-center px-1">
                {isEditing ? (
                    <div className="flex items-center gap-1 w-full">
                        <input
                            ref={inputRef}
                            type="text"
                            value={editedName}
                            onChange={(e) => setEditedName(e.target.value)}
                            onBlur={handleRenameSubmit}
                            onKeyDown={handleKeyDown}
                            className="w-full text-xs bg-background border border-theme rounded px-1 py-0.5 focus:outline-none focus:border-primary"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                ) : (
                    <div
                        className="flex items-center gap-1 max-w-full group/name"
                        onDoubleClick={(e) => {
                            e.stopPropagation();
                            setIsEditing(true);
                        }}
                    >
                        <span className="text-xs text-foreground truncate font-medium">
                            {name}
                        </span>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsEditing(true);
                            }}
                            className="opacity-0 group-hover/name:opacity-100 transition-opacity p-0.5 text-muted-foreground hover:text-foreground"
                        >
                            <Edit2 className="w-2.5 h-2.5" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
