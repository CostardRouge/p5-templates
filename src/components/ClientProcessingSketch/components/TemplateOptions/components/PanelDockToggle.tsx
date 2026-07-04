import React from "react";
import {
  PanelLeft, PanelRight
} from "lucide-react";
import clsx from "clsx";

import type {
  PanelSide
} from "@/hooks/usePanelDock";

type PanelDockToggleProps = {
  side: PanelSide;
  docked: boolean;
  onToggle: () => void;
  className?: string;
};

/**
 * Small header affordance that sticks a floating panel to its screen side
 * (Figma-style dock) or releases it back to the floating bottom-corner card.
 * Desktop only — it is rendered from the desktop panel headers.
 */
export default function PanelDockToggle( {
  side,
  docked,
  onToggle,
  className
}: PanelDockToggleProps ) {
  const Icon = side === "left" ? PanelLeft : PanelRight;

  return (
    <button
      type="button"
      onClick={ ( e ) => {
        // Panel headers toggle collapse on click — keep the dock action local.
        e.stopPropagation();
        onToggle();
      } }
      title={ docked ? "Float panel" : "Stick to side" }
      aria-label={ docked ? "Float panel" : "Stick panel to side" }
      aria-pressed={ docked }
      className={ clsx(
        "grid h-6 w-6 shrink-0 place-items-center rounded transition-colors",
        docked
          ? "text-focus hover:text-focus"
          : "text-label hover:text-foreground",
        className
      ) }
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
