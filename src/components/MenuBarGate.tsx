"use client";

import {
  usePathname
} from "next/navigation";
import type React from "react";
import MenuBar from "@/components/MenuBar";

/**
 * Renders the global `MenuBar` everywhere except the `/embed` route, which is a
 * chrome-free sketch host meant to be framed inside other sites. The root
 * layout is shared across every route, so this client gate is the lightest way
 * to suppress the nav on embeds without splitting the layout tree.
 */
export default function MenuBarGate( props: React.ComponentProps<typeof MenuBar> ) {
  const pathname = usePathname();

  if ( pathname?.startsWith( "/embed" ) ) {
    return null;
  }

  return <MenuBar { ...props } />;
}
