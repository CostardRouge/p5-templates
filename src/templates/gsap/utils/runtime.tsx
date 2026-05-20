"use client";

/**
 * GSAP / HTML engine runtime.
 *
 * Analogous to the p5 `sketch.js` runtime, but for DOM templates animated
 * with GSAP. Responsibilities:
 *
 *   • Mount a template React component (`.jsx`) into a fixed-size "stage".
 *   • Build a **paused** GSAP timeline from the template and scrub it off a
 *     frame clock so playback is deterministic and seekable (identical FE &
 *     BE output, exact per-frame capture).
 *   • Register an engine-agnostic `AnimationBridge` so the shared UI
 *     (play/pause, progression scrubber) drives it without knowing it's GSAP.
 *   • Subscribe to the shared `syncSketchOptions` store so option edits
 *     re-render the DOM and rebuild the timeline (the "options sync system").
 *   • Rasterise the stage DOM into a mirror `<canvas>` for client-side
 *     recording (the headless recorder screenshots the DOM directly instead).
 *
 * A single template runs at a time, so the runtime is a module-level
 * singleton — same pattern as the p5 runtime.
 */
import React, {
  createContext, useContext, useLayoutEffect
} from "react";
import {
  createRoot, type Root
} from "react-dom/client";
import gsap from "gsap";
import {
  registerAnimationBridge, unregisterAnimationBridge
} from "@/lib/animationBridge";
import {
  getSketchOptions, setSketchOptions, subscribeSketchOptions
} from "@/lib/syncSketchOptions";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type TimelineBuildArgs = {
  /** The paused timeline to populate. */
  tl: gsap.core.Timeline;
  /** The GSAP instance (so templates needn't import it separately). */
  gsap: typeof gsap;
  /** The stage element — use as a selector scope for `tl.from(".x", …)`. */
  root: HTMLElement;
  /** Current resolved sketch options. */
  options: Record<string, any>;
};

export type TimelineBuilder = ( args: TimelineBuildArgs ) => void;

type RuntimeContextValue = {
  /** Bumped on every options update so `useTimeline` rebuilds. */
  version: number;
  options: Record<string, any>;
};

const DEFAULT_SIZE = {
  width: 1080,
  height: 1350
};
const DEFAULT_ANIMATION = {
  framerate: 60,
  duration: 12
};

/* ------------------------------------------------------------------ */
/*  React context (connects templates' `useTimeline` to the runtime)   */
/* ------------------------------------------------------------------ */

const RuntimeContext = createContext<RuntimeContextValue>( {
  version: 0,
  options: {}
} );

/* ------------------------------------------------------------------ */
/*  Runtime singleton                                                  */
/* ------------------------------------------------------------------ */

class GsapRuntime {
  private container: HTMLElement | null = null;
  private stage: HTMLDivElement | null = null;
  private mirror: HTMLCanvasElement | null = null;
  private root: Root | null = null;

  private timeline: gsap.core.Timeline | null = null;
  private ctx: gsap.Context | null = null;
  private builder: TimelineBuilder | null = null;

  private options: Record<string, any> = {};
  private optionsVersion = 0;
  private unsubscribeOptions: ( () => void ) | null = null;

  /** Wall-clock progression of the timeline, in seconds. */
  private elapsed = 0;
  private lastTick = 0;
  private rafId: number | null = null;
  private playing = false;
  /** Frame-stepped capture mode → progression must not wrap. */
  private recording = false;

  private subscribers = new Set<( progression: number ) => void>();
  private mirrorLoopId: number | null = null;

  /* ---- derived settings ---------------------------------------- */

  get size() {
    return this.options.size ?? DEFAULT_SIZE;
  }

  get framerate(): number {
    return this.options.animation?.framerate ?? DEFAULT_ANIMATION.framerate;
  }

  get duration(): number {
    return this.options.animation?.duration ?? DEFAULT_ANIMATION.duration;
  }

  get totalFrames(): number {
    return Math.max(
      1,
      Math.round( this.duration * this.framerate )
    );
  }

  /* ---- lifecycle ------------------------------------------------- */

