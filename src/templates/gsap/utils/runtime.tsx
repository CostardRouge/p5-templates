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
import {
  toCssColor
} from "./dom";

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
  /** Real-time accumulator for framerate-quantised playback stepping. */
  private accumulator = 0;
  private rafId: number | null = null;
  private playing = false;

  /** Measured playback fps (actual frame steps per second over a window). */
  private measuredFps = 0;
  private fpsFrames = 0;
  private fpsWindow = 0;
  /** Frame-stepped capture mode → progression must not wrap. */
  private recording = false;

  private subscribers = new Set<( progression: number ) => void>();
  private mirrorLoopId: number | null = null;

  /**
   * Cache of `image/background-image URL → data-URL` used when rasterising.
   * An SVG `<foreignObject>` loaded as an image cannot fetch external
   * resources, so media has to be embedded as data-URLs; caching avoids
   * re-fetching + re-encoding the same photo on every captured frame.
   */
  private mediaCache = new Map<string, Promise<string | null>>();

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

    // Wait for the template's images to finish loading before we report ready /
    // prime the mirror. Otherwise the first capture (and the headless recorder,
    // which waits on `data-engine-ready`) can grab a frame with half-loaded or
    // missing photos. Capped so a stuck asset never blocks startup forever.
    await this.waitForImages( 5000 );

    this.scrub();

    // Prime the mirror canvas so `getCanvas()` (e.g. the save-frame button)
    // returns a real still before any recording runs.
    void this.rasterize().catch( () => undefined );

    // Auto-run on mount — the studio UI starts in the `looping: true` state and
    // expects the engine to be animating already (p5 auto-loops on creation).
    // The headless recorder calls `prepare()` first, which pauses this loop.
    this.play();
  }

  /** Resolve once every `<img>` in the stage has loaded (or `timeoutMs` lapses). */
  private async waitForImages( timeoutMs: number ): Promise<void> {
    const stage = this.stage;

    if ( !stage ) {
      return;
    }

    const images = Array.from( stage.querySelectorAll( "img" ) );
    const pending = images
      .filter( ( img ) => !( img.complete && img.naturalWidth > 0 ) )
      .map( ( img ) => new Promise<void>( ( resolve ) => {
        const done = () => resolve();

        img.addEventListener(
          "load",
          done,
          {
            once: true
          }
        );
        img.addEventListener(
          "error",
          done,
          {
            once: true
          }
        );
      } ) );

    if ( pending.length === 0 ) {
      return;
    }

    await Promise.race( [
      Promise.all( pending ),
      new Promise<void>( ( resolve ) => setTimeout(
        resolve,
        timeoutMs
      ) )
    ] );
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

    // Give the capture surface itself an opaque background derived from the
    // sketch. Templates paint their own background on top, so this is invisible
    // in normal display — but it guarantees the headless DOM capture
    // (Playwright `element.screenshot`, which preserves alpha) is never
    // transparent, even before the template has committed its first frame.
    stage.style.background = toCssColor(
      this.options?.sketch?.backgroundColor,
      "#0a0a0c"
    );
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
    this.mediaCache.clear();
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
    this.accumulator = 0;
    this.fpsFrames = 0;
    this.fpsWindow = 0;
    this.startRaf();
  }

  getMeasuredFps(): number {
    return this.measuredFps;
  }

  pause(): void {
    this.playing = false;
    this.stopRaf();
    this.measuredFps = 0;
  }

  stop(): void {
    this.playing = false;
    this.stopRaf();
    this.measuredFps = 0;
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

  /**
   * Leave deterministic capture mode so the progression bar wraps again. The
   * recorder calls this on teardown; without it a sketch that was paused
   * before recording (so teardown calls `pause()`, not `play()`) would stay
   * stuck in clamped-progression mode.
   */
  exitRecordingMode(): void {
    this.recording = false;
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

      // Advance in framerate-sized steps so the preview honours the configured
      // framerate (choppy at low fps, smooth at high) and lands on exactly the
      // frames the recorder will capture. Real-time speed is preserved because
      // we only step once enough wall-clock time has elapsed per frame.
      const frameDuration = 1 / Math.max(
        1,
        this.framerate
      );

      this.accumulator += delta;

      // Cap after a stall (e.g. backgrounded tab) to avoid a burst of steps.
      if ( this.accumulator > 0.25 ) {
        this.accumulator = frameDuration;
      }

      let steps = 0;

      while ( this.accumulator >= frameDuration ) {
        this.elapsed += frameDuration;
        this.accumulator -= frameDuration;
        steps += 1;
      }

      if ( steps > 0 ) {
        this.scrub();
        this.notify();
      }

      // Measure the achieved playback fps (frame steps per second) over a
      // ~0.5s window so the perf label reflects the real framerate, not the
      // monitor refresh rate.
      this.fpsFrames += steps;
      this.fpsWindow += delta;

      if ( this.fpsWindow >= 0.5 ) {
        this.measuredFps = this.fpsFrames / this.fpsWindow;
        this.fpsFrames = 0;
        this.fpsWindow = 0;
      }

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

    // An SVG `<foreignObject>` rendered as an image cannot fetch external
    // resources, so any `<img>`/`background-image` would otherwise show the
    // browser's broken-image glyph. Embed them as data-URLs first.
    await this.inlineMedia( clone );

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

    // Must be a `data:` URL, NOT a blob object-URL: Chromium taints the canvas
    // when an SVG-with-foreignObject image is loaded from a blob URL, and the
    // WebCodecs encoder can't read a tainted canvas (recording would fail). The
    // style-diff + media de-dup above keep this string small enough that the
    // `encodeURIComponent` cost is negligible.
    return `data:image/svg+xml;charset=utf-8,${ encodeURIComponent( svg ) }`;
  }

  /**
   * Replace `<img src>` and inline `background-image: url(…)` references in the
   * clone with embedded data-URLs so they survive the SVG-image rasterisation.
   * Conversions are cached per URL across frames.
   */
  private async inlineMedia( root: HTMLElement ): Promise<void> {
    await inlineMediaInto(
      root,
      ( url ) => {
        let pending = this.mediaCache.get( url );

        if ( !pending ) {
          pending = urlToDataUrl( url );
          this.mediaCache.set(
            url,
            pending
          );
        }

        return pending;
      }
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Rasterisation helpers                                              */
/* ------------------------------------------------------------------ */

/**
 * Rewrite every `<img src>` and inline `background-image: url(…)` under `root`
 * to the data-URL produced by `load(url)`. URLs that already are data-URLs (or
 * fail to load) are left untouched. Exported for testing the rasterisation fix.
 *
 * A `background-image` URL referenced by two or more elements is hoisted into a
 * single CSS custom property on `root` and referenced via `var(…)`, instead of
 * duplicating the (multi-hundred-KB) data-URL on every element. Grid/mosaic
 * templates fill hundreds of tiles from one photo, and inlining it per tile
 * ballooned the serialised SVG to tens of MB — the dominant per-frame cost.
 */
export async function inlineMediaInto(
  root: HTMLElement,
  load: ( url: string ) => Promise<string | null>
): Promise<void> {
  const imgs = Array.from( root.querySelectorAll( "img" ) ).filter( ( img ) => {
    const src = img.getAttribute( "src" );

    return Boolean( src && !src.startsWith( "data:" ) );
  } );

  // Collect `background-image: url(…)` references (root included) up front so
  // we can count how many elements share each URL before rewriting.
  const backgrounds: { el: HTMLElement;
    url: string }[] = [];
  const candidates = [
    root,
    ...Array.from( root.querySelectorAll<HTMLElement>( "*" ) )
  ];

  candidates.forEach( ( el ) => {
    const backgroundImage = el.style?.backgroundImage;

    if ( !backgroundImage || backgroundImage === "none" ) {
      return;
    }

    const match = backgroundImage.match( /url\((['"]?)(.*?)\1\)/ );
    const url = match?.[ 2 ];

    if ( !url || url.startsWith( "data:" ) ) {
      return;
    }

    backgrounds.push( {
      el,
      url
    } );
  } );

  // Resolve every unique URL once (the upstream `load` is itself cached across
  // frames, so this only fans out the first time a photo is seen).
  const uniqueUrls = new Set<string>( [
    ...imgs.map( ( img ) => img.getAttribute( "src" )! ),
    ...backgrounds.map( ( b ) => b.url )
  ] );
  const dataUrlByUrl = new Map<string, string | null>();

  await Promise.all( Array.from( uniqueUrls ).map( async( url ) => {
    dataUrlByUrl.set(
      url,
      await load( url )
    );
  } ) );

  imgs.forEach( ( img ) => {
    const dataUrl = dataUrlByUrl.get( img.getAttribute( "src" )! );

    if ( dataUrl ) {
      img.setAttribute(
        "src",
        dataUrl
      );
    }
  } );

  // Tally background usages so repeated photos can be hoisted to a custom prop.
  const usage = new Map<string, number>();

  backgrounds.forEach( ( {
    url
  } ) => usage.set(
    url,
    ( usage.get( url ) ?? 0 ) + 1
  ) );

  const varNameByUrl = new Map<string, string>();

  backgrounds.forEach( ( {
    el, url
  } ) => {
    const dataUrl = dataUrlByUrl.get( url );

    if ( !dataUrl ) {
      return;
    }

    // Single-use background → inline the data-URL directly (no var overhead).
    if ( ( usage.get( url ) ?? 0 ) < 2 ) {
      el.style.backgroundImage = `url("${ dataUrl }")`;

      return;
    }

    let varName = varNameByUrl.get( url );

    if ( !varName ) {
      varName = `--media-${ varNameByUrl.size }`;
      varNameByUrl.set(
        url,
        varName
      );
      // Custom properties inherit, so defining it once on `root` puts it in
      // scope for every descendant tile that references it.
      root.style.setProperty(
        varName,
        `url("${ dataUrl }")`
      );
    }

    el.style.backgroundImage = `var(${ varName })`;
  } );
}

/**
 * Fetch a (same-origin) media URL and return it as a data-URL, preserving the
 * original bytes/encoding. Resolves to `null` on any failure so rasterisation
 * can fall back gracefully rather than throwing.
 */
async function urlToDataUrl( url: string ): Promise<string | null> {
  try {
    const response = await fetch(
      url,
      {
        cache: "force-cache"
      }
    );

    if ( !response.ok ) {
      return null;
    }

    const blob = await response.blob();

    return await new Promise<string | null>( ( resolve ) => {
      const reader = new FileReader();

      reader.onload = () =>
        resolve( typeof reader.result === "string" ? reader.result : null );
      reader.onerror = () => resolve( null );
      reader.readAsDataURL( blob );
    } );
  } catch {
    return null;
  }
}

const XHTML_NS = "http://www.w3.org/1999/xhtml";

/**
 * CSS properties that inherit and affect pixels. They are always written out
 * (never dropped as "equal to default"): inside the foreignObject a dropped
 * inherited property would resolve to the ancestor's value rather than the UA
 * default, so an element deliberately reset to a default-looking value under a
 * non-default ancestor would otherwise render wrong. Non-inherited properties
 * have no such hazard — dropping them falls back to the initial value, which is
 * exactly what `===` against the UA default guarantees.
 */
const INHERITED_VISUAL_PROPS = new Set( [
  "color",
  "direction",
  "font-family",
  "font-size",
  "font-stretch",
  "font-style",
  "font-variant",
  "font-weight",
  "font-feature-settings",
  "font-kerning",
  "font-optical-sizing",
  "font-variation-settings",
  "letter-spacing",
  "line-height",
  "list-style-image",
  "list-style-position",
  "list-style-type",
  "quotes",
  "tab-size",
  "text-align",
  "text-align-last",
  "text-indent",
  "text-justify",
  "text-orientation",
  "text-rendering",
  "text-shadow",
  "text-transform",
  "visibility",
  "white-space",
  "word-break",
  "word-spacing",
  "overflow-wrap",
  "writing-mode",
  "hyphens",
  "caret-color",
  "color-scheme",
  "accent-color",
  "-webkit-font-smoothing",
  "-webkit-text-size-adjust",
  "-webkit-text-stroke-color",
  "-webkit-text-stroke-width"
] );

/**
 * Per-tag cache of the browser's *default* computed style, measured in an
 * isolated blank iframe (no author stylesheet). Used to emit only the
 * properties that actually differ from the UA default when inlining styles.
 *
 * Why: the SVG `<foreignObject>` has no stylesheet cascade, so every element
 * must carry its style inline. Dumping all ~350 computed properties per node
 * inflated the serialised SVG to tens of MB on dense templates (e.g. 242 nodes
 * → ~43 MB), and the per-frame SVG-image decode of that blob was the recording
 * bottleneck (~1 fps). Diffing against the UA defaults drops the inline style
 * to the handful of properties that matter, shrinking the SVG ~10x and the
 * decode + serialise time with it — computed values are already absolute
 * (resolved px/rgb), so the diff stays correct inside the foreignObject.
 */
let defaultsFrame: HTMLIFrameElement | null = null;
const defaultStyleCache = new Map<string, Record<string, string>>();

function getDefaultsDocument(): Document | null {
  if ( defaultsFrame?.contentDocument?.body ) {
    return defaultsFrame.contentDocument;
  }

  const frame = document.createElement( "iframe" );

  frame.setAttribute(
    "aria-hidden",
    "true"
  );
  frame.style.cssText =
    "position:fixed;top:-10000px;left:-10000px;width:0;height:0;border:0;";
  document.body.appendChild( frame );

  const doc = frame.contentDocument;

  if ( !doc ) {
    frame.remove();

    return null;
  }

  doc.open();
  doc.write( "<!DOCTYPE html><html><head></head><body></body></html>" );
  doc.close();
  defaultsFrame = frame;

  return doc;
}

/** UA default computed style for `tagName`, cached + measured in isolation. */
function getDefaultStyleFor( tagName: string ): Record<string, string> | null {
  const key = tagName.toLowerCase();
  const cached = defaultStyleCache.get( key );

  if ( cached ) {
    return cached;
  }

  const doc = getDefaultsDocument();

  if ( !doc?.defaultView ) {
    return null;
  }

  const element = doc.createElement( key );

  doc.body.appendChild( element );

  const computed = doc.defaultView.getComputedStyle( element );
  const map: Record<string, string> = {};

  for ( let i = 0; i < computed.length; i++ ) {
    const property = computed[ i ];

    map[ property ] = computed.getPropertyValue( property );
  }

  element.remove();
  defaultStyleCache.set(
    key,
    map
  );

  return map;
}

function inlineComputedStyles(
  source: Element,
  target: Element
): void {
  const computed = window.getComputedStyle( source );

  // Only HTML elements are default-diffed; foreign (SVG/MathML) elements have
  // namespace-specific UA defaults, so they keep the full dump to stay safe.
  const isHtml = !source.namespaceURI || source.namespaceURI === XHTML_NS;
  const defaults = isHtml ? getDefaultStyleFor( source.tagName ) : null;

  let cssText = "";

  for ( let i = 0; i < computed.length; i++ ) {
    const property = computed[ i ];
    const value = computed.getPropertyValue( property );

    // Skip non-inherited properties already at their UA default — they render
    // identically inside the foreignObject without being spelled out. Inherited
    // visual properties are always emitted (see INHERITED_VISUAL_PROPS).
    if (
      defaults &&
      defaults[ property ] === value &&
      !INHERITED_VISUAL_PROPS.has( property )
    ) {
      continue;
    }

    cssText += `${ property }:${ value };`;
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
