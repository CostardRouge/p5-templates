import {
  useSyncExternalStore
} from "react";
import {
  getPostiz, getServerPostiz, subscribePostiz, type PostizConnection
} from "./store";

/** The kept Postiz, live — null until one is connected in Publishing, and always on the server. */
export function usePostiz(): PostizConnection | null {
  return useSyncExternalStore(
    subscribePostiz,
    getPostiz,
    getServerPostiz
  );
}

const OPEN_EVENT = "sketchbook:open-publishing";

/**
 * Open the Publishing dialog from anywhere — the Export dialog's *accounts*
 * link, a "connect your Postiz" line. The menu bar, mounted on every page,
 * owns the dialog and listens for this.
 */
export function openPublishing(): void {
  window.dispatchEvent( new Event( OPEN_EVENT ) );
}

export function onOpenPublishing( listener: () => void ): () => void {
  window.addEventListener(
    OPEN_EVENT,
    listener
  );

  return () => window.removeEventListener(
    OPEN_EVENT,
    listener
  );
}