  async start(
    container: HTMLElement,
    component: React.ComponentType<{ options: Record<string, any> }>
  ): Promise<void> {
    this.container = container;
    this.options = getSketchOptions();

    // Fixed-size stage the template renders into. The ScalableViewport
    // measures + scales this box just like it does the p5 canvas.
    const stage = document.createElement( "div" );

    stage.className = "gsap-stage sketch-surface";
    stage.setAttribute(
      "data-capture-surface",
      "gsap"
    );
    stage.setAttribute(
      "data-slide",
      "0"
    );
    this.applyStageSize( stage );
    container.appendChild( stage );
    this.stage = stage;

    // Hidden mirror canvas used for client-side recording only.
    const mirror = document.createElement( "canvas" );

    mirror.className = "gsap-mirror-canvas";
    mirror.style.display = "none";
    mirror.width = this.size.width;
    mirror.height = this.size.height;
    container.appendChild( mirror );
    this.mirror = mirror;

    // Mount the template. The component renders the DOM structure; the
    // `useTimeline` hook (called inside it) registers the animation.
    this.root = createRoot( stage );
    this.renderTree( component );

    // Re-render + rebuild whenever options change anywhere in the app.
    this.unsubscribeOptions = subscribeSketchOptions( ( opts ) => {
      this.applyOptions(
        opts,
        component
      );
    } );

    this.registerBridge();

    // Let React commit + the timeline build before resolving.
    await new Promise<void>( ( resolve ) =>
      requestAnimationFrame( () => requestAnimationFrame( () => resolve() ) ) );

    this.scrub();

    // Prime the mirror canvas so `getCanvas()` (e.g. the save-frame button)
    // returns a real still before any recording runs.
    void this.rasterize().catch( () => undefined );

    // Auto-run on mount — the studio UI starts in the `looping: true` state and
    // expects the engine to be animating already (p5 auto-loops on creation).
    // The headless recorder calls `prepare()` first, which pauses this loop.
    this.play();
  }

  private currentComponent:
    | React.ComponentType<{ options: Record<string, any> }>
    | null = null;

  private renderTree( component: React.ComponentType<{ options: Record<string, any> }> ): void {
    this.currentComponent = component;

    const value: RuntimeContextValue = {
      version: this.optionsVersion,
      options: this.options
    };

    this.root?.render( <RuntimeContext.Provider value={ value }>
      { React.createElement(
        component,
        {
          options: this.options
        }
      ) }
    </RuntimeContext.Provider> );
  }

  private applyOptions(
    opts: Record<string, any>,
    component?: React.ComponentType<{ options: Record<string, any> }>
  ): void {
    this.options = {
      ...opts
    };
    this.optionsVersion += 1;

    if ( this.stage ) {
      this.applyStageSize( this.stage );
    }

    if ( this.mirror ) {
      this.mirror.width = this.size.width;
      this.mirror.height = this.size.height;
    }

    const target = component ?? this.currentComponent;

    if ( target ) {
      this.renderTree( target );
    }
  }

  private applyStageSize( stage: HTMLElement ): void {
    const {
      width, height
    } = this.size;

    stage.style.position = "relative";
    stage.style.width = `${ width }px`;
    stage.style.height = `${ height }px`;
    stage.style.overflow = "hidden";
  }

  reset(): void {
    this.stopRaf();
    this.stopMirrorLoop();
    this.unsubscribeOptions?.();
    this.unsubscribeOptions = null;

    this.ctx?.revert();
    this.ctx = null;
    this.timeline = null;
    this.builder = null;

    this.root?.unmount();
    this.root = null;

    this.stage?.remove();
    this.mirror?.remove();
    this.stage = null;
    this.mirror = null;
    this.container = null;

    unregisterAnimationBridge();

    this.subscribers.clear();
    this.elapsed = 0;
    this.playing = false;
    this.recording = false;
    this.optionsVersion = 0;
    this.currentComponent = null;
  }

  /* ---- timeline -------------------------------------------------- */

  /** Called by `useTimeline` after the template's DOM is committed. */
  registerTimeline( builder: TimelineBuilder ): void {
    this.builder = builder;
    this.rebuildTimeline();
  }

  private rebuildTimeline(): void {
    if ( !this.stage || !this.builder ) {
      return;
    }

    // Revert the previous run (kills tweens + restores inline styles) so
    // the rebuild starts from a clean DOM.
    this.ctx?.revert();

    const stage = this.stage;
    const builder = this.builder;
    const options = this.options;

    this.ctx = gsap.context(
      () => {
        const tl = gsap.timeline( {
          paused: true
        } );

        builder( {
          tl,
          gsap,
          root: stage,
          options
        } );
        this.timeline = tl;
      },
      stage
    );

    this.scrub();
  }

