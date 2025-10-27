"use client";

import React from "react";
import {
  Github, Paintbrush, Video
} from "lucide-react";
import clsx from "clsx";
import {
  usePathname, useSearchParams
} from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

type NavItem = {
  href: string;
  name?: string;
  target?: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
};

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
    <nav className="h-14 w-full bg-background p-1 flex justify-between items-center gap-1 border-b border-theme z-40 text-xs sm:text-sm">
      <p className="font-medium select-none w-20 text-foreground pl-1"
      >
        <span className="hover:animate-text-cycle w-full inline-block">my p5*js</span><br/>
        <span>templates</span>
      </p>

      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
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
                "hover:opacity-80 flex flex-col items-center justify-center",
                {
                  "font-bold": active
                }
              )}
            >
              <Icon className="inline w-4 mr-1" />
              <span className="">{name ?? href}</span>
            </Link>
          );
        } )}
      </div>

      <ThemeToggle
        iconClassName="h-5"
        className="pr-1"
      />
    </nav>
  );
}
