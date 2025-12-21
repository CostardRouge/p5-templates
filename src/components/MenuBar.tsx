"use client";

import React, {
  useEffect, useState
} from "react";
import {
  Github, Paintbrush, Video
} from "lucide-react";
import clsx from "clsx";
import Link from "next/link";
import Image from "next/image";
import {
  usePathname, useSearchParams
} from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import PushNotificationManager from "@/components/PushNotificationManager";

type NavItem = {
  href: string;
  name?: string;
  target?: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
};

type MenuBarProps = {
  showRecordings?: boolean;
};

const BACKEND_RECORDING = process.env.NEXT_PUBLIC_BACKEND_RECORDING === "true";
const NOTIFICATIONS_ENABLED = process.env.NEXT_PUBLIC_NOTIFICATIONS === "true";
const SHOW_NOTIFICATIONS = BACKEND_RECORDING && NOTIFICATIONS_ENABLED;

function MenuBar( {
  showRecordings = false
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
    [
    ]
  );

  // Hide menu bar when in capturing mode
  if ( searchParams.get( "capturing" ) === "" ) {
    return null;
  }

  const items: NavItem[] = [
    {
      href: "https://github.com/CostardRouge/p5-templates",
      name: "//github",
      Icon: Github,
      target: "_blank",
    },
    {
      href: "/templates",
      Icon: Paintbrush,
    },
  ];

  // Only add recordings link after mount to avoid hydration mismatch
  if ( mounted && showRecordings ) {
    items.push( {
      href: "/recordings",
      Icon: Video,
    } );
  }

  return (
    <nav className="w-full glass px-4 py-3 flex justify-between items-center gap-4 z-50 border-t border-border backdrop-blur-xl bg-background/80">
      {/* Logo */}
      <Link
        href="/templates"
        className="group flex items-center gap-3 flex-shrink-0"
      >
        <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-border group-hover:border-foreground/30 transition-all duration-300 group-hover:shadow-lg group-hover:shadow-foreground/10">
          <Image
            alt="my p5*js templates"
            src="/assets/images/icon-512x512.png"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 group-hover:rotate-12"
            width={64}
            height={64}
          />
        </div>
        <span className="hidden sm:block text-sm font-semibold text-foreground group-hover:text-foreground/70 transition-colors">
          p5 templates
        </span>
      </Link>

      {/* Navigation Items */}
      <div className="flex items-center gap-2 flex-1 justify-center">
        {items.map( ( {
          href, name, Icon, target
        } ) => {
          const isInternal = href.startsWith( "/" );
          const active = isInternal && pathname.startsWith( href );

          return (
            <Link
              key={href}
              href={href}
              target={target}
              className={clsx(
                "group relative flex items-center gap-2 rounded-xl px-4 py-2 transition-all duration-300 text-sm font-medium",
                active
                  ? "bg-hover text-foreground shadow-sm"
                  : "text-foreground/70 hover:text-foreground hover:bg-hover/50"
              )}
            >
              <Icon className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" />
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
