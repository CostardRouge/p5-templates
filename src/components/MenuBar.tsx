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
      Icon: Paintbrush
    },
  ];

  // Only add recordings link after mount to avoid hydration mismatch
  if ( mounted && showRecordings ) {
    items.push( {
      href: "/recordings",
      Icon: Video
    }, );
  }

  return (
    <nav className="w-full glass px-2 py-1.5 flex justify-between items-center gap-1 z-50 border-t border-theme text-xs sm:text-sm">
      <Image
        alt="my p5*js templates"
        src="/assets/images/icon-512x512.png"
        className="px-2 py-1.5 hover:animate-spin"
        width={64}
        height={64}
      />

      <div className="flex flex-wrap items-center gap-2">
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
                "transition-all duration-200 flex flex-col items-center justify-center rounded-xl shadow-sm px-2 py-1 border border-theme ",
                active
                  ? "bg-hover border-active"
                  : "hover:bg-hover/50 hover:opacity-80"
              )}
            >
              <Icon className="inline w-4 mr-1" />
              <span className="">{name ?? href}</span>
            </Link>
          );
        } )}
      </div>

      <div className="flex items-center gap-2">
        <PushNotificationManager />
        <ThemeToggle
          iconClassName="h-5"
        />
      </div>
    </nav>
  );
}

export default MenuBar;