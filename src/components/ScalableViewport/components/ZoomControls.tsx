"use client";

import {
  Expand, Maximize, Minimize, Minus, Plus, Scan
} from "lucide-react";
import type {
  LucideIcon
} from "lucide-react";
import clsx from "clsx";
import {
  useState
} from "react";
import type {
  FullscreenMode
} from "@/lib/fullscreen/constants";

const buttonClassName = "h-full px-3 hover:bg-hover transition-colors group inline-flex items-center justify-center";
const iconClassName = "w-4 h-4 text-foreground/70 group-hover:text-foreground transition-colors";

export type FullscreenControls = {
  // Desktop with a supported Fullscreen API — otherwise the menu is not shown.
  available: boolean;
  isFullscreen: boolean;
  onEnter: ( mode: FullscreenMode ) => void;
  onExit: () => void;
};

const MenuItem = ( {
  icon: Icon,
  label,
  hint,
  onClick
}: {
  icon: LucideIcon;
  label: string;
  hint: string;
  onClick: () => void;
} ) => (
  <button
    type="button"
    role="menuitem"
    onClick={ onClick }
    className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-hover transition-colors group"
  >
    <Icon className="w-4 h-4 shrink-0 text-foreground/70 group-hover:text-foreground transition-colors" />
    <span className="flex-1 text-sm text-foreground/90 group-hover:text-foreground">{label}</span>
    <span className="text-[0.65rem] uppercase tracking-wide text-foreground/40">{hint}</span>
  </button>
);

const ZoomControls = ( {
  scale,
  onPlus,
  onMinus,
  onFit,
  onReset,
  fullscreen,
  disabled = false,
  variant = "floating"
}: {
  scale: number;
  onPlus: () => void;
  onMinus: () => void;
  onReset: () => void;
  onFit: () => void;
  // Fullscreen options, revealed by hovering the "fit to viewport" button.
  fullscreen?: FullscreenControls;
  // Recording owns the engine clock — surface the controls as inert so a
  // stray zoom can't disturb an in-flight capture.
  disabled?: boolean;
  // "floating" (default) is the rounded island top-right of the viewport;
  // "bar" renders the buttons flat for the docked workspace top bar.
  variant?: "floating" | "bar";
} ) => {
  const [
    menuOpen,
    setMenuOpen
  ] = useState( false );

  const showMenu = Boolean( fullscreen?.available ) && !disabled;
  const closeMenu = () => setMenuOpen( false );
  const openMenu = () => {
    if ( showMenu ) {
      setMenuOpen( true );
    }
  };

  const row = (
    <div
      className={ clsx(
        "flex overflow-hidden divide-x divide-border transition-opacity",
        variant === "floating"
          // Rounded island.
          ? "items-center h-9 bg-background/90 backdrop-blur-xl border border-border rounded-xl shadow-md"
          // Flat, full height so its dividers span the whole top bar.
          : "items-stretch h-full",
        disabled && "opacity-40 pointer-events-none"
      ) }
      aria-hidden={ disabled }
    >
      <button
        onClick={ onMinus }
        onMouseEnter={ closeMenu }
        disabled={ disabled }
        className={ buttonClassName }
        title="Zoom out"
        aria-label="Zoom out"
      >
        <Minus className={ iconClassName } />
      </button>

      <button
        onClick={ onReset }
        onMouseEnter={ closeMenu }
        disabled={ disabled }
        className={ `${ buttonClassName } min-w-[3.5rem]` }
        title="Zoom to 100% (actual size)"
        aria-label="Zoom to 100% (actual size)"
      >
        <span className="text-xs font-semibold tabular-nums text-foreground/70 group-hover:text-foreground transition-colors leading-none">
          {Math.round( scale * 100 )}%
        </span>
      </button>

      <button
        onClick={ onPlus }
        onMouseEnter={ closeMenu }
        disabled={ disabled }
        className={ buttonClassName }
        title="Zoom in"
        aria-label="Zoom in"
      >
        <Plus className={ iconClassName } />
      </button>

      {/* Fit to viewport — hovering (or focusing) it reveals the fullscreen
          menu; a plain click still fits. */}
      <button
        onClick={ onFit }
        onMouseEnter={ openMenu }
        onFocus={ openMenu }
        disabled={ disabled }
        className={ buttonClassName }
        title={ showMenu ? "Fit to viewport — hover for fullscreen" : "Fit to viewport" }
        aria-label="Fit to viewport"
        aria-haspopup={ showMenu ? "menu" : undefined }
        aria-expanded={ showMenu ? menuOpen : undefined }
      >
        <Scan className={ iconClassName } />
      </button>
    </div>
  );

  const menu = showMenu && menuOpen ? (
    // Flush against the button row (no margin): an empty gap between them would
    // belong to neither element, so crossing it fires the island's onMouseLeave
    // and the menu closes before the pointer can reach it.
    <div
      role="menu"
      className="absolute right-0 top-full z-[60] min-w-[13rem] overflow-hidden rounded-xl border border-border bg-background/95 backdrop-blur-xl shadow-lg"
    >
      {fullscreen!.isFullscreen ? (
        <MenuItem
          icon={ Minimize }
          label="Exit fullscreen"
          hint="Esc"
          onClick={ () => {
            fullscreen!.onExit();
            closeMenu();
          } }
        />
      ) : (
        <>
          <MenuItem
            icon={ Maximize }
            label="Fullscreen"
            hint="keep UI"
            onClick={ () => {
              fullscreen!.onEnter( "hud" );
              closeMenu();
            } }
          />
          <MenuItem
            icon={ Expand }
            label="Fill screen"
            hint="canvas only"
            onClick={ () => {
              fullscreen!.onEnter( "bare" );
              closeMenu();
            } }
          />
        </>
      )}
    </div>
  ) : null;

  // The menu is a sibling of the (overflow-hidden) button row so it isn't
  // clipped; leaving the whole island closes it, so moving from the fit button
  // onto the menu keeps it open. onBlur closes it once focus leaves entirely.
  const island = (
    <div
      className={ clsx(
        "relative",
        variant === "bar" && "flex items-stretch"
      ) }
      onMouseLeave={ closeMenu }
      onBlur={ ( e ) => {
        if ( !e.currentTarget.contains( e.relatedTarget as Node | null ) ) {
          closeMenu();
        }
      } }
    >
      {row}
      {menu}
    </div>
  );

  if ( variant === "bar" ) {
    return island;
  }

  return (
    <div
      className="absolute top-2 right-2 md:top-4 md:right-4 z-50"
      data-no-drag="true"
    >
      {island}
    </div>
  );
};

export default ZoomControls;
