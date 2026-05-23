"use client";

import clsx from "clsx";
import type {
  LucideIcon
} from "lucide-react";

export type TabId = "sketch" | "slides" | "content" | "settings" | "export";

export type TabDef = {
  id: TabId;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

type SheetTabBarProps = {
  tabs: TabDef[];
  active: TabId;
  onChange: ( id: TabId ) => void;
};

export default function SheetTabBar( {
  tabs, active, onChange
}: SheetTabBarProps ) {
  return (
    <div
      className="flex items-stretch gap-1 overflow-x-auto pb-1 -mx-2 px-2 scrollbar-none"
      role="tablist"
      aria-label="Options sections"
    >
      {tabs.map( ( tab ) => {
        const Icon = tab.icon;
        const isActive = tab.id === active;

        return (
          <button
            key={ tab.id }
            type="button"
            role="tab"
            aria-selected={ isActive }
            onClick={ () => onChange( tab.id ) }
            className={ clsx(
              "flex-1 min-w-[64px] flex flex-col items-center justify-center gap-0.5 py-2 px-2 rounded-lg transition-colors text-[11px] font-medium",
              isActive
                ? "bg-foreground/10 text-foreground"
                : "text-foreground/60 hover:text-foreground hover:bg-foreground/5"
            ) }
          >
            <span className="relative inline-flex">
              <Icon className="h-5 w-5" />
              {typeof tab.badge === "number" && tab.badge > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-foreground text-background text-[10px] font-semibold flex items-center justify-center">
                  {tab.badge}
                </span>
              )}
            </span>
            <span>{tab.label}</span>
          </button>
        );
      } )}
    </div>
  );
}