  /** Apply the timeline state for the current `elapsed` time. */
  private scrub(): void {
    // The canonical loop length is the animation `duration` (matches the
    // progression bar and the p5 model). During playback we wrap so the whole
    // timeline — intro included — restarts every loop. During deterministic
    // capture `elapsed` is always < duration, so no wrap is applied.
    const span = this.duration || 1;
    const time = this.recording ? this.elapsed : this.elapsed % span;

    // `suppressEvents = true` keeps callbacks from firing while scrubbing.
    this.timeline?.time(
      time,
      true
    );
  }

  /* ---- playback -------------------------------------------------- */

  play(): void {
    if ( this.playing ) {
      return;
    }

    this.playing = true;
    this.recording = false;
    this.lastTick = performance.now();
    this.startRaf();
  }

  pause(): void {
    this.playing = false;
    this.stopRaf();
  }

  stop(): void {
    this.playing = false;
    this.stopRaf();
    this.elapsed = 0;
    this.scrub();
    this.notify();
  }

  /** Re-apply the current frame without advancing (scrubbing while paused). */
  redraw(): void {
    this.scrub();
    this.notify();

    // Keep the mirror in sync for the save-frame button. Skipped during
    // deterministic capture, where the recorder rasterises each frame itself.
    if ( !this.recording ) {
      void this.rasterize().catch( () => undefined );
    }
  }

  seekFrame( frame: number ): void {
    this.elapsed = frame / this.framerate;
    this.scrub();
    this.notify();
  }

  getProgression(): number {
    const span = this.duration || 1;

    if ( this.recording ) {
      return Math.min(
        this.elapsed / span,
        1
      );
    }

    return ( this.elapsed % span ) / span;
  }

  setProgression( value: number ): void {
    const clamped = Math.max(
      0,
      Math.min(
        1,
        value
      )
    );

    this.elapsed = clamped * this.duration;
    this.scrub();
    this.notify();
  }

  async resetToStart(): Promise<void> {
    this.elapsed = 0;
    this.scrub();
    this.notify();
    await new Promise( ( r ) => requestAnimationFrame( r ) );
  }

  /** Switch into deterministic, frame-stepped capture mode. */
  enterRecordingMode(): void {
    this.recording = true;
    this.playing = false;
    this.stopRaf();
    this.elapsed = 0;
    this.scrub();
  }

  private startRaf(): void {
    if ( this.rafId !== null ) {
      return;
    }

    const tick = ( now: number ) => {
      if ( !this.playing ) {
        this.rafId = null;
        return;
      }

      const delta = ( now - this.lastTick ) / 1000;

      this.lastTick = now;
      this.elapsed += delta;
      this.scrub();
      this.notify();

      this.rafId = requestAnimationFrame( tick );
    };

    this.rafId = requestAnimationFrame( tick );
  }

  private stopRaf(): void {
    if ( this.rafId !== null ) {
      cancelAnimationFrame( this.rafId );
      this.rafId = null;
    }
  }

  /* ---- animation bridge ----------------------------------------- */

  private registerBridge(): void {
    registerAnimationBridge( {
      getProgression: () => this.getProgression(),
      setProgression: ( value ) => this.setProgression( value ),
      pause: () => this.pause(),
      resume: () => this.play(),
      redraw: () => this.redraw(),
      subscribe: ( cb ) => {
        this.subscribers.add( cb );

        return () => this.subscribers.delete( cb );
      }
    } );
  }

  private notify(): void {
    if ( this.subscribers.size === 0 ) {
      return;
    }

    const progression = this.getProgression();

    this.subscribers.forEach( ( cb ) => cb( progression ) );
  }

  /* ---- capture surface ------------------------------------------ */

  getMirrorCanvas(): HTMLCanvasElement | null {
    return this.mirror;
  }

  /** Rasterise the current stage DOM into the mirror canvas. */
  async rasterize(): Promise<HTMLCanvasElement> {
    const stage = this.stage;
    const canvas = this.mirror;

    if ( !stage || !canvas ) {
      throw new Error( "GsapRuntime: no stage/mirror to rasterise." );
    }

    const {
      width, height
    } = this.size;

    if ( canvas.width !== width ) {
      canvas.width = width;
    }

    if ( canvas.height !== height ) {
      canvas.height = height;
    }

    const dataUrl = await this.stageToSvgDataUrl(
      stage,
      width,
      height
    );
    const image = await loadImage( dataUrl );
    const context = canvas.getContext( "2d" );

    if ( !context ) {
      throw new Error( "GsapRuntime: 2D context unavailable." );
    }

    context.clearRect(
      0,
      0,
      width,
      height
    );
    context.drawImage(
      image,
      0,
      0,
      width,
      height
    );

    return canvas;
  }

