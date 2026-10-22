"use client";

import {
  Dialog, DialogPanel, DialogTitle
} from "@headlessui/react";
import clsx from "clsx";
import {
  Bot, Check, ChevronDown, Copy, Download, X
} from "lucide-react";
import {
  usePathname
} from "next/navigation";
import type React from "react";
import {
  useEffect, useState, useSyncExternalStore
} from "react";

import {
  connectBridge, disconnectBridge, getBridgeStatus, subscribeBridge, type BridgeStatus
} from "@/lib/agent/studioBridge";

/**
 * How to let Claude (or any MCP app) drive this studio tab, in three steps
 * over the live connection state, so the guide ticks its own steps off: add
 * the relay to your AI app (a one-click Claude Desktop extension, one line for
 * Claude Code, a JSON block for the rest — every file served by this very
 * site under /mcp/), connect a sketch tab, then ask. Same shape as Atelier's
 * #/agents guide. Decisions: `docs/memory/agent-commands.md`.
 */

type Client = "desktop" | "code" | "other";

const CLIENT_KEY = "sketchbook:agent-guide-client";
const OFFICIAL_ORIGIN = "https://p5.steeve.website";
const OFF: BridgeStatus = {
  state: "off"
};

const PROMPTS = [
  "Open the voronoi-v1-cells sketch in Sketchbook, tell me what I can adjust, and show me a snapshot.",
  "Give this sketch a sunset palette, put the title “Hello” in the top third, add a HUD gauge for the hue speed, and show me the result.",
  "Make three slides from this sketch with different palettes, then export each one as a square 1080 × 1080 video."
];

function readClient(): Client {
  try {
    const stored = localStorage.getItem( CLIENT_KEY );

    return stored === "code" || stored === "other" ? stored : "desktop";
  } catch {
    return "desktop";
  }
}

/** A command or a snippet, selectable, with a Copy button that says it copied. */
function CodeBlock( {
  code, label, prose = false
}: {
  code: string;
  label: string;
  prose?: boolean;
} ) {
  const [
    copied,
    setCopied
  ] = useState( false );

  useEffect(
    () => {
      if ( !copied ) {
        return;
      }

      const timer = window.setTimeout(
        () => setCopied( false ),
        1600
      );

      return () => window.clearTimeout( timer );
    },
    [
      copied
    ]
  );

  return (
    <div className="relative">
      <pre
        aria-label={ label }
        className={ clsx(
          "m-0 select-all whitespace-pre-wrap rounded-lg border border-theme bg-hover py-2.5 pl-3 pr-20 text-foreground",
          prose ? "wrap-break-word font-sans text-sm leading-snug" : "break-all font-mono text-xs leading-relaxed"
        ) }
      >
        {code}
      </pre>
      <button
        type="button"
        onClick={ () => void navigator.clipboard?.writeText( code ).then(
          () => setCopied( true ),
          () => setCopied( false )
        ) }
        aria-label={ copied ? `${ label } copied` : `Copy ${ label }` }
        className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-md border border-theme bg-background px-2 py-1 text-xs text-label transition-colors hover:text-foreground"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function Hint( {
  children
}: { children: React.ReactNode } ) {
  return <p className="m-0 text-sm leading-relaxed text-label">{children}</p>;
}

function Code( {
  children
}: { children: React.ReactNode } ) {
  return <code className="rounded-sm bg-hover px-1 font-mono text-xs text-foreground">{children}</code>;
}

/** One numbered step; `done` ticks it off from what the page can see. */
function Step( {
  n, title, done = false, children
}: {
  n: number;
  title: string;
  done?: boolean;
  children: React.ReactNode;
} ) {
  return (
    <li className="grid grid-cols-[2rem_1fr] gap-x-3">
      <span
        aria-hidden="true"
        className={ clsx(
          "grid h-8 w-8 place-items-center rounded-full border font-mono text-sm font-semibold",
          done ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-500" : "border-theme text-foreground"
        ) }
      >
        {done ? <Check className="h-4 w-4" /> : n}
      </span>
      <div className="flex min-w-0 flex-col gap-2.5 border-b border-theme pb-5">
        <h3 className="m-0 mt-1 text-base font-medium text-foreground">
          {title}
          {done && <span className="sr-only"> — done</span>}
        </h3>
        {children}
      </div>
    </li>
  );
}

