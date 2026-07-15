"use client";

import {
  Menu, MenuButton, MenuItem, MenuItems
} from "@headlessui/react";
import clsx from "clsx";
import {
  Bell,
  BellOff,
  Check,
  ExternalLink,
  FileUp,
  Film,
  Github,
  Home,
  ImageIcon,
  ImagePlus,
  Menu as MenuIcon,
  Monitor,
  Moon,
  Paintbrush,
  PanelsLeftRight,
  Share2,
  Sun,
  Video
} from "lucide-react";
import Link from "next/link";
import {
  usePathname, useSearchParams
} from "next/navigation";
import {
  useTheme
} from "next-themes";
import type React from "react";
import {
  useCallback, useEffect, useState
} from "react";
import {
  createPortal
} from "react-dom";
import {
  subscribeUser, unsubscribeUser
} from "@/app/actions/notifications";
import {
  pauseSketchForNav
} from "@/lib/navigationPauseSignal";
import {
  useMenuBarSlot
} from "@/components/MenuBarPortal";
import useMediaQuery from "@/hooks/useMediaQuery";
import {
  usePanelDock
} from "@/hooks/usePanelDock";
import sleep from "@/utils/sleep";

type MenuBarProps = {
  showRecordings?: boolean;
  hasMissingThumbnails?: boolean;
  hasMissingPreviews?: boolean;
};

type NavLink = {
  href: string;
  label: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
  target?: string;
  external?: boolean;
};

const BACKEND_RECORDING = process.env.NEXT_PUBLIC_BACKEND_RECORDING === "true";
const NOTIFICATIONS_ENABLED = process.env.NEXT_PUBLIC_NOTIFICATIONS === "true";
const SHOW_NOTIFICATIONS = BACKEND_RECORDING && NOTIFICATIONS_ENABLED;
const GITHUB_REPO_URL = process.env.NEXT_PUBLIC_GITHUB_REPO_URL;
const IS_DEV = process.env.NODE_ENV === "development";

const themeOptions = [
  {
    value: "light",
    label: "Light",
    Icon: Sun
  },
  {
    value: "dark",
    label: "Dark",
    Icon: Moon
  },
  {
    value: "system",
    label: "System",
    Icon: Monitor
  }
] as const;

// Dev-only diagnostic pages. Each route 404s in production (see the
// notFound() guard inside the pages), so the section is gated the same way.
const DEBUG_LINKS: NavLink[] = [
  {
    href: "/debug/icons",
    label: "Icons",
    Icon: ImageIcon
  },
  {
    href: "/debug/opengraph",
    label: "OpenGraph",
    Icon: Share2
  }
];

function urlBase64ToUint8Array( base64String: string ) {
  const padding = "=".repeat( ( 4 - ( base64String.length % 4 ) ) % 4 );
  const base64 = ( base64String + padding ).replace(
    /-/g,
    "+"
  ).replace(
    /_/g,
    "/"
  );
  const rawData = window.atob( base64 );
  const outputArray = new Uint8Array( rawData.length );

  for ( let i = 0; i < rawData.length; ++i ) {
    outputArray[ i ] = rawData.charCodeAt( i );
  }

  return outputArray;
}

