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
    <nav className="w-full bg-background px-2 py-1.5 flex justify-between items-center gap-1 border-t border-theme z-40 text-xs sm:text-sm">
      <p className="font-medium select-none text-foreground"
      >
        <span className="hover:animate-text-cycle w-full inline-block">my p5*js</span><br/>
        <span>templates</span>
      </p>

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
                "hover:opacity-80 flex flex-col items-center justify-center rounded-md shadow-sm sm:rounded-md px-2 py-1 border border-theme border-b-2",
                {
                  " bg-hover": active
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
      />
    </nav>
  );
}
