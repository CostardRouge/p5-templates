/* ------------------------------------------------------------------ */
/*  Imports                                                           */
/* ------------------------------------------------------------------ */

import events from "./events.js";
import exif from "./exif.js";
import cache from "./cache.js";
import sketch from "./sketch.js";
import {
  getP5, getContainer
} from "./sketch.js";

import {
  getSketchOptions, setSketchOptions, subscribeSketchOptions
} from "../shared/syncSketchOptions.js";

import {
  resolveAssetURL,
  structuredClone,
  valuesEqual
} from "../shared/utils.js";

import {
  loadImageAsset
} from "./assetLoaders.js";

import {
  collectSketchImagePaths
} from "@/lib/assets/collectAssetPaths";

import {
  planLoadingSteps
} from "@/lib/assets/loadingProgress";

import {
  coerceFramerate
} from "./framerate.js";

import {
  mergeSlideOverride
} from "@/lib/effectiveSlideSettings";

import animation from "./animation.js";

import {
  resolveBindings, computeBindingSignals
} from "./interaction/bindings.js";
import {
  sampleChannels, midiPortName
} from "./interaction/channels.js";

import {
  resolveControl
} from "./interaction/controllerMap.js";

import {
  getDeclaredBindings
} from "@/lib/declaredBindings";

import {
  publishMidiPortName
} from "@/lib/channelBridge";
import {
  publishChannels, publishBindingSignals
} from "@/lib/channelBridge";

import {
  interactionBindingsEnabled
} from "@/lib/interactionBindings";

// The interaction-bindings plugin gate. Read once — it's a build-time flag, so
// when off the per-frame channel sampling/publishing and binding resolution are
// skipped entirely and a normal sketch pays nothing for the feature.
const BINDINGS_ENABLED = interactionBindingsEnabled();

/* ------------------------------------------------------------------ */
/*  Debounced, de-duplicated asset refresher                          */
/* ------------------------------------------------------------------ */

let refreshTimer = -1;

function refreshAssets() {
  let immediate;

  if ( refreshTimer === -1 ) {
    immediate = _refreshAssets();
  }

  clearTimeout( refreshTimer );
  refreshTimer = setTimeout(
    _refreshAssets,
    80
  );

  // Returned so the engine's preload phase can await the initial load
  // (p5 v2 loadImage is promise-based; there is no blocking preload()).
  return immediate;
}

async function _refreshAssets() {
  // The 80ms debounce above outlives the sketch: leaving a sketch page fires
  // `sketch.destroy()` (which does `setP5( null )`) while a refresh is still
  // pending, and `getP5().loadImage()` below then throws on null. Bail out
  // instead — there is no sketch left to load assets into. Returning before
  // touching the cache matters: a half-filled `imagesMap` would memoise
  // `img: null` entries that the `if ( !obj )` check never retries.
  //
  // This only trips when no sketch is alive. `refreshAssets` is registered on
  // `engine-window-preload`, which always runs after the instance exists.
  if ( !getP5() ) {
    return;
  }

  const opts = getSketchOptions();

  // The same collector the engine's loading planner uses, so the declared
  // total and the steps actually opened below can never disagree about what
  // counts as an image.
  const allPaths = collectSketchImagePaths( opts );

  if ( allPaths.length === 0 ) {
    planLoadingSteps(
      {
        image: 0
      },
      {
        exact: true
      }
    );
    cache.set(
      "imagesMap",
      new Map()
    );
    cache.set(
      "images",
      []
    );
    const container = getContainer();
    const canvas = container?.querySelector( "canvas" ) ?? document.querySelector( "canvas.p5Canvas" );

    canvas?.classList.add( "loaded" );
    return;
  }

  const prevMap = cache.get( "imagesMap" ) ?? new Map();
  const newMap = new Map();

  // Correct the engine's optimistic plan now that the cache is in view. This
  // is load-bearing: `cache` is a module singleton that is never cleared, so
  // revisiting a sketch whose images are still warm opens NO step for them —
  // a plan counting every requested path would then overshoot and strand the
  // progress bar part-way. Only this function knows which paths are cached.
  planLoadingSteps(
    {
      image: allPaths.filter( ( path ) => !prevMap.get( path ) ).length
    },
    {
      exact: true
    }
  );

  for ( const path of allPaths ) {
    const url = resolveAssetURL(
      path,
      opts.id
    );

    let obj = prevMap.get( path );

    // Keyed on the RESOLVED URL, not on the path: a path can be re-pointed at
    // a different file (a fresh upload re-registering its blob, a job id
    // arriving) and memoising on the path alone leaves the old pixels on
    // screen with nothing short of a page reload to shift them.
    if ( obj && obj.url !== url ) {
      obj.img?.remove?.();
      obj = undefined;
    }

    if ( !obj ) {
      obj = {
        path,
        url,
        filename: path.split( "/" ).pop(),
        img: null,
        // Resolves once the image is decoded — awaitable by sketches, and
        // already tracked so capture and the loading report wait on it.
        ready: null,
        exif: undefined
      };

      // The failure callback is load-bearing: without one p5 never decrements
      // its preload counter for a failed image, so one stale asset path (e.g.
      // a `global/...` S3 object that no longer exists) would hang the whole
      // sketch on the loading screen forever. On failure the 1×1 placeholder
      // is dropped so sketches see "no image" instead of a broken pixel.
      // `loadImageAsset` always wires one up and reports the load as a step.
      const {
        img,
        ready
      } = loadImageAsset(
        url,
        {
          onError: () => {
            console.warn( `[assets] failed to load image: ${ url }` );
            obj.img = null;
          }
        }
      );

      obj.img = img;
      obj.ready = ready;

      readExifInfo(
        obj,
        url
      );
    }

    newMap.set(
      path,
      obj
    );
    prevMap.delete( path );
  }

  prevMap.forEach( ( o ) => {
    o.img?.remove?.();
    delete o.exif;
  } );

  cache.set(
    "imagesMap",
    newMap
  );
  cache.set(
    "images",
    [
      ...newMap.values()
    ]
  );

  // p5 2 has no blocking preload(): the engine awaits this function during
  // setup instead, so resolve only once every image has decoded (or failed).
  await Promise.all( [
    ...newMap.values()
  ].map( ( o ) => o.ready ) );
}

