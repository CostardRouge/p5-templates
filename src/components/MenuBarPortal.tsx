"use client";

import clsx from "clsx";
import {
  createContext, useCallback, useContext, useEffect, useRef, useState
} from "react";

type MenuBarSlotContextValue = {
  registerSlot: ( el: HTMLElement | null ) => void;
  slotEl: HTMLElement | null;
  inlineVisible: boolean;
};

const MenuBarSlotContext = createContext<MenuBarSlotContextValue | null>( null );

export function useMenuBarSlot() {
  return useContext( MenuBarSlotContext );
}

function findScrollParent( el: HTMLElement ): Element {
  let parent: HTMLElement | null = el.parentElement;

  while ( parent ) {
    const style = window.getComputedStyle( parent );

    if ( /(auto|scroll)/.test( style.overflowY ) ) {
      return parent;
    }

    parent = parent.parentElement;
  }

  return document.documentElement;
}

export function MenuBarSlotProvider( {
  children
}: { children: React.ReactNode } ) {
  const [
    slotEl,
    setSlotEl
  ] = useState<HTMLElement | null>( null );
  const [
    inlineVisible,
    setInlineVisible
  ] = useState( false );

  useEffect(
    () => {
      if ( !slotEl ) {
        setInlineVisible( false );
        return;
      }

      const root = findScrollParent( slotEl );

      const observer = new IntersectionObserver(
        ( entries ) => {
          for ( const entry of entries ) {
            setInlineVisible( entry.isIntersecting );
          }
        },
        {
          root: root === document.documentElement ? null : root,
          threshold: 0
        }
      );

      observer.observe( slotEl );

      // Initial state — if the slot mounts already out of view, treat as not visible.
      const rect = slotEl.getBoundingClientRect();
      const rootRect =
        root === document.documentElement
          ? {
            top: 0,
            bottom: window.innerHeight
          }
          : root.getBoundingClientRect();

      setInlineVisible( rect.bottom > rootRect.top && rect.top < rootRect.bottom );

      return () => observer.disconnect();
    },
    [
      slotEl
    ]
  );

  const registerSlot = useCallback(
    ( el: HTMLElement | null ) => {
      setSlotEl( el );

      // Seed as visible when a slot mounts so the menu portals immediately
      // instead of briefly flashing in its floating position on first paint.
      if ( el ) {
        setInlineVisible( true );
      }
    },
    []
  );

  return (
    <MenuBarSlotContext.Provider
      value={ {
        registerSlot,
        slotEl,
        inlineVisible
      } }
    >
      {children}
    </MenuBarSlotContext.Provider>
  );
}

type MenuBarSlotProps = {
  className?: string;
};

export function MenuBarSlot( {
  className
}: MenuBarSlotProps ) {
  const ctx = useMenuBarSlot();
  const ref = useRef<HTMLDivElement>( null );
  // Depend only on the stable callback — not the whole ctx object, which
  // re-creates whenever `inlineVisible` changes and would otherwise cause
  // the observer's updates to be immediately overridden by re-seeding.
  const registerSlot = ctx?.registerSlot;

  useEffect(
    () => {
      if ( !registerSlot ) {
        return;
      }

      registerSlot( ref.current );

      return () => registerSlot( null );
    },
    [
      registerSlot
    ]
  );

  // Reserve space matching the menu button (h-9 w-9 in MenuBar.tsx)
  // so the layout doesn't reflow as the menubar appears/disappears.
  return (
    <div
      ref={ ref }
      className={ clsx(
        "h-9 w-9 shrink-0",
        className
      ) }
    />
  );
}
