"use client";

import {
  Check, Expand, Maximize, Minus, MonitorPlay, Plus, Scan, SquareDashed
} from "lucide-react";
import type {
  LucideIcon
} from "lucide-react";
import clsx from "clsx";
import {
  useState
} from "react";
import usePresentationMode from "@/hooks/usePresentationMode";
import {
  applyPresentationPreset,
  togglePresentationAxis
} from "@/lib/presentation/presentationMode";
import type {
  PresentationAxis, PresentationPreset
} from "@/lib/presentation/presentationMode";

const buttonClassName = "h-full px-3 hover:bg-hover transition-colors group inline-flex items-center justify-center";
const iconClassName = "w-4 h-4 text-foreground/70 group-hover:text-foreground transition-colors";

// The presets are the cells of the matrix worth naming; the toggles below them
// reach the rest. Ordered most-committed first, so "Present" — the shop/expo
// mode — is the one under the pointer when the menu opens.
const PRESETS: {
  preset: PresentationPreset;
  icon: LucideIcon;
  label: string;
  hint: string;
  /** Needs the Fullscreen API, so desktop-only. */
  needsFullscreen: boolean;
}[] = [
  {
    preset: "present",
    icon: MonitorPlay,
    label: "Present",
    hint: "P",
    needsFullscreen: true
  },
  {
    preset: "presentSketchRatio",
    icon: MonitorPlay,
    label: "Present (sketch ratio)",
    hint: "",
    needsFullscreen: true
  },
  {
    preset: "focus",
    icon: Maximize,
    label: "Focus",
    hint: "F",
    needsFullscreen: true
  },
  {
    preset: "fillPage",
    icon: Expand,
    label: "Fill the page",
    hint: "",
    needsFullscreen: false
  },
  {
    preset: "cleanPreview",
    icon: SquareDashed,
    label: "Clean preview",
    hint: "",
    needsFullscreen: false
  }
];

const AXES: {
  axis: PresentationAxis;
  label: string;
  hint: string;
  needsFullscreen: boolean;
}[] = [
  {
    axis: "fullscreen",
    label: "Fullscreen",
    hint: "F",
    needsFullscreen: true
  },
  {
    axis: "hideInterface",
    label: "Hide interface",
    hint: "H",
    needsFullscreen: false
  },
  {
    axis: "stretchCanvas",
    label: "Stretch canvas",
    hint: "L",
    needsFullscreen: false
  }
];

const MenuItem = ( {
  icon: Icon,
  checked,
  label,
  hint,
  onClick
}: {
  icon?: LucideIcon;
  // Omitted for the presets (plain commands); a boolean turns the row into a
  // checkbox showing whether that axis is currently on.
  checked?: boolean;
  label: string;
  hint: string;
  onClick: () => void;
} ) => (
  <button
    type="button"
    role={ checked === undefined ? "menuitem" : "menuitemcheckbox" }
    aria-checked={ checked }
    onClick={ onClick }
    className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-hover transition-colors group"
  >
    {checked === undefined
      ? Icon && <Icon className="w-4 h-4 shrink-0 text-foreground/70 group-hover:text-foreground transition-colors" />
      : (
        <Check
          className={ clsx(
            "w-4 h-4 shrink-0 transition-colors",
            checked ? "text-foreground" : "text-transparent"
          ) }
        />
      )}
    <span
      className={ clsx(
        "flex-1 text-sm group-hover:text-foreground",
        checked ? "text-foreground" : "text-foreground/90"
      ) }
    >
      {label}
    </span>
    <span className="text-[0.65rem] uppercase tracking-wide text-foreground/40">{hint}</span>
  </button>
);

const ZoomControls = ( {
  scale,
  onPlus,
  onMinus,
  onFit,
  onReset,
  showPresentation = true,
  disabled = false,
  variant = "floating"
}: {
  scale: number;
  onPlus: () => void;
  onMinus: () => void;
  onReset: () => void;
  onFit: () => void;
  // Presentation options, revealed by hovering the "fit to viewport" button.
  showPresentation?: boolean;
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

  const presentation = usePresentationMode();

  // Fullscreen is the only axis the platform can refuse; hiding the interface
  // and stretching the canvas work everywhere, so the menu is worth showing
  // even where the Fullscreen API is not.
  const showMenu = showPresentation && !disabled;
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

      {/* Fit to viewport — hovering (or focusing) it reveals the presentation
          menu; a plain click still fits. */}
      <button
        onClick={ onFit }
        onMouseEnter={ openMenu }
        onFocus={ openMenu }
        disabled={ disabled }
        className={ buttonClassName }
        title={ showMenu ? "Fit to viewport — hover for presentation modes" : "Fit to viewport" }
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
      className="absolute right-0 top-full z-[60] min-w-[15rem] overflow-hidden rounded-xl border border-border bg-background/95 backdrop-blur-xl shadow-lg"
    >
      {/* Named cells of the matrix. */}
      {PRESETS
        .filter( ( entry ) => presentation.isFullscreenSupported || !entry.needsFullscreen )
        .map( ( entry ) => (
          <MenuItem
            key={ entry.preset }
            icon={ entry.icon }
            label={ entry.label }
            hint={ entry.hint }
            onClick={ () => {
              applyPresentationPreset( entry.preset );
              closeMenu();
            } }
          />
        ) )}

      <div className="h-px bg-border" />

      {/* The three axes themselves — every other combination lives here. The
          menu stays open: setting a mode usually means setting two of them. */}
      {AXES
        .filter( ( entry ) => presentation.isFullscreenSupported || !entry.needsFullscreen )
        .map( ( entry ) => (
          <MenuItem
            key={ entry.axis }
            checked={ presentation[ entry.axis ] }
            label={ entry.label }
            hint={ entry.hint }
            onClick={ () => togglePresentationAxis( entry.axis ) }
          />
        ) )}
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