async function readExifInfo(
  object, url
) {
  try {
    let tags;

    try {
      tags = url.startsWith( "blob:" )
        ? await exif.load( await ( await fetch( url ) ).arrayBuffer() )
        : await exif.load( url );
    } catch( error ) {
      console.error(
        "readExifInfo error",
        error
      );
      tags = null;
    }

    object.exif = tags;
  } catch( e ) {
    console.warn(
      "[EXIF] fail",
      object.path,
      e
    );
    object.exif = null;
  }
}

/* ------------------------------------------------------------------ */
/*  Canvas "loaded" indicator once EXIF results return               */
/* ------------------------------------------------------------------ */

function markLoadedWhenExifReady() {
  const container = getContainer();
  const c = container?.querySelector( "canvas" ) ?? document.querySelector( "canvas.p5Canvas" );

  if ( !c || c.classList.contains( "loaded" ) ) {
    return;
  }
  if ( cache.get( "images" )?.every( ( img ) => img.exif === undefined ) ) {
    return;
  }
  c.classList.add( "loaded" );
}

/* ------------------------------------------------------------------ */
/*  Event hooks                                                       */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Options change tracking                                           */
/* ------------------------------------------------------------------ */

let previousOptions = {
  size: null,
  animation: null,
  effectiveSize: null,
  effectiveAnimation: null
};

let unsubscribe = null;

/**
 * Resolve the effective size/animation for the current slide.
 * Per-slide overrides win; otherwise global values are used.
 *
 * Uses the resolved `slide` object (not the raw index): rendering coerces
 * a null/out-of-range index to slide 0, so the effective settings must
 * follow the slide that is actually drawn — otherwise a transiently null
 * index would silently mask every per-slide override.
 */
function getEffective( opts ) {
  const current = typeof window !== "undefined" && window.getCurrentSlide
    ? window.getCurrentSlide()
    : null;
  const slide = current?.slide ?? null;

  return {
    size: mergeSlideOverride(
      opts?.size,
      slide?.size
    ),
    animation: mergeSlideOverride(
      opts?.animation,
      slide?.animation
    )
  };
}

/**
 * Handle options changes and trigger appropriate events
 */
