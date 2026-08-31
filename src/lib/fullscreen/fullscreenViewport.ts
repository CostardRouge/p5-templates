"use client";

/**
 * Browser Fullscreen API shims.
 *
 * Nothing here decides *what* fullscreen means for the studio — that is
 * `src/lib/presentation/presentationMode.ts`, which treats fullscreen as one of
 * three independent axes. This module only knows the parts of the platform API
 * that need papering over: Safari's `webkit*` prefixes, the SSR guards, and the
 * `fullscreenchange` event.
 *
 * The target is always `document.documentElement`. It used to be the sketch
 * viewport, and that was the whole problem: the browser renders only the
 * fullscreen element, so every studio panel outside the viewport disappeared
 * whether or not that was intended, and "fullscreen with the panels" was not
 * expressible. Fullscreening the document root makes hiding the interface a
 * deliberate choice instead of a side effect.
 */

type WebkitDocument = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type WebkitElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

let changeListenerBound = false;
const changeSubscribers = new Set<() => void>();

function currentFullscreenElement(): Element | null {
  if ( typeof document === "undefined" ) {
    return null;
  }

  const doc = document as WebkitDocument;

  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

/**
 * Whether the browser exposes a usable element-fullscreen API *and* allows it
 * (it is disabled inside iframes without `allow="fullscreen"`, e.g. some
 * embeds). Safe to call during SSR — returns `false`.
 */
export function isFullscreenSupported(): boolean {
  if ( typeof document === "undefined" || typeof Element === "undefined" ) {
    return false;
  }

  const doc = document as WebkitDocument;
  const enabled = document.fullscreenEnabled ?? doc.webkitFullscreenEnabled ?? false;
  const proto = Element.prototype as WebkitElement;
  const requestable = Boolean( proto.requestFullscreen || proto.webkitRequestFullscreen );

  return Boolean( enabled && requestable );
}

/** True while the document root is the active fullscreen element. */
export function isDocumentFullscreen(): boolean {
  if ( typeof document === "undefined" ) {
    return false;
  }

  return currentFullscreenElement() === document.documentElement;
}

/**
 * Go fullscreen on the document root. Must be called from within a user
 * gesture — the request is issued synchronously, before the first `await`.
 */
export function requestDocumentFullscreen(): Promise<void> {
  if ( typeof document === "undefined" ) {
    return Promise.reject( new Error( "Fullscreen API unavailable" ) );
  }

  const element = document.documentElement as WebkitElement;
  const request = element.requestFullscreen ?? element.webkitRequestFullscreen;

  if ( !request ) {
    return Promise.reject( new Error( "Fullscreen API unavailable" ) );
  }

  return Promise.resolve( request.call( element ) );
}

/** Leave fullscreen. Resolves even where the API is missing. */
export function exitDocumentFullscreen(): Promise<void> {
  if ( typeof document === "undefined" ) {
    return Promise.resolve();
  }

  const doc = document as WebkitDocument;
  const exit = document.exitFullscreen ?? doc.webkitExitFullscreen;

  if ( !exit || !currentFullscreenElement() ) {
    return Promise.resolve();
  }

  return Promise.resolve( exit.call( document ) );
}

function handleFullscreenChange(): void {
  for ( const cb of changeSubscribers ) {
    cb();
  }
}

function ensureChangeListener(): void {
  if ( changeListenerBound || typeof document === "undefined" ) {
    return;
  }

  changeListenerBound = true;
  document.addEventListener(
    "fullscreenchange",
    handleFullscreenChange
  );
  document.addEventListener(
    "webkitfullscreenchange",
    handleFullscreenChange
  );
}

/**
 * Subscribe to `fullscreenchange` — the only way to learn that Esc, the
 * browser's own control or a rejected request changed the state under us.
 */
export function subscribeFullscreenChange( cb: () => void ): () => void {
  ensureChangeListener();
  changeSubscribers.add( cb );

  return () => {
    changeSubscribers.delete( cb );
  };
}
