"use client";

import React, {
  useEffect, useState
} from "react";
// import Link from "next/link";
import {
  Github, Paintbrush, Video
} from "lucide-react";

import HardLink from "@/components/HardLink";
import clsx from "clsx";
import {
  usePathname
} from "next/navigation";

type NavItem = {
 href: string;
 name?: string;
 Icon: React.FC<React.SVGProps<SVGSVGElement>>
};

const items: NavItem[] = [
  // {
  //   href: "/",
  //   Icon: Home
  // },
  {
    href: "https://github.com/CostardRouge/p5-templates",
    name: "github",
    Icon: Github
  },
  {
    href: "/templates",
    Icon: Paintbrush
  },
  {
    href: "/recordings",
    Icon: Video
  },
  // {
  //   href: "/automations",
  //   Icon: Clock
  // },
  // {
  //   href: "/settings",
  //   Icon: Settings
  // },
];

export default function MenuBar() {
  const pathname = usePathname();

  const [
    isCapturing,
    setIsCapturing
  ] = useState<boolean>( false );

  useEffect(
    () => {
      setIsCapturing( window.location.search.includes( "capturing" ) );
    },
    [
    ]
  );

  if ( isCapturing ) {
    return null;
  }

  return (
    <nav className="h-14 w-full bg-gray-800 p-1 flex justify-center items-center gap-1 border-b border-gray-700 z-40">
      {items.map( ( {
        href, name, Icon
      } ) => {
        const active = pathname.startsWith( href );

        return (
          <HardLink
            key={href}
            href={href}
            className={
              clsx(
                "rounded-sm p-2 border border-gray-700 disabled:opacity-50 text-gray-200 bg-gray-900 text-xs hover:bg-gray-600",
                {
                  "text-white bg-black": active
                }
              )
            }
          >
            <Icon className="inline w-4 mr-1" />
            {name ?? href}
          </HardLink>
        );
      } )}
    </nav>
  );
}