function handleOptionsChange(
  newOptions, origin
) {
  // Skip if this update came from the p5 engine itself to avoid loops
  if ( origin === "p5" ) {
    return;
  }

  let hasChanges = false;

  const {
    size: effectiveSize,
    animation: effectiveAnimation
  } = getEffective( newOptions );

  // Check for effective size changes (slide override or global)
  if ( effectiveSize && !valuesEqual(
    effectiveSize,
    previousOptions.effectiveSize
  ) ) {
    const {
      width,
      height
    } = effectiveSize;

    if ( width && height ) {
      events.handle(
        "engine-resize-canvas",
        width,
        height
      );

      // Update sketch options reference
      if ( sketch.sketchOptions ) {
        sketch.sketchOptions.size = {
          ...effectiveSize
        };
      }

      previousOptions.effectiveSize = {
        ...effectiveSize
      };
      hasChanges = true;
    }
  }

  // Check for effective animation changes (slide override or global).
  // Duration and framerate are decoupled: the engine clock must pick up a
  // duration change even when the framerate is untouched (or missing from
  // a partial per-slide override), so the sketchOptions update is never
  // gated behind framerate validity.
  if ( effectiveAnimation && !valuesEqual(
    effectiveAnimation,
    previousOptions.effectiveAnimation
  ) ) {
    // Coerce both sides: a framerate may arrive as a numeric string
    // (imported options, persisted job) and must still apply — p5 would
    // silently ignore it otherwise.
    const framerate = coerceFramerate( effectiveAnimation?.framerate );
    const previousFramerate = coerceFramerate( previousOptions.effectiveAnimation?.framerate );

    if ( framerate !== null && framerate !== previousFramerate ) {
      events.handle(
        "engine-framerate-change",
        framerate
      );
    }

    // Update sketch options reference — merge so a partial override
    // (e.g. duration-only) doesn't drop the other animation keys.
    if ( sketch.sketchOptions ) {
      sketch.sketchOptions.animation = {
        ...sketch.sketchOptions.animation,
        ...effectiveAnimation
      };
    }

    previousOptions.effectiveAnimation = {
      ...effectiveAnimation
    };
    hasChanges = true;
  }

  // Also track raw globals for reference
  previousOptions.size = newOptions?.size ? {
    ...newOptions.size
  } : null;
  previousOptions.animation = newOptions?.animation ? {
    ...newOptions.animation
  } : null;

  // Refresh assets if there were any changes or if assets/slides changed.
  // The event payload is the live store, mutated in place — object identities
  // survive value changes, so previous values must be kept as *snapshots*
  // (clones) and compared by value; holding references would make every
  // comparison an a === b hit and asset edits would never refresh.
  const assetsChanged = !valuesEqual(
    newOptions?.assets ?? null,
    previousOptions.assets ?? null
  );
  const slidesChanged = !valuesEqual(
    newOptions?.slides ?? null,
    previousOptions.slides ?? null
  );
  // Root content is watched for the same reason slides are: an embedded-sketch
  // layer holds a whole sketch's parameters, image paths included, so adding or
  // repointing one has to re-run the asset pass.
  const contentChanged = !valuesEqual(
    newOptions?.content ?? null,
    previousOptions.content ?? null
  );

  if ( hasChanges || assetsChanged || slidesChanged || contentChanged ) {
    refreshAssets();

    if ( assetsChanged ) {
      previousOptions.assets = structuredClone( newOptions?.assets ?? null );
    }
    if ( slidesChanged ) {
      previousOptions.slides = structuredClone( newOptions?.slides ?? null );
    }
    if ( contentChanged ) {
      previousOptions.content = structuredClone( newOptions?.content ?? null );
    }
  }
}

/**
 * Initialize options subscription
 */
function initializeOptionsSubscription() {
  // Clean up existing subscription if any
  if ( unsubscribe ) {
    unsubscribe();
    unsubscribe = null;
  }

  // Get initial options and store them
  const initialOptions = getSketchOptions();

  // Baseline on the *effective* values (per-slide overrides included) so
  // a deck loaded with a slide whose animation differs from the globals
  // starts from the right comparison point — and the engine clock starts
  // on the slide's duration, not the global one.
  const {
    size: initialEffectiveSize,
    animation: initialEffectiveAnimation
  } = getEffective( initialOptions );

  if ( initialEffectiveAnimation && sketch.sketchOptions ) {
    sketch.sketchOptions.animation = {
      ...sketch.sketchOptions.animation,
      ...initialEffectiveAnimation
    };
  }

  previousOptions = {
    size: initialOptions?.size ? {
      ...initialOptions.size
    } : null,
    animation: initialOptions?.animation ? {
      ...initialOptions.animation
    } : null,
    effectiveSize: initialEffectiveSize ? {
      ...initialEffectiveSize
    } : null,
    effectiveAnimation: initialEffectiveAnimation ? {
      ...initialEffectiveAnimation
    } : null,
    // Snapshots, not references — the store mutates these in place.
    assets: structuredClone( initialOptions?.assets ?? null ),
    slides: structuredClone( initialOptions?.slides ?? null ),
    content: structuredClone( initialOptions?.content ?? null )
  };

  // Subscribe to future changes
  unsubscribe = subscribeSketchOptions( handleOptionsChange );

  // Sync initial options to sketch
  setSketchOptions(
    initialOptions,
    sketch.sketchOptions?.engine ?? "p5"
  );
}

