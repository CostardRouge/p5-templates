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

const menuLinkClassName = "rounded p-2 bg-background text-foreground";

export default function MenuBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isCapturing = searchParams?.has( "capturing" ) ?? false;

  if ( isCapturing ) return null;

  return (
    <nav className="h-14 w-full bg-background p-1 flex justify-between items-center gap-1 border-b border-theme z-40">
      <p className={
        clsx(
          "font-medium select-none",
          menuLinkClassName
        )
      }>
        p5 templates
      </p>

      <div>
        {items.map( ( {
          href, name, Icon, target
        } ) => {
          const isInternal = href.startsWith( "/" );
          const active = isInternal && pathname.startsWith( href );

          return (
            <HardLink
              key={href}
              href={href}
              target={target}
              className={clsx(
                menuLinkClassName,
                "hover:opacity-80",
                {
                  "font-bold": active
                }
              )}
            >
              <Icon className="inline w-4 mr-1" />
              {name ?? href}
            </HardLink>
          );
        } )}
      </div>

      <ThemeToggle
        iconClassName={"h-5"}
        className={menuLinkClassName}
      />
    </nav>
  );
}
