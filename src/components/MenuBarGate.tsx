"use client";

import {
  usePathname
} from "next/navigation";
import type React from "react";
import MenuBar from "@/components/MenuBar";
import usePresentationMode from "@/hooks/usePresentationMode";

/**
 * Renders the global `MenuBar` everywhere except the `/embed` route, which is a
 * chrome-free sketch host meant to be framed inside other sites, and while a
 * sketch is being presented with the interface hidden. The root layout is
 * shared across every route, so this client gate is the lightest way to
 * suppress the nav without splitting the layout tree — and it is the only place
 * that can, since the menu bar lives outside the sketch page's tree.
 */
export default function MenuBarGate( props: React.ComponentProps<typeof MenuBar> ) {
  const pathname = usePathname();
  const {
    hideInterface
  } = usePresentationMode();

  if ( hideInterface || pathname?.startsWith( "/embed" ) ) {
    return null;
  }

  return <MenuBar { ...props } />;
}
