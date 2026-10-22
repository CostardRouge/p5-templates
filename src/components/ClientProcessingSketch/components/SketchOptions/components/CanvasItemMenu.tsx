"use client";

import {
  Check
} from "lucide-react";
import {
  useCallback, useEffect, useState
} from "react";
import {
  useFormContext
} from "react-hook-form";

import {
  VECTOR3D_VIEWS
} from "@/p5/utils/hud/vector3dViews";
import {
  CONTENT_ITEM_MENU_EVENT
} from "../constants/drawer-events";
import FieldContextMenu, {
  type FieldContextMenuItem
} from "./FieldContextMenu";

type MenuRequest = {
  scope: string;
  index: number;
  type: string;
  clientX: number;
  clientY: number;
};

/** The form path of a content item, from the drag layer's scope + index. */
function itemPath(
  scope: string, index: number
): string | null {
  if ( scope === "global" ) {
    return `content.${ index }`;
  }

  const slide = /^slide:(\d+)$/.exec( scope );

  return slide ? `slides.${ slide[ 1 ] }.content.${ index }` : null;
}

// Nothing marks the views that are not current; an empty icon keeps the
// labels aligned under the checked one.
function Blank( {
  className
}: { className?: string } ) {
  return <span className={ className } />;
}

/**
 * The menu a right-click on a content item opens on the canvas
 * (contentDrag.js dispatches CONTENT_ITEM_MENU_EVENT). Today only the
 * Vector 3D element has one: its five views, the current one checked. The
 * choice is written through the form, like any field edit, so it reaches the
 * sketch, the inspector's tiles and the undo history the same way.
 */
export default function CanvasItemMenu() {
  const {
    getValues, setValue
  } = useFormContext();
  const [
    request,
    setRequest
  ] = useState<MenuRequest | null>( null );

  useEffect(
    () => {
      const onMenu = ( event: Event ) => {
        const detail = ( event as CustomEvent<MenuRequest> ).detail;

        if ( detail && typeof detail.index === "number" ) {
          setRequest( detail );
        }
      };

      window.addEventListener(
        CONTENT_ITEM_MENU_EVENT,
        onMenu
      );

      return () => window.removeEventListener(
        CONTENT_ITEM_MENU_EVENT,
        onMenu
      );
    },
    []
  );

  const close = useCallback(
    () => setRequest( null ),
    []
  );

  if ( !request ) {
    return null;
  }

  const path = itemPath(
    request.scope,
    request.index
  );

  if ( !path || request.type !== "hud-vector3d" ) {
    return null;
  }

  const current = getValues( `${ path }.view` ) ?? "box";
  const items: FieldContextMenuItem[] = VECTOR3D_VIEWS.map( ( view ) => ( {
    label: view.label,
    icon: view.id === current ? Check : Blank,
    onClick: () => {
      setValue(
        `${ path }.view`,
        view.id,
        {
          shouldDirty: true,
          shouldTouch: true
        }
      );
    }
  } ) );

  return (
    <FieldContextMenu
      // The element usually sits at the canvas's right edge: keep the menu
      // (min-w-52, five 32 px rows) inside the window.
      position={ {
        x: Math.max(
          8,
          Math.min(
            request.clientX,
            window.innerWidth - 216
          )
        ),
        y: Math.max(
          8,
          Math.min(
            request.clientY,
            window.innerHeight - 184
          )
        )
      } }
      items={ items }
      onClose={ close }
    />
  );
}