// Called by sketch.start() on every sketch initialization so that these
// handlers survive a reset() which clears events.registeredEvents.
export function registerEvents() {
  events.register(
    "engine-window-preload",
    refreshAssets
  );
  events.register(
    "pre-draw",
    markLoadedWhenExifReady
  );
  events.register(
    "pre-draw",
    publishChannelsFrame
  );
  events.register(
    "pre-setup",
    initializeOptionsSubscription
  );
  events.register(
    "pre-setup",
    initInteractionForOptions
  );
}

// Tracks whether the interaction handler was booted for the current sketch, so
// dispose-on-reset only loads the (lazy) module when there's something to free.
let _interactionInited = false;

// The handler-managed source groups, each gated by its own `enabled` flag
// (`vision` covers all camera trackers). Mirrors the per-source guards the
// collectors in interaction/index.js check, like interactionEnablePaths in
// the BindingAffordance does on the form side.
const INTERACTION_SOURCE_GROUPS = [
  "mouse",
  "touch",
  "vision",
  "orbit",
  "perlinNoise",
  "gyroscope",
  "midi",
  "audio",
  "joypad"
];

function hasEnabledInteractionSource( interaction ) {
  return INTERACTION_SOURCE_GROUPS.some( ( source ) => interaction[ source ]?.enabled === true );
}

// Engine-managed interaction init: when a sketch's options carry an enabled
// `interaction` block, boot the handler once at setup so its sources (webcam,
// audio, gyro, touch, …) are available as binding channels with no per-sketch
// code. The handler is imported LAZILY (never statically) to keep MediaPipe out
// of the core module-eval chain. `initInteraction` is idempotent (re-arms
// listeners), so it's safe alongside sketches that still call it themselves;
// fire-and-forget so vision warm-up doesn't block setup.
//
// A block with NO enabled source (e.g. the inert one seeded on every sketch
// when the bindings plugin is on) must not boot: there is nothing to sample,
// and the baseline mouse binding works without the handler (channels.js keeps
// its own listener). Sources enabled later at runtime lazy-init from their
// collectors instead.
function initInteractionForOptions() {
  try {
    const live = getSketchOptions();
    const {
      interaction
    } = effectiveInteractive(
      live,
      liveSketchBase( live )
    );

    if (
      interaction &&
      interaction.enabled !== false &&
      hasEnabledInteractionSource( interaction )
    ) {
      _interactionInited = true;
      import( "./interaction/index.js" )
        .then( ( mod ) => mod.initInteraction( interaction ) )
        .catch( () => {} );
    }
  } catch {
    // Never let interaction init break setup.
  }
}

// Release the camera/mic/listeners held by the interaction handler. Called from
// sketch.reset() so resources are freed before the next sketch loads (also
// fixes a pre-existing leak — reset never disposed interaction). Only loads the
// module when it was actually booted (so the dynamic import resolves from cache).
export function disposeInteractionOnReset() {
  if ( !_interactionInited ) {
    return;
  }

  _interactionInited = false;
  import( "./interaction/index.js" )
    .then( ( mod ) => mod.disposeInteraction() )
    .catch( () => {} );
}

// The per-slide-merged sketch settings object binding targets resolve against.
function liveSketchBase( live ) {
  if ( typeof window !== "undefined" && window.getSketchSettings ) {
    try {
      return window.getSketchSettings( live );
    } catch {
      return live.sketch ?? {};
    }
  }

  return live.sketch ?? {};
}

// The active slide (when the slides module is loaded), for resolving the
// per-slide `interactive` override without re-deriving slide state here.
function liveCurrentSlide() {
  if ( typeof window !== "undefined" && window.getCurrentSlide ) {
    try {
      return window.getCurrentSlide()?.slide ?? null;
    } catch {
      return null;
    }
  }

  return null;
}