/** One question of "Good to know", folded until asked. */
function Faq( {
  q, children
}: {
  q: string;
  children: React.ReactNode;
} ) {
  return (
    <details className="group border-b border-theme py-2.5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-foreground">
        {q}
        <ChevronDown className="h-4 w-4 shrink-0 text-label transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-2 flex flex-col gap-2 text-sm leading-relaxed text-label">{children}</div>
    </details>
  );
}

function statusText( bridge: BridgeStatus ): string {
  switch ( bridge.state ) {
    case "connected":
      return "Connected — Claude can see this tab.";
    case "connecting":
      return "Connecting…";
    case "error":
      return bridge.message;
    default:
      return "Not connected.";
  }
}

export default function AgentGuideDialog( {
  open, onClose
}: {
  open: boolean;
  onClose: () => void;
} ) {
  const bridge = useSyncExternalStore(
    subscribeBridge,
    getBridgeStatus,
    () => OFF
  );
  const pathname = usePathname();
  const onSketch = pathname.startsWith( "/sketches/" );
  // Mounted only once the menu item is clicked, never server-rendered: the
  // stored app choice and the address the site runs on are read straight away
  // (the downloads below are served by that address).
  const [
    client,
    setClient
  ] = useState<Client>( readClient );
  const [
    savedAt,
    setSavedAt
  ] = useState( "" );
  const [
    origin
  ] = useState( () => typeof window === "undefined" ? OFFICIAL_ORIGIN : window.location.origin );

  const choose = ( next: Client ) => {
    setClient( next );
    try {
      localStorage.setItem(
        CLIENT_KEY,
        next
      );
    } catch {
      // Storage blocked: the choice simply is not remembered.
    }
  };

  const connected = bridge.state === "connected";
  const busy = connected || bridge.state === "connecting";
  // The relay answers loopback pages and the official site; any other host
  // (a self-hosted copy) has to be named to it.
  const extraOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test( origin ) || origin === OFFICIAL_ORIGIN ? null : origin;
  const fileUrl = `${ origin }/mcp/sketchbook-studio-mcp.mjs`;
  const codeLine = `curl -fsSLo ~/.sketchbook-studio-mcp.mjs ${ fileUrl } && claude mcp add sketchbook-studio${ extraOrigin ? ` -e SKETCHBOOK_ORIGINS=${ extraOrigin }` : "" } -- node ~/.sketchbook-studio-mcp.mjs`;
  const jsonPath = savedAt.trim() || "/Users/you/Downloads/sketchbook-studio-mcp.mjs";
  const json = JSON.stringify(
    {
      mcpServers: {
        "sketchbook-studio": {
          command: "node",
          args: [
            jsonPath
          ],
          ...( extraOrigin ? {
            env: {
              SKETCHBOOK_ORIGINS: extraOrigin
            }
          } : {} )
        }
      }
    },
    null,
    2
  );

  return (
    <Dialog
      open={ open }
      onClose={ onClose }
      className="relative z-80"
    >
      <div
        className="fixed inset-0 bg-background/60 backdrop-blur-xs"
        aria-hidden="true"
      />
      <div className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-4">
        <DialogPanel className="glass flex max-h-dvh w-full max-w-2xl flex-col overflow-hidden border border-theme shadow-lg sm:max-h-[90vh] sm:rounded-2xl">
          <div className="flex items-center gap-2 border-b border-theme px-4 py-2.5">
            <Bot className="h-4 w-4 shrink-0 text-foreground" />
            <DialogTitle className="m-0 text-sm font-medium text-foreground">
              Drive the studio with Claude
            </DialogTitle>
            <button
              type="button"
              onClick={ onClose }
              aria-label="Close"
              className="-mr-2 ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-label transition-colors hover:bg-hover hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-col gap-6 overflow-y-auto px-4 pb-6 pt-4 sm:px-6">
            <p className="m-0 text-sm leading-relaxed text-foreground/80">
              Ask in plain words — “a sunset palette, a title at the top, three slides, export them square” — and
              Claude does it in this tab, with the studio’s own controls. You watch every change happen, and ⌘Z
              undoes any of them.
            </p>

            {/* The live connection, so the steps below can tick themselves off. */}
            <div
              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-theme px-3 py-2.5"
              aria-live="polite"
            >
              <span className="font-mono text-xs text-label">This tab</span>
              <span className={ clsx(
                "flex items-center gap-1.5 text-xs font-medium",
                connected ? "text-emerald-500" : bridge.state === "error" ? "text-red-500" : "text-label"
              ) }
              >
                <span className={ clsx(
                  "h-2 w-2 rounded-full",
                  connected ? "bg-emerald-500" : bridge.state === "connecting" ? "animate-pulse bg-amber-500" : bridge.state === "error" ? "bg-red-500" : "bg-foreground/30"
                ) }
                />
                {connected ? "Connected" : bridge.state === "connecting" ? "Connecting" : bridge.state === "error" ? "No relay" : "Off"}
              </span>
              <button
                type="button"
                onClick={ () => busy ? disconnectBridge() : connectBridge() }
                className={ clsx(
                  "ml-auto rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  busy ? "border border-theme text-foreground hover:bg-hover" : "bg-foreground text-background hover:opacity-90"
                ) }
              >
                {busy ? "Disconnect" : "Connect"}
              </button>
              <p className="m-0 basis-full text-xs leading-snug text-label">{statusText( bridge )}</p>
            </div>

            <ol className="m-0 flex list-none flex-col gap-5 p-0">
              <Step
                n={ 1 }
                title="Add Sketchbook to your AI app"
                done={ connected }
              >
                <div
                  role="radiogroup"
                  aria-label="Your AI app"
                  className="grid grid-cols-3 gap-1 rounded-lg border border-theme p-1"
                >
                  {( [
                    [
                      "desktop",
                      "Claude Desktop"
                    ],
                    [
                      "code",
                      "Claude Code"
                    ],
                    [
                      "other",
                      "Other"
                    ]
                  ] as const ).map( ( [
                    id,
                    label
                  ] ) => (
                    <button
                      key={ id }
                      type="button"
                      role="radio"
                      aria-checked={ client === id }
                      onClick={ () => choose( id ) }
                      className={ clsx(
                        "rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                        client === id ? "bg-foreground text-background" : "text-label hover:bg-hover hover:text-foreground"
                      ) }
                    >
                      {label}
                    </button>
                  ) )}
                </div>

                {client === "desktop" && (
                  <>
                    <a
                      href="/mcp/sketchbook-studio.mcpb"
                      download="sketchbook-studio.mcpb"
                      className="flex items-center gap-2 self-start rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background no-underline hover:opacity-90"
                    >
                      <Download className="h-4 w-4" />
                      Download the Sketchbook extension
                    </a>
                    <Hint>
                      Open the downloaded <Code>sketchbook-studio.mcpb</Code> — Claude Desktop shows an install window;
                      click <b className="font-medium text-foreground/80">Install</b>. No terminal, nothing else to set up.
                    </Hint>
                    {extraOrigin && (
                      <Hint>
                        This copy of Sketchbook runs at <Code>{extraOrigin}</Code>, which the extension does not know:
                        use the Claude Code or Other tab, which name it.
                      </Hint>
                    )}
                  </>
                )}

                {client === "code" && (
                  <>
                    <Hint>Paste this once in a terminal — it downloads the relay and registers it:</Hint>
                    <CodeBlock
                      label="the Claude Code command"
                      code={ codeLine }
                    />
                    <Hint>
                      Needs Node.js 18 or newer (<Code>node -v</Code> tells you). The relay starts with each Claude Code
                      session.
                    </Hint>
                  </>
                )}

                {client === "other" && (
                  <>
                    <a
                      href="/mcp/sketchbook-studio-mcp.mjs"
                      download="sketchbook-studio-mcp.mjs"
                      className="flex items-center gap-2 self-start rounded-lg border border-theme px-3 py-2 text-sm font-medium text-foreground no-underline hover:bg-hover"
                    >
                      <Download className="h-4 w-4" />
                      Download the relay
                    </a>
                    <Hint>
                      Any app that speaks MCP (Cursor, Windsurf, VS Code…) takes this block in its MCP settings — in
                      Cursor, <Code>~/.cursor/mcp.json</Code>. It needs the file’s full path:
                    </Hint>
                    <input
                      value={ savedAt }
                      onChange={ ( event ) => setSavedAt( event.target.value ) }
                      placeholder="/Users/you/Downloads/sketchbook-studio-mcp.mjs"
                      aria-label="Where you saved the file"
                      spellCheck={ false }
                      className="w-full rounded-lg border border-theme bg-background px-3 py-2 font-mono text-base text-foreground focus:outline-hidden sm:text-xs"
                    />
                    <CodeBlock
                      label="the MCP settings block"
                      code={ json }
                    />
                    <Hint>Needs Node.js 18 or newer.</Hint>
                  </>
                )}
              </Step>

              <Step
                n={ 2 }
                title="Connect a sketch tab"
                done={ connected }
              >
                <Hint>
                  With your AI app open, {onSketch ? "" : "open the sketch you want to work on, then "}press{" "}
                  <b className="font-medium text-foreground/80">Connect</b> above (or <b className="font-medium text-foreground/80">Connect an agent</b> in the menu). The first time,
                  Chrome asks to let this page reach your computer — choose <b className="font-medium text-foreground/80">Allow</b>.
                  Only this tab is connected, and the menu button wears a green dot while it is.
                </Hint>
                {connected && !onSketch && (
                  <Hint>
                    Connected — but this page is not a sketch, so there is nothing to drive yet: open one from the gallery
                    and the connection follows you.
                  </Hint>
                )}
              </Step>

              <Step
                n={ 3 }
                title="Ask"
              >
                <Hint>Start a new conversation and try one of these:</Hint>
                <div className="flex flex-col gap-2">
                  {PROMPTS.map( (
                    prompt, i
                  ) => (
                    <CodeBlock
                      key={ prompt }
                      label={ `example ${ i + 1 }` }
                      code={ prompt }
                      prose
                    />
                  ) )}
                </div>
              </Step>
            </ol>

            <div>
              <p className="m-0 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-label">Good to know</p>
              <div className="mt-1">
                <Faq q="What can Claude do here?">
                  <p className="m-0">
                    Everything the studio’s controls do: the sketch’s parameters, canvas size and clock, slides, text,
                    images and HUD widgets, moving items, playback, snapshots it can look at, and exports — and open
                    another sketch from the gallery. Values outside a control’s range are refused, never bent.
                  </p>
                </Faq>
                <Faq q="Where do exported files go?">
                  <p className="m-0">
                    Into <Code>Movies/Sketchbook</Code> in your home folder, never over an existing file (a second export
                    becomes <Code>name-1.mp4</Code>). From Claude Code you can choose another folder by adding{" "}
                    <Code>--out ~/somewhere</Code> after the file name.
                  </p>
                </Faq>
                <Faq q="Is my work sent anywhere?">
                  <p className="m-0">
                    No. The relay runs on your computer and talks to this tab over <Code>127.0.0.1</Code> only; it refuses
                    any other website. What Claude sees is what it asks for — answers and the snapshots it takes.
                  </p>
                </Faq>
                <Faq q="It says no relay answers.">
                  <p className="m-0">
                    The relay runs only while your AI app is open — start it (in Claude Code, open a session), then press
                    Connect again. If you changed the port with <Code>--port</Code>, the tab still connects on 7982: use
                    the default port.
                  </p>
                </Faq>
                <Faq q="Claude Desktop and Claude Code at the same time?">
                  <p className="m-0">
                    Yes. Each starts its own relay; the first holds the connection to this tab and the other goes through
                    it — nothing to configure. Exports land in the first one’s folder. Quit that app and the other takes
                    over; the tab reconnects by itself.
                  </p>
                </Faq>
                <Faq q="It says another tab took over.">
                  <p className="m-0">One tab at a time: the last one to connect wins. Press Connect here to take it back.</p>
                </Faq>
                <Faq q="Which browsers work?">
                  <p className="m-0">
                    Chrome, Edge and Arc. Safari may refuse to let a website reach your own computer; Firefox is
                    untested.
                  </p>
                </Faq>
                <Faq q="How do I remove it?">
                  <p className="m-0">
                    Press Disconnect. To uninstall: Claude Desktop → Settings → Extensions, or{" "}
                    <Code>claude mcp remove sketchbook-studio</Code> in Claude Code, then delete the downloaded file.
                  </p>
                </Faq>
              </div>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
