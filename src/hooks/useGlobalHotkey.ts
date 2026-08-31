"use client";

import {
  useEffect
} from "react";

// Elements a bare key already has a native or ARIA meaning on — text entry,
// buttons/links/controls, and anything inside an open modal dialog. Shared by
// every `useGlobalHotkey` caller (playback, export, share, fullscreen…) so a
// new Space/E/S/F-sensitive control only needs to be added here once.
const INTERACTIVE_SELECTOR = [
  "input",
  "textarea",
  "select",
  "button",
  "a[href]",
  "[contenteditable=\"true\"]",
  "[role=\"button\"]",
  "[role=\"checkbox\"]",
  "[role=\"switch\"]",
  "[role=\"slider\"]",
  "[role=\"menuitem\"]",
  "[role=\"tab\"]",
  "[role=\"dialog\"]",
  "[aria-modal=\"true\"]"
].join( ", " );

function isHotkeyReservedTarget( target: EventTarget | null ) {
  const node = target as HTMLElement | null;

  if ( !node ) {
    return false;
  }

  return node.isContentEditable || Boolean( node.closest( INTERACTIVE_SELECTOR ) );
}

type UseGlobalHotkeyOptions = {
  /** `KeyboardEvent.code`, e.g. `"Space"`, `"KeyE"`, `"KeyF"`. */
  code: string;
  onTrigger: () => void;
  /** Set false to remove the listener entirely (e.g. while a feature it
   *  drives is locked out) rather than letting `onTrigger` no-op. */
  enabled?: boolean;
};

/**
 * A single-key studio shortcut (no modifiers), fired from anywhere on the
 * page — not scoped to a DOM subtree, since the control it drives (transport,
 * export, share, fullscreen) is usually not what has focus.
 *
 * Backs off wherever the key already has a job: text entry, anything a
 * button/link/ARIA-control role covers (so a focused control's own
 * click-on-Space/Enter doesn't double-fire alongside the shortcut), and
 * anything inside an open `role="dialog"`/`aria-modal` element. Also ignores
 * Cmd/Ctrl/Alt combinations (those are the browser's or OS's) and
 * `event.repeat` (holding the key down triggers once, not repeatedly).
 */
export default function useGlobalHotkey( {
  code,
  onTrigger,
  enabled = true
}: UseGlobalHotkeyOptions ) {
  useEffect(
    () => {
      if ( !enabled ) {
        return;
      }

      const onKeyDown = ( event: KeyboardEvent ) => {
        if ( event.code !== code || event.repeat ) {
          return;
        }
        if ( event.metaKey || event.ctrlKey || event.altKey ) {
          return;
        }
        if ( isHotkeyReservedTarget( event.target ) ) {
          return;
        }

        event.preventDefault();
        onTrigger();
      };

      window.addEventListener(
        "keydown",
        onKeyDown
      );

      return () => window.removeEventListener(
        "keydown",
        onKeyDown
      );
    },
    [
      code,
      enabled,
      onTrigger
    ]
  );
}
