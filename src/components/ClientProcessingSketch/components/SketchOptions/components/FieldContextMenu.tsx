"use client";

import React, {
  useCallback, useEffect, useState
} from "react";
import {
  createPortal
} from "react-dom";

export type FieldContextMenuItem = {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: () => void;
};

type Position = {
  x: number;
  y: number;
};

/**
 * Lightweight right-click context menu state. Kept out of the render tree until
 * opened so fields carry zero permanent visual weight — the anti-clutter goal
 * for per-field actions like "apply this value to all slides".
 */
export function useFieldContextMenu(): {
  position: Position | null;
  open: ( event: React.MouseEvent ) => void;
  close: () => void;
} {
  const [
    position,
    setPosition
  ] = useState<Position | null>( null );

  const open = useCallback(
    ( event: React.MouseEvent ) => {
      event.preventDefault();
      event.stopPropagation();
      setPosition( {
        x: event.clientX,
        y: event.clientY
      } );
    },
    []
  );

  const close = useCallback(
    () => setPosition( null ),
    []
  );

  return {
    position,
    open,
    close
  };
}

type FieldContextMenuProps = {
  position: Position;
  items: FieldContextMenuItem[];
  onClose: () => void;
};

/**
 * Portal-rendered menu positioned at the cursor. Closes on outside click,
 * scroll, resize or Escape. Styling mirrors the app's other floating menus.
 */
export default function FieldContextMenu( {
  position,
  items,
  onClose
}: FieldContextMenuProps ) {
  useEffect(
    () => {
      const handleKey = ( event: KeyboardEvent ) => {
        if ( event.key === "Escape" ) {
          onClose();
        }
      };

      window.addEventListener(
        "keydown",
        handleKey
      );
      window.addEventListener(
        "resize",
        onClose
      );
      window.addEventListener(
        "scroll",
        onClose,
        true
      );

      return () => {
        window.removeEventListener(
          "keydown",
          handleKey
        );
        window.removeEventListener(
          "resize",
          onClose
        );
        window.removeEventListener(
          "scroll",
          onClose,
          true
        );
      };
    },
    [
      onClose
    ]
  );

  if ( typeof document === "undefined" ) {
    return null;
  }

  return createPortal(
    <>
      {/* Full-screen catcher closes the menu on any outside interaction. */}
      <div
        className="fixed inset-0 z-[80]"
        onClick={ onClose }
        onContextMenu={ ( event ) => {
          event.preventDefault();
          onClose();
        } }
      />
      <div
        className="fixed z-[81] min-w-52 overflow-hidden rounded-xl border border-border bg-background/95 backdrop-blur-xl shadow-xl py-1"
        style={ {
          top: position.y,
          left: position.x
        } }
        onClick={ ( event ) => event.stopPropagation() }
      >
        {items.map( ( item ) => {
          const Icon = item.icon;

          return (
            <button
              key={ item.label }
              type="button"
              onClick={ () => {
                item.onClick();
                onClose();
              } }
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground hover:bg-hover transition-colors"
            >
              {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
              <span className="truncate">
                {item.label}
              </span>
            </button>
          );
        } )}
      </div>
    </>,
    document.body
  );
}