  beginRealtimeMirror(): void {
    if ( this.mirrorLoopId !== null ) {
      return;
    }

    const loop = () => {
      this.rasterize().catch( () => undefined );
      this.mirrorLoopId = requestAnimationFrame( loop );
    };

    this.mirrorLoopId = requestAnimationFrame( loop );
  }

  stopMirrorLoop(): void {
    if ( this.mirrorLoopId !== null ) {
      cancelAnimationFrame( this.mirrorLoopId );
      this.mirrorLoopId = null;
    }
  }

  /**
   * Serialise the stage into an SVG `<foreignObject>` data-URL with all
   * computed styles inlined. Chromium can `drawImage` this without tainting
   * the canvas as long as embedded media is same-origin / CORS-enabled.
   */
  private async stageToSvgDataUrl(
    stage: HTMLElement,
    width: number,
    height: number
  ): Promise<string> {
    const clone = stage.cloneNode( true ) as HTMLElement;

    inlineComputedStyles(
      stage,
      clone
    );

    // Neutralise the layout transforms applied to the live stage so the
    // clone renders at native resolution inside the SVG.
    clone.style.transform = "none";
    clone.style.margin = "0";

    const xhtml = new XMLSerializer().serializeToString( clone );
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${ width }" height="${ height }">` +
      `<foreignObject x="0" y="0" width="${ width }" height="${ height }">` +
      `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${ width }px;height:${ height }px;">${ xhtml }</div>` +
      "</foreignObject></svg>";

    return `data:image/svg+xml;charset=utf-8,${ encodeURIComponent( svg ) }`;
  }
}

/* ------------------------------------------------------------------ */
/*  Rasterisation helpers                                              */
/* ------------------------------------------------------------------ */

function inlineComputedStyles(
  source: Element,
  target: Element
): void {
  const computed = window.getComputedStyle( source );
  let cssText = "";

  for ( let i = 0; i < computed.length; i++ ) {
    const property = computed[ i ];

    cssText += `${ property }:${ computed.getPropertyValue( property ) };`;
  }

  ( target as HTMLElement ).setAttribute(
    "style",
    cssText
  );

  const sourceChildren = source.children;
  const targetChildren = target.children;

  for ( let i = 0; i < sourceChildren.length; i++ ) {
    if ( targetChildren[ i ] ) {
      inlineComputedStyles(
        sourceChildren[ i ],
        targetChildren[ i ]
      );
    }
  }
}

function loadImage( src: string ): Promise<HTMLImageElement> {
  return new Promise( (
    resolve, reject
  ) => {
    const image = new Image();

    image.onload = () => resolve( image );
    image.onerror = () => reject( new Error( "GsapRuntime: failed to rasterise stage." ) );
    image.src = src;
  } );
}

/* ------------------------------------------------------------------ */
/*  Public template-facing API                                         */
/* ------------------------------------------------------------------ */

const runtime = new GsapRuntime();

/**
 * Register a GSAP timeline for the current template.
 *
 * Call inside a template component. The `build` callback receives a paused
 * timeline + the stage root; add tweens to it and the engine scrubs it by
 * frame. Pass option-derived values in `deps` (the hook also rebuilds on any
 * options change automatically).
 */
export function useTimeline(
  build: TimelineBuilder,
  deps: React.DependencyList = []
): void {
  const {
    version
  } = useContext( RuntimeContext );

  // The timeline is rebuilt on any options change (`version`) plus the
  // author-declared `deps`. `build` is intentionally excluded — it's a fresh
  // closure each render and would otherwise rebuild the timeline every frame.
  /* eslint-disable react-hooks/exhaustive-deps */
  useLayoutEffect(
    () => {
      runtime.registerTimeline( build );
    },
    [
      ...deps,
      version
    ]
  );
  /* eslint-enable react-hooks/exhaustive-deps */
}

/** Imperatively update sketch options (flows through the shared store). */
export function updateSketchOptions( partial: Record<string, any> ): void {
  setSketchOptions(
    partial,
    "react"
  );
}

export {
  RuntimeContext, gsap
};
export default runtime;