// The effective interaction-bindings state for the current frame. Bindings and
// the plugin-managed interaction block live in the top-level `interactive`
// namespace (root, overridden key-by-key by the active slide's own), NOT
// inside the sketch parameters. Two deliberate fallbacks:
//   - bindings: a legacy `bindings` array still sitting on the merged sketch
//     (pre-migration capture snapshots load without passing through
//     initOptions) keeps working;
//   - interaction: a block on the merged sketch WINS — that's a sketch-declared
//     parameter (hand-tracking, audio, … read it from their own code), and the
//     binding UI writes source-enable flags into it when it exists.
function effectiveInteractive(
  live, base
) {
  const root = live?.interactive;
  const slide = liveCurrentSlide()?.interactive;
  const stored = slide?.bindings ?? root?.bindings ?? base?.bindings;

  return {
    bindings: withResolvedControls( stored ),
    interaction: base?.interaction ?? slide?.interaction ?? root?.interaction
  };
}

// Resolve every abstract control in play for this frame: the ones a sketch
// DECLARED on its fields, and the ones a LEARNED binding stored in place of a
// raw channel. Both name a control like `knob.1` and let the connected port say
// what that is, which is what makes either survive a port switch.
//
// The result is a fresh array handed straight to `resolveBindings` and dropped
// after the frame — nothing is written back, so none of this reaches the form,
// the saved JSON or `/embed`.
function withResolvedControls( stored ) {
  const list = Array.isArray( stored ) ? stored : [];
  const declared = getDeclaredBindings().bindings;
  const storedNeedsPort = list.some( ( binding ) => typeof binding?.control === "string" );

  // Nothing abstract in play: hand back the original array untouched, so the
  // overwhelmingly common case costs one `some` and no allocation.
  if ( declared.length === 0 && !storedNeedsPort ) {
    return stored;
  }

  // "" when no port is picked, or when every input is being heard at once and
  // no single name can answer. resolveControl then yields null throughout and
  // every abstract binding goes inert — which is what unplugging should do.
  const port = midiPortName();

  const resolvedStored = storedNeedsPort
    ? list.map( ( binding ) => {
      if ( typeof binding?.control !== "string" ) {
        return binding;
      }

      // No source means bindingValue reads no channel and foldTarget leaves
      // the parameter on its own value: inert rather than wrong.
      return {
        ...binding,
        source: resolveControl(
          port,
          binding.control
        ) ?? undefined
      };
    } )
    : list;

  if ( declared.length === 0 ) {
    return resolvedStored;
  }

  const fromDeclared = [];

  for ( const entry of declared ) {
    const source = resolveControl(
      port,
      entry.control
    );

    // An unknown controller, or a control this one does not carry, leaves the
    // parameter alone rather than pinning it to a channel that never publishes.
    if ( !source ) {
      continue;
    }

    fromDeclared.push( {
      // Derived, never minted: smoothing and trigger state is keyed by id, so a
      // fresh uuid per frame would reset it on every frame.
      id: `declared:${ entry.control }:${ entry.target }`,
      source,
      target: entry.target,
      kind: entry.kind,
      mapping: entry.mapping,
      smoothing: entry.smoothing,
      enabled: true,
      weight: 1,
      blend: "replace"
    } );
  }

  // Declared first: foldTarget layers by target in list order, so a binding the
  // user authored by hand lands last and wins. A declaration is a default.
  return fromDeclared.length > 0 ? [
    ...fromDeclared,
    ...resolvedStored
  ] : resolvedStored;
}

// The generator context: the loop-normalized progression (deterministic during
// recording) plus the frame as a fallback for non-looping sketches.
function bindingContext() {
  let progression;

  try {
    progression = animation.progression;
  } catch {
    progression = undefined;
  }

  return {
    progression,
    frame: getP5()?.frameCount
  };
}

// Sample the interaction channels once per frame and publish them, plus each
// active binding's resolved 0..1 signal (keyed by target) for the UI's VU
// meters. Runs for every sketch; `sampleChannels` is memoized per frame and the
// binding-signal pass is skipped entirely when a sketch has no bindings.
function publishChannelsFrame() {
  if ( !BINDINGS_ENABLED ) {
    return;
  }

  // The editor needs the port name to turn a learned channel back into an
  // abstract control, and it must not import the interaction handler to get it
  // (that drags MediaPipe into the editor bundle). It rides the bridge that
  // already carries a snapshot every frame.
  publishMidiPortName( midiPortName() );

  try {
    const live = getSketchOptions();
    const base = liveSketchBase( live );
    const {
      bindings, interaction
    } = effectiveInteractive(
      live,
      base
    );
    const channels = sampleChannels( interaction );

    publishChannels( channels );

    if ( Array.isArray( bindings ) && bindings.length > 0 ) {
      publishBindingSignals( computeBindingSignals(
        {
          ...base,
          bindings
        },
        channels,
        bindingContext()
      ) );
    }
  } catch {
    // Never let telemetry break the draw loop.
  }
}

