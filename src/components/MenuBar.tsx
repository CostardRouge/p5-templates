"use client";

import React, {
  useEffect,
  useState
} from "react";
// import Link from "next/link";
import {
  usePathname
} from "next/navigation";
import {
  Video,
  Paintbrush,
  Clock,
  Settings
  // Home
} from "lucide-react";

import HardLink from "@/components/HardLink";

// import {
//   ThemeToggle
// } from "@/components/ThemeToggle";

type NavItem = {
 href: string;
 Icon: React.FC<React.SVGProps<SVGSVGElement>>
};

const items: NavItem[] = [
  // {
  //   href: "/",
  //   Icon: Home
  // },
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
  // const pathname = usePathname();

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
    <nav className="h-14 bg-gray-800 px-2 flex gap-1 items-center justify-center w-full border-t border-gray-700 z-40">
      {items.map( ( {
        href, Icon
      } ) => {
        // const active = pathname.startsWith( href );

        return (
          <HardLink
            key={href}
            href={href}
            className={"rounded-sm p-2 border border-gray-700 disabled:opacity-50 text-gray-200 bg-gray-900 text-sm hover:bg-gray-600 active:text-white"}
          >
            <Icon className={"inline w-4 h-4"} />
            <span>&nbsp;{href}</span>
          </HardLink>
        );
      } )}
    </nav>
  );
}