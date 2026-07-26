"use client";

import {
  Check, Copy, ExternalLink, Share2, X
} from "lucide-react";
import clsx from "clsx";
import {
  useEffect, useMemo, useState
} from "react";
import {
  createPortal
} from "react-dom";
import useSketch from "../ClientProcessingSketch/components/SketchProvider/hooks/useSketch";
import {
  buildEmbedHash, diffSketchOptions, EMBED_SIZE_FILL, parseEmbedSize
} from "@/lib/embedOptions";
import type {
  AutoplayPolicy, EmbedSize
} from "@/lib/embedOptions";
import {
  EMBED_CONTROLS_ALL
} from "@/lib/embedControls";
import {
  formatOptions
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/RootSettings/constants/root-field-config";
import {
  isFullscreenFormatValue
} from "@/lib/fullscreen/constants";

type ControlsMode = "none" | "all" | "custom";

/** Sentinel select value meaning "whatever the editor canvas is set to". */
const SIZE_CHOICE_EDITOR = "";

/**
 * Share / embed affordance for the preview page. Serialises the CURRENT sketch
 * params as a delta over the template defaults into an `/embed` URL fragment,
 * lets the author choose which fields to expose as live controls, and offers a
 * copyable link + `<iframe>` snippet. Fully client-side — no persistence.
 */
export default function SketchShareDialog() {
  const [
    {
      name, engineId, category, options, sketchFormValues, sketchFormConfiguration
    }
  ] = useSketch();

  const [
    open,
    setOpen
  ] = useState( false );
  const [
    mode,
    setMode
  ] = useState<ControlsMode>( "none" );
  const [
    picked,
    setPicked
  ] = useState<Set<string>>( new Set() );
  const [
    autoplay,
    setAutoplay
  ] = useState<AutoplayPolicy>( "on" );
  const [
    sizeChoice,
    setSizeChoice
  ] = useState<string>( SIZE_CHOICE_EDITOR );
  const [
    margin,
    setMargin
  ] = useState( false );
  const [
    copied,
    setCopied
  ] = useState<string | null>( null );
  const [
    origin,
    setOrigin
  ] = useState( "" );

  useEffect(
    () => {
      // In development, always use the origin the editor is actually served
      // from (protocol + host + port) so "Open" and the iframe snippet point at
      // the local dev server — NEXT_PUBLIC_SITE_URL is baked at build time and
      // usually holds the production domain, which is untestable locally. In
      // production, prefer that canonical domain, falling back to the live origin.
      const isDev = process.env.NODE_ENV === "development";

      setOrigin( isDev
        ? window.location.origin
        : ( process.env.NEXT_PUBLIC_SITE_URL || window.location.origin ) );
    },
    []
  );

  // Close on Escape while the dialog is open.
  useEffect(
    () => {
      if ( !open ) {
        return;
      }

      const onKey = ( event: KeyboardEvent ) => {
        if ( event.key === "Escape" ) {
          setOpen( false );
        }
      };

      window.addEventListener(
        "keydown",
        onKey
      );

      return () => window.removeEventListener(
        "keydown",
        onKey
      );
    },
    [
      open
    ]
  );

  const controlKeys = useMemo(
    () => Object.keys( sketchFormConfiguration ?? {} ),
    [
      sketchFormConfiguration
    ]
  );

  const delta = useMemo(
    () => diffSketchOptions(
      options.sketch,
      sketchFormValues
    ),
    [
      options.sketch,
      sketchFormValues
    ]
  );

  const controls = useMemo(
    () => {
      if ( mode === "all" ) {
        return [
          EMBED_CONTROLS_ALL
        ];
      }

      if ( mode === "custom" ) {
        return controlKeys.filter( ( key ) => picked.has( key ) );
      }

      return [];
    },
    [
      mode,
      picked,
      controlKeys
    ]
  );

  // Resolution presets, minus the fullscreen sentinels the canvas-size select
  // uses — those drive the Fullscreen API, which means nothing inside a frame.
  const sizePresets = useMemo(
    () => {
      const groups = new Map<string, {
        label: string;
        value: string;
      }[]>();

      for ( const option of formatOptions ) {
        if ( isFullscreenFormatValue( option.value ) ) {
          continue;
        }

        const group = option.group ?? "Other";

        if ( !groups.has( group ) ) {
          groups.set(
            group,
            []
          );
        }

        groups.get( group )!.push( {
          label: option.label,
          value: String( option.value )
        } );
      }

      return [
        ...groups.entries()
      ];
    },
    []
  );

  const canvasWidth = options.size?.width ?? 1080;
  const canvasHeight = options.size?.height ?? 1350;
  const canvasSize = useMemo(
    () => ( {
      width: canvasWidth,
      height: canvasHeight
    } ),
    [
      canvasWidth,
      canvasHeight
    ]
  );

  // "Match the editor" tracks the live canvas size instead of freezing a value,
  // so tweaking the format in the editor updates the link as you look at it.
  const embedSize: EmbedSize = sizeChoice === SIZE_CHOICE_EDITOR
    ? canvasSize
    : parseEmbedSize( sizeChoice ) ?? canvasSize;
  const fillFrame = embedSize === EMBED_SIZE_FILL;

  const embedPath = `/embed/${ engineId }/${ category ? `${ category }/` : "" }${ name }`;
  const hash = buildEmbedHash(
    delta,
    controls,
    {
      autoplay,
      size: embedSize,
      margin
    }
  );
  const link = `${ origin }${ embedPath }${ hash }`;

  // The frame box the snippet suggests: a fixed resolution dictates its own
  // ratio; in fill mode nothing does, so the editor canvas seeds a sane box the
  // host is free to change — the sketch re-sizes to whatever it ends up being.
  const frame = fillFrame ? canvasSize : embedSize;
  // The snippet is HTML, so the hash's `&` separators have to be escaped — a
  // sanitiser or validator on the host side would otherwise mangle the URL.
  const iframeSnippet =
    `<iframe\n  src="${ link.replace(
      /&/g,
      "&amp;"
    ) }"\n  style="width:100%; aspect-ratio:${ frame.width }/${ frame.height }; border:0"\n  allow="camera; microphone"\n  loading="lazy"\n></iframe>`;

  const changedCount = Object.keys( delta ).length;

  const copy = async(
    value: string, key: string
  ) => {
    try {
      await navigator.clipboard.writeText( value );
    } catch {
      // Fallback for non-secure contexts (no navigator.clipboard).
      const textarea = document.createElement( "textarea" );

      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild( textarea );
      textarea.select();

      try {
        document.execCommand( "copy" );
      } catch {
        // Give up silently — the field is selectable for a manual copy.
      }

      document.body.removeChild( textarea );
    }

    setCopied( key );
    setTimeout(
      () => setCopied( ( current ) => ( current === key ? null : current ) ),
      1600
    );
  };

  const togglePicked = ( key: string ) => {
    setPicked( ( current ) => {
      const next = new Set( current );

      if ( next.has( key ) ) {
        next.delete( key );
      } else {
        next.add( key );
      }

      return next;
    } );
  };

  const dialog = open ? createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Share and embed sketch"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={ () => setOpen( false ) }
      />

      <div className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Share2 className="h-4 w-4" />
            Share &amp; embed
          </h2>
          <button
            type="button"
            onClick={ () => setOpen( false ) }
            aria-label="Close"
            className="rounded-lg p-1.5 text-foreground/60 transition-colors hover:bg-hover hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-4">
          <p className="text-xs text-foreground/60">
            {changedCount === 0
              ? "Sharing the default look. Tweak the sketch first to bake your settings into the link."
              : `${ changedCount } setting${ changedCount === 1 ? "" : "s" } changed from the defaults will be baked into the link.`}
          </p>

          {/* Frame — resolution + margin */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
              Frame
            </span>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-foreground/60">Resolution</span>
              <select
                value={ sizeChoice }
                onChange={ ( event ) => setSizeChoice( event.target.value ) }
                className={ clsx(
                  "w-full cursor-pointer rounded-xl border border-border bg-hover/30 px-2.5 py-2 text-sm text-foreground",
                  "focus:outline-none focus:ring-1 focus:ring-focus"
                ) }
              >
                <option value={ SIZE_CHOICE_EDITOR }>
                  {`Match the editor (${ canvasWidth } × ${ canvasHeight })`}
                </option>
                <option value={ EMBED_SIZE_FILL }>
                  Fill the frame — follow the iframe size
                </option>
                {sizePresets.map( ( [
                  groupLabel,
                  presets
                ] ) => (
                  <optgroup key={ groupLabel } label={ groupLabel }>
                    {presets.map( ( preset ) => (
                      <option key={ preset.value } value={ preset.value }>
                        {preset.label}
                      </option>
                    ) )}
                  </optgroup>
                ) )}
              </select>
            </label>

            <p className="text-xs text-foreground/50">
              {fillFrame
                ? "The canvas is re-drawn at the iframe's own size and follows it on resize — nothing is letterboxed."
                : "The canvas renders at this resolution and is scaled to fit the iframe."}
            </p>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={ margin }
                onChange={ () => setMargin( ( current ) => !current ) }
                className="h-4 w-4 accent-foreground"
              />
              Leave a margin around the sketch
            </label>
            <p className="text-xs text-foreground/50">
              Off by default: the sketch sits flush against the frame edges.
            </p>
          </div>

          {/* Controls exposure */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
              Controls in the embed
            </span>
            <div className="flex flex-col gap-1">
              {( [
                {
                  value: "none",
                  label: "None — display only"
                },
                {
                  value: "all",
                  label: "All options"
                },
                {
                  value: "custom",
                  label: "Choose which to expose"
                }
              ] as const ).map( ( option ) => (
                <label
                  key={ option.value }
                  className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
                >
                  <input
                    type="radio"
                    name="embed-controls-mode"
                    checked={ mode === option.value }
                    onChange={ () => setMode( option.value ) }
                    className="accent-foreground"
                  />
                  {option.label}
                </label>
              ) )}
            </div>

            {mode === "custom" && (
              <div className="mt-1 flex max-h-40 flex-col gap-1 overflow-y-auto rounded-xl border border-border bg-hover/30 p-2">
                {controlKeys.length === 0 ? (
                  <span className="px-1 text-xs text-foreground/50">
                    This sketch has no configurable options.
                  </span>
                ) : (
                  controlKeys.map( ( key ) => (
                    <label
                      key={ key }
                      className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1 text-sm transition-colors hover:bg-hover/60"
                    >
                      <span className="truncate">
                        {sketchFormConfiguration?.[ key ]?.label ?? key}
                      </span>
                      <input
                        type="checkbox"
                        checked={ picked.has( key ) }
                        onChange={ () => togglePicked( key ) }
                        className="h-4 w-4 accent-foreground"
                      />
                    </label>
                  ) )
                )}
              </div>
            )}
          </div>

          {/* Autoplay */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
              Autoplay
            </span>
            <div className="flex flex-col gap-1">
              {( [
                {
                  value: "on",
                  label: "Play automatically"
                },
                {
                  value: "off",
                  label: "Off — click to play"
                },
                {
                  value: "desktop",
                  label: "Auto on desktop only (off on mobile)"
                }
              ] as const ).map( ( option ) => (
                <label
                  key={ option.value }
                  className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
                >
                  <input
                    type="radio"
                    name="embed-autoplay"
                    checked={ autoplay === option.value }
                    onChange={ () => setAutoplay( option.value ) }
                    className="accent-foreground"
                  />
                  {option.label}
                </label>
              ) )}
            </div>
            <p className="text-xs text-foreground/50">
              Reduced-motion viewers never autoplay, whatever you pick.
            </p>
          </div>

          {/* Link */}
          <ShareField
            label="Link"
            value={ link }
            copied={ copied === "link" }
            onCopy={ () => copy(
              link,
              "link"
            ) }
            onOpen={ () => window.open(
              link,
              "_blank",
              "noopener"
            ) }
          />

          {/* Iframe snippet */}
          <ShareField
            label="Embed (iframe)"
            value={ iframeSnippet }
            multiline
            copied={ copied === "iframe" }
            onCopy={ () => copy(
              iframeSnippet,
              "iframe"
            ) }
          />

          <p className="text-xs text-foreground/50">
            <code className="rounded bg-hover/50 px-1">allow=&quot;camera; microphone&quot;</code>{" "}
            lets interactive (camera/mic) sketches work inside the frame — keep it for those, drop it otherwise.
          </p>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={ () => setOpen( true ) }
        title="Share / embed"
        aria-label="Share or embed this sketch"
        className="inline-flex h-full items-center justify-center border-r border-border px-3 transition-colors hover:bg-hover group"
      >
        <Share2 className="h-4 w-4 text-foreground/70 transition-colors group-hover:text-foreground" />
      </button>

      {dialog}
    </>
  );
}

function ShareField( {
  label,
  value,
  multiline = false,
  copied,
  onCopy,
  onOpen
}: {
  label: string;
  value: string;
  multiline?: boolean;
  copied: boolean;
  onCopy: () => void;
  /** When set, renders an "open in new tab" affordance next to Copy. */
  onOpen?: () => void;
} ) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
          {label}
        </span>
        <div className="flex items-center gap-1">
          {onOpen && (
            <button
              type="button"
              onClick={ onOpen }
              title="Open the embed in a new tab"
              aria-label="Open the embed in a new tab"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-foreground/70 transition-colors hover:bg-hover hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open
            </button>
          )}
          <button
            type="button"
            onClick={ onCopy }
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-foreground/70 transition-colors hover:bg-hover hover:text-foreground"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-green-400" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy
              </>
            )}
          </button>
        </div>
      </div>
      {multiline ? (
        <textarea
          readOnly
          value={ value }
          rows={ 5 }
          onFocus={ ( event ) => event.currentTarget.select() }
          className={ clsx(
            "w-full resize-none rounded-xl border border-border bg-hover/30 p-2.5 font-mono text-xs text-foreground",
            "focus:outline-none focus:ring-1 focus:ring-focus"
          ) }
        />
      ) : (
        <input
          readOnly
          value={ value }
          onFocus={ ( event ) => event.currentTarget.select() }
          className={ clsx(
            "w-full rounded-xl border border-border bg-hover/30 px-2.5 py-2 font-mono text-xs text-foreground",
            "focus:outline-none focus:ring-1 focus:ring-focus"
          ) }
        />
      )}
    </div>
  );
}
