"use client";

import React from "react";
import {
  Github, Paintbrush, Video
} from "lucide-react";
import HardLink from "@/components/HardLink";
import clsx from "clsx";
import {
  usePathname, useSearchParams
} from "next/navigation";

type NavItem = {
  href: string;
  name?: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
};

const items: NavItem[] = [
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
];

export default function MenuBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isCapturing = searchParams?.has( "capturing" ) ?? false;

  if ( isCapturing ) return null;

  return (
    <nav className="h-14 w-full bg-gray-800 p-1 flex justify-center items-center gap-1 border-b border-gray-700 z-40">
      {items.map( ( {
        href, name, Icon
      } ) => {
        const isInternal = href.startsWith( "/" );
        const active = isInternal && pathname.startsWith( href );

        return (
          <HardLink
            key={href}
            href={href}
            className={clsx(
              "rounded-sm p-2 border border-gray-700 disabled:opacity-50 text-gray-200 bg-gray-900 text-xs hover:bg-gray-600",
              {
                "text-white bg-black": active
              }
            )}
          >
            <Icon className="inline w-4 mr-1" />
            {name ?? href}
          </HardLink>
        );
      } )}
    </nav>
  );
}
