"use client";

import React from "react";
import Link from "next/link";
import {
  usePathname, useSearchParams
} from "next/navigation";
import {
  Home, Video,
  Clock, Settings
} from "lucide-react";

import {
  ThemeToggle
} from "@/components/ThemeToggle";

type NavItem = {
 href: string;
 Icon: React.FC<React.SVGProps<SVGSVGElement>>
};

const items: NavItem[] = [
  {
    href: "/templates",
    Icon: Home
  },
  {
    href: "/recordings",
    Icon: Video
  },
  {
    href: "/automations",
    Icon: Clock
  },
  {
    href: "/settings",
    Icon: Settings
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if ( searchParams.has( "capturing" ) ) {
    return null;
  }

  return (
    <aside className="flex flex-col items-center w-16 bg-gray-50 dark:bg-gray-800">
      {/* <div className="my-4">*/}
      {/*  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg" />*/}
      {/* </div>*/}

      <nav className="flex-1 flex flex-col space-y-4 my-4">
        {items.map( ( {
          href, Icon
        } ) => {
          const active = pathname?.startsWith( href );

          return (
            <Link
              key={href}
              href={href}
              className={`p-2 rounded transition-colors ${
                active
                  ? "bg-gray-200 dark:bg-gray-700"
                  : "hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              <Icon className={`w-6 h-6 ${ active ? "text-blue-600 dark:text-blue-400" : "" }`} />
            </Link>
          );
        } )}

        <ThemeToggle />
      </nav>
    </aside>
  );
}