"use client";

import clsx from "clsx";
import {
  ExternalLink, Github, Paintbrush, Video
} from "lucide-react";
import Link from "next/link";
import {
  usePathname, useSearchParams
} from "next/navigation";
import type React from "react";
import {
  useEffect, useState
} from "react";
import GenerateThumbnailsButton from "@/components/GenerateThumbnailsButton";
import PushNotificationManager from "@/components/PushNotificationManager";
import ThemeToggle from "@/components/ThemeToggle";
import {
  pauseSketchForNav
} from "@/lib/navigationPauseSignal";

type NavItem = {
  href: string;
  name?: string;
  target?: string;
  Icon?: React.FC<React.SVGProps<SVGSVGElement>>;
};

type MenuBarProps = {
  showRecordings?: boolean;
  hasMissingThumbnails?: boolean;
};

const BACKEND_RECORDING = process.env.NEXT_PUBLIC_BACKEND_RECORDING === "true";
const NOTIFICATIONS_ENABLED = process.env.NEXT_PUBLIC_NOTIFICATIONS === "true";
const SHOW_NOTIFICATIONS = BACKEND_RECORDING && NOTIFICATIONS_ENABLED;
const GITHUB_REPO_URL = process.env.NEXT_PUBLIC_GITHUB_REPO_URL;

function MenuBar( {
  showRecordings = false,
  hasMissingThumbnails = false
}: MenuBarProps ) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [
    mounted,
    setMounted
  ] = useState( false );

  useEffect(
    () => {
      setMounted( true );
    },
    []
  );

  // Hide menu bar when in capturing mode
  if ( searchParams.get( "capturing" ) === "" ) {
    return null;
  }

  const items: NavItem[] = [
    {
      href: "/templates",
      name: "templates",
      Icon: Paintbrush
    }
  ];

  // Only add recordings link after mount to avoid hydration mismatch
  if ( mounted && showRecordings ) {
    items.push( {
      href: "/recordings",
      name: "recordings",
      Icon: Video
    } );
  }

  if ( GITHUB_REPO_URL ) {
    items.push( {
      href: GITHUB_REPO_URL,
      name: "github",
      Icon: Github,
      target: "_blank"
    } );
  }

  items.push( ...[
    {
      href: "instagram.com/costardrouge.jpg",
      name: "instagram",
      target: "_blank",
      Icon: ExternalLink
    }
  ] );

  // Get all internal route prefixes except "/"
  const internalRoutes = items
    .filter( ( item ) => item.href.startsWith( "/" ) && item.href !== "/" )
    .map( ( item ) => item.href );

  const isActive = ( href: string ) => {
    if ( !href.startsWith( "/" ) ) {
      return false;
    }

    if ( href === "/" ) {
      // Home route is active if pathname is "/" or doesn't match any other internal route
      return (
        pathname === "/" ||
        !internalRoutes.some( ( route ) => pathname.startsWith( route ) )
      );
    }

    // Other routes use standard prefix matching
    return pathname.startsWith( href );
  };

  return (
    <nav className="w-full glass px-4 py-3 flex justify-between gap-4 z-50 border-t border-border backdrop-blur-xl bg-background/80">
      {/* Navigation Items */}
      <div className="flex items-center gap-2 justify-center">
        {items.map( ( {
          href, name, Icon, target
        } ) => {
          const active = isActive( href );

          return (
            <Link
              key={ href }
              href={ href }
              target={ target }
              onClick={ !target ? pauseSketchForNav : undefined }
              className={ clsx(
                "group relative flex items-center gap-2 rounded-xl px-4 py-2 transition-all duration-300 text-sm font-medium",
                active
                  ? "bg-hover text-foreground shadow-sm"
                  : "text-foreground/70 hover:text-foreground hover:bg-hover/50"
              ) }
            >
              {Icon ? (
                <Icon className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" />
              ) : null}
              <span className="hidden sm:inline">{name ?? href}</span>

              {/* Active indicator */}
              {active && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-0.5 bg-foreground rounded-full" />
              )}
            </Link>
          );
        } )}
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <GenerateThumbnailsButton hasMissingThumbnails={ hasMissingThumbnails } />
        {SHOW_NOTIFICATIONS && (
          <>
            <PushNotificationManager />
            <div className="w-px h-6 bg-border" />
          </>
        )}
        <ThemeToggle iconClassName="h-4" />
      </div>
    </nav>
  );
}

export default MenuBar;