/**
 * Update the previous-options baseline to match the given effective
 * size/animation.  Called by slides/index.js after a slide switch so
 * that the next handleOptionsChange comparison starts from the right
 * baseline and doesn't re-fire events for values that were already applied.
 */
export function syncEffectivePrevious(
  effectiveSize, effectiveAnimation
) {
  if ( effectiveSize ) {
    previousOptions.effectiveSize = {
      ...effectiveSize
    };
  }

  if ( effectiveAnimation ) {
    previousOptions.effectiveAnimation = {
      ...effectiveAnimation
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Proxy — always reads from the live store on every access.         */
/*                                                                    */
/*  .sketch  returns base sketch options merged with per-slide        */
/*           overrides via window.getSketchSettings when registered.  */
/*           Falls back to the raw store value for simple sketches.    */
/*           Interactive bindings are then resolved on top, so any     */
/*           parameter the user has bound to a live input (mouse,      */
/*           oscillator, …) reads its modulated value here — with no   */
/*           per-sketch code and zero overhead when no binding exists. */
/* ------------------------------------------------------------------ */

// Resolve the per-slide-merged sketch object, then layer interactive bindings
// over it. Bindings come from the top-level `interactive` namespace (see
// effectiveInteractive); with none active the base object is returned
// untouched, so non-interactive sketches pay nothing — no per-access
// allocation on this hot path (the proxy runs it on every `.sketch` read).
function resolveSketch( live ) {
  const base = liveSketchBase( live );

  if ( !BINDINGS_ENABLED || !base ) {
    return base;
  }

  const {
    bindings, interaction
  } = effectiveInteractive(
    live,
    base
  );

  if ( !Array.isArray( bindings ) || bindings.length === 0 ) {
    return base;
  }

  try {
    const context = bindingContext();

    // The shim also grafts the effective interaction onto the resolved clone,
    // so sketch code reading `options.sketch.interaction` sees the block the
    // engine actually sampled, wherever it is stored. (resolveBindings
    // memoizes the clone per frame, so this stays off the per-access path.)
    return resolveBindings(
      {
        ...base,
        bindings,
        ...( interaction !== undefined && {
          interaction
        } )
      },
      sampleChannels( interaction ),
      context.frame,
      context
    );
  } catch {
    // Binding resolution must never break a sketch — fall back to base values.
    return base;
  }
}

/* ------------------------------------------------------------------ */
/*  Embedded-sketch options override                                   */
/*                                                                    */
/*  A "sketch" content item runs another sketch as a layer. That sketch */
/*  reads its parameters through `options.sketch` like any other, so    */
/*  while it draws the proxy must hand back the LAYER's settings — not  */
/*  the host page's. Same lever as getP5()'s surface override in        */
/*  sketch.js: one swap redirects the whole module graph, so no sketch  */
/*  and no helper needs to know it is embedded.                         */
/*                                                                    */
/*  Only `sketch` and `size` are overridden. Assets, slides and the     */
/*  animation clock stay the host's on purpose: the images belong to    */
/*  the host document, and one shared clock is what keeps an embedded   */
/*  layer deterministic under capture.                                  */
/* ------------------------------------------------------------------ */

let _optionsOverride = null;

/** Returns the previous override, to hand back to popOptionsOverride. */
export function pushOptionsOverride( override ) {
  const previous = _optionsOverride;

  _optionsOverride = override ?? null;

  return previous;
}

export function popOptionsOverride( previous ) {
  _optionsOverride = previous ?? null;
}

const optionsProxy = new Proxy(
  {},
  {
    get(
      _, prop
    ) {
      if ( _optionsOverride && prop in _optionsOverride ) {
        return _optionsOverride[ prop ];
      }

      const live = getSketchOptions();

      if ( prop === "sketch" ) {
        return resolveSketch( live );
      }

      return live[ prop ];
    }
  }
);

export default optionsProxy;
