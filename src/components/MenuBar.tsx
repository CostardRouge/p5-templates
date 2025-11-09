import React from "react";
import {
  Github, Paintbrush, Video
} from "lucide-react";
import clsx from "clsx";
import Link from "next/link";
import {
  headers
} from "next/headers";
import ThemeToggle from "@/components/ThemeToggle";
import PushNotificationManager from "@/components/PushNotificationManager";

type NavItem = {
  href: string;
  name?: string;
  target?: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
};
type MenuBarProps = {
  searchParams?: Promise<{
    capturing?: string
  }>
}

async function MenuBar( {
  searchParams
}: MenuBarProps ) {
  const referer = ( await headers() ).get( "referer" );
  const pathname = referer ? ( new URL( referer ) ).pathname : "";

  if ( ( await searchParams )?.capturing === "" ) {
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

  if ( process.env.BACKEND_RECORDING === "true" ) {
    items.push( {
      href: "/recordings",
      Icon: Video
    }, );
  }

  return (
    <nav className="w-full glass px-2 py-1.5 flex justify-between items-center gap-1 z-50 border-t border-theme text-xs sm:text-sm">
      <p className="font-medium select-none text-foreground">
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
                "hover:opacity-80 flex flex-col items-center justify-center rounded-xl shadow-sm px-2 py-1 border border-theme border-b-2",
                {
                  "bg-hover": active
                }
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