function SectionLabel( {
  children
}: { children: React.ReactNode } ) {
  return (
    <div className="px-3 py-2 bg-hover/30">
      <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wider">
        {children}
      </p>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-border" />;
}

const itemClass = "flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors disabled:opacity-50";

function MenuBar( {
  showRecordings = false,
  hasMissingThumbnails = false,
  hasMissingPreviews = false
}: MenuBarProps ) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const slot = useMenuBarSlot();
  const {
    theme, setTheme
  } = useTheme();
  const [
    mounted,
    setMounted
  ] = useState( false );

  const [
    generatingThumbnails,
    setGeneratingThumbnails
  ] = useState( false );
  const [
    generatingPreviews,
    setGeneratingPreviews
  ] = useState( false );

  const [
    pushSupported,
    setPushSupported
  ] = useState( false );
  const [
    pushSubscription,
    setPushSubscription
  ] = useState<PushSubscription | null>( null );
  const [
    pushLoading,
    setPushLoading
  ] = useState( false );

  // Master toggle for the editor's docked workspace layout. Only meaningful
  // on the desktop editor — the section is hidden on other pages and on
  // mobile (where the studio drawer replaces the panels).
  const {
    docked, toggleDocked
  } = usePanelDock();
  const isDesktop = useMediaQuery( "(min-width: 768px)" );
  const isSketchEditor = /^\/sketches\/[^/]+\/.+/.test( pathname );
  // In docked mode the menu button portals into the editor's top bar, where
  // the bar supplies the surface — so drop the floating island chrome.
  const menuInDockedBar =
    docked && isDesktop && isSketchEditor && Boolean( slot?.slotEl && slot.inlineVisible );

  useEffect(
    () => {
      setMounted( true );
    },
    []
  );

  useEffect(
    () => {
      if ( !SHOW_NOTIFICATIONS ) {
        return;
      }

      if ( !( "serviceWorker" in navigator ) || !( "PushManager" in window ) ) {
        return;
      }

      setPushSupported( true );

      navigator.serviceWorker
        .register(
          "/sw.js",
          {
            scope: "/",
            updateViaCache: "none"
          }
        )
        .then( async( registration ) => {
          const sub = await registration.pushManager.getSubscription();

          setPushSubscription( sub );
        } )
        .catch( ( error ) => {
          console.error(
            "Error registering service worker:",
            error
          );
        } );
    },
    []
  );

  const handleGenerateThumbnails = useCallback(
    async() => {
      setGeneratingThumbnails( true );

      try {
        await fetch( "/api/thumbnails/generate" );
        await sleep( 1000 );
        window.location.reload();
      } finally {
        setGeneratingThumbnails( false );
      }
    },
    []
  );

  const handleGeneratePreviews = useCallback(
    async() => {
      setGeneratingPreviews( true );

      try {
        await fetch( "/api/previews/generate" );
        await sleep( 1000 );
        window.location.reload();
      } finally {
        setGeneratingPreviews( false );
      }
    },
    []
  );

  const subscribeToPush = useCallback(
    async() => {
      setPushLoading( true );

      try {
        const registration = await navigator.serviceWorker.ready;
        const permission = await Notification.requestPermission();

        if ( permission !== "granted" ) {
          alert( "Notification permission denied" );
          return;
        }

        const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

        if ( !publicKey ) {
          alert( "Push notifications are not configured. Please add VAPID keys to .env file." );
          return;
        }

        const sub = await registration.pushManager.subscribe( {
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array( publicKey )
        } );

        setPushSubscription( sub );
        await subscribeUser( JSON.parse( JSON.stringify( sub ) ) );
      } catch( error ) {
        console.error(
          "Error subscribing to push:",
          error
        );
        alert( "Failed to subscribe to notifications" );
      } finally {
        setPushLoading( false );
      }
    },
    []
  );

  const unsubscribeFromPush = useCallback(
    async() => {
      if ( !pushSubscription ) {
        return;
      }

      setPushLoading( true );

      try {
        await pushSubscription.unsubscribe();
        await unsubscribeUser( pushSubscription.endpoint );
        setPushSubscription( null );
      } catch( error ) {
        console.error(
          "Error unsubscribing from push:",
          error
        );
      } finally {
        setPushLoading( false );
      }
    },
    [
      pushSubscription
    ]
  );

  if ( searchParams.get( "capturing" ) === "" ) {
    return null;
  }

  const navLinks: NavLink[] = [
    {
      href: "/",
      label: "Home",
      Icon: Home
    },
    {
      href: "/sketches",
      label: "Sketches",
      Icon: Paintbrush
    }
  ];

  if ( mounted && showRecordings ) {
    navLinks.push( {
      href: "/recordings",
      label: "Recordings",
      Icon: Video
    } );
  }

  if ( GITHUB_REPO_URL ) {
    navLinks.push( {
      href: GITHUB_REPO_URL,
      label: "GitHub",
      Icon: Github,
      target: "_blank",
      external: true
    } );
  }

  navLinks.push( {
    href: "//instagram.com/costardrouge.jpg",
    label: "Instagram",
    Icon: ExternalLink,
    target: "_blank",
    external: true
  } );

  const internalRoutes = [
    ...navLinks,
    ...( IS_DEV ? DEBUG_LINKS : [] )
  ]
    .filter( ( link ) => !link.external && link.href !== "/" )
    .map( ( link ) => link.href );

  const isActive = (
    href: string, external?: boolean
  ) => {
    if ( external ) {
      return false;
    }

    if ( href === "/" ) {
      return (
        pathname === "/" ||
        !internalRoutes.some( ( route ) => pathname.startsWith( route ) )
      );
    }

    return pathname.startsWith( href );
  };

  const hasPendingActions = hasMissingThumbnails || hasMissingPreviews;

  const renderInline = Boolean( slot?.slotEl && slot.inlineVisible );

  const menuNode = (
    <Menu as="div" className="relative">
      <MenuButton
        aria-label="Open menu"
        title="Menu"
        className={ clsx(
          "relative h-9 w-9 inline-flex items-center justify-center hover:bg-hover transition-colors group",
          menuInDockedBar
            ? "rounded-lg"
            : "bg-background/90 backdrop-blur-xl border border-border rounded-xl shadow-md"
        ) }
      >
        <MenuIcon className="h-4 w-4 text-foreground/70 group-hover:text-foreground transition-colors" />
        {hasPendingActions && (
          <span
            aria-hidden
            className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-background animate-pulse-soft"
          />
        )}
      </MenuButton>

      <MenuItems
        anchor="bottom start"
        className="z-50 w-60 border border-border rounded-xl bg-background/95 backdrop-blur-xl shadow-xl overflow-hidden focus:outline-none [--anchor-gap:0.5rem]"
      >
        <SectionLabel>Navigate</SectionLabel>
        {navLinks.map( ( {
          href, label, Icon, target, external
        } ) => {
          const active = isActive(
            href,
            external
          );

          return (
            <MenuItem key={ href }>
              {( {
                focus
              } ) => (
                <Link
                  href={ href }
                  target={ target }
                  onClick={ external ? undefined : pauseSketchForNav }
                  className={ clsx(
                    itemClass,
                    focus && "bg-hover",
                    active && "font-semibold"
                  ) }
                >
                  <Icon className="h-4 w-4 text-foreground/70" />
                  <span className="flex-1">{label}</span>
                  {active && (
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 rounded-full bg-foreground"
                    />
                  )}
                </Link>
              )}
            </MenuItem>
          );
        } )}

        {slot?.importHandler && (
          <>
            <Divider />
            <MenuItem>
              {( {
                focus
              } ) => (
                <button
                  type="button"
                  onClick={ slot.importHandler ?? undefined }
                  className={ clsx(
                    itemClass,
                    focus && "bg-hover"
                  ) }
                >
                  <FileUp className="h-4 w-4 text-foreground/70" />
                  <span className="flex-1 text-left">Import .json</span>
                </button>
              )}
            </MenuItem>
          </>
        )}

        {IS_DEV && (
          <>
            <Divider />
            <SectionLabel>Debug</SectionLabel>
            {DEBUG_LINKS.map( ( {
              href, label, Icon
            } ) => {
              const active = isActive( href );

              return (
                <MenuItem key={ href }>
                  {( {
                    focus
                  } ) => (
                    <Link
                      href={ href }
                      onClick={ pauseSketchForNav }
                      className={ clsx(
                        itemClass,
                        focus && "bg-hover",
                        active && "font-semibold"
                      ) }
                    >
                      <Icon className="h-4 w-4 text-foreground/70" />
                      <span className="flex-1">{label}</span>
                      {active && (
                        <span
                          aria-hidden
                          className="h-1.5 w-1.5 rounded-full bg-foreground"
                        />
                      )}
                    </Link>
                  )}
                </MenuItem>
              );
            } )}
          </>
        )}

        {hasPendingActions && (
          <>
            <Divider />
            <SectionLabel>Pending</SectionLabel>
            {hasMissingPreviews && (
              <MenuItem>
                {( {
                  focus
                } ) => (
                  <button
                    type="button"
                    onClick={ handleGeneratePreviews }
                    disabled={ generatingPreviews }
                    className={ clsx(
                      itemClass,
                      focus && "bg-hover"
                    ) }
                  >
                    <Film className={ clsx(
                      "h-4 w-4 text-foreground/70",
                      generatingPreviews && "animate-pulse"
                    ) } />
                    <span className="flex-1 text-left">
                      {generatingPreviews ? "Generating…" : "Generate previews"}
                    </span>
                  </button>
                )}
              </MenuItem>
            )}
            {hasMissingThumbnails && (
              <MenuItem>
                {( {
                  focus
                } ) => (
                  <button
                    type="button"
                    onClick={ handleGenerateThumbnails }
                    disabled={ generatingThumbnails }
                    className={ clsx(
                      itemClass,
                      focus && "bg-hover"
                    ) }
                  >
                    <ImagePlus className={ clsx(
                      "h-4 w-4 text-foreground/70",
                      generatingThumbnails && "animate-pulse"
                    ) } />
                    <span className="flex-1 text-left">
                      {generatingThumbnails ? "Generating…" : "Generate thumbnails"}
                    </span>
                  </button>
                )}
              </MenuItem>
            )}
          </>
        )}

        {isDesktop && isSketchEditor && (
          <>
            <Divider />
            <SectionLabel>Workspace</SectionLabel>
            <MenuItem>
              {( {
                focus
              } ) => (
                <button
                  type="button"
                  onClick={ toggleDocked }
                  className={ clsx(
                    itemClass,
                    focus && "bg-hover"
                  ) }
                >
                  <PanelsLeftRight className="h-4 w-4 text-foreground/70" />
                  <span className="flex-1 text-left">Docked layout</span>
                  {docked && (
                    <Check className="h-4 w-4 text-foreground" />
                  )}
                </button>
              )}
            </MenuItem>
          </>
        )}

        <Divider />
        <SectionLabel>Theme</SectionLabel>
        {themeOptions.map( ( {
          value, label, Icon
        } ) => (
          <MenuItem key={ value }>
            {( {
              focus
            } ) => (
              <button
                type="button"
                onClick={ () => setTheme( value ) }
                className={ clsx(
                  itemClass,
                  focus && "bg-hover"
                ) }
              >
                <Icon className="h-4 w-4 text-foreground/70" />
                <span className="flex-1 text-left">{label}</span>
                {mounted && theme === value && (
                  <Check className="h-4 w-4 text-foreground" />
                )}
              </button>
            )}
          </MenuItem>
        ) )}

        {SHOW_NOTIFICATIONS && pushSupported && (
          <>
            <Divider />
            <SectionLabel>Notifications</SectionLabel>
            <MenuItem>
              {( {
                focus
              } ) => (
                <button
                  type="button"
                  onClick={ pushSubscription ? unsubscribeFromPush : subscribeToPush }
                  disabled={ pushLoading }
                  className={ clsx(
                    itemClass,
                    focus && "bg-hover"
                  ) }
                >
                  {pushSubscription ? (
                    <Bell className="h-4 w-4 text-foreground/70" />
                  ) : (
                    <BellOff className="h-4 w-4 text-foreground/70" />
                  )}
                  <span className="flex-1 text-left">
                    {pushSubscription ? "Disable notifications" : "Enable notifications"}
                  </span>
                </button>
              )}
            </MenuItem>
          </>
        )}
      </MenuItems>
    </Menu>
  );

  if ( renderInline && slot?.slotEl ) {
    return createPortal(
      menuNode,
      slot.slotEl
    );
  }

  return (
    <div className="fixed top-2 left-2 md:top-4 md:left-4 z-[70] md:z-50">
      {menuNode}
    </div>
  );
}

export default MenuBar;
