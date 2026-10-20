/* ---------------- shared atoms stay unchanged ------------------- */
import {
  z
} from "zod";
import {
  DURATION_DEFAULT, FRAMERATE_DEFAULT
} from "@/lib/animationConfig";
import makeSlideId from "@/utils/makeSlideId";

const RGB = z.tuple( [
  z.number(),
  z.number(),
  z.number()
] );

const RGBA = z.union( [
  RGB,
  z.tuple( [
    // zod 4 moved a tuple's member schemas from `.items` to `.def.items`.
    ...RGB.def.items,
    z.number().optional()
      .default( 255 )
  ] )
] );

// Leaf-level `.catch` heals each coordinate independently: a present-but-out-of
// -range value (e.g. a position dragged negative) snaps back to centre instead
// of throwing. Without it, `initOptions`' single top-level `OptionsSchema.catch`
// would reset the WHOLE deck on one bad coordinate (same hazard the duration
// leaf-catch fixed — see durationBoundary.test.ts).
const Vec2 = z
  .object( {
    x: z.number().min( 0 )
      .max( 1 )
      .default( 0.5 )
      .catch( 0.5 ),
    y: z.number().min( 0 )
      .max( 1 )
      .default( 0.5 )
      .catch( 0.5 )
  } )
  .default( {
    x: 0.5,
    y: 0.5
  } );

export const HorizontalAlign = z.enum( [
  "left",
  "center",
  "right"
] );

export const VerticalAlign = z.enum( [
  "baseline",
  "top",
  "center",
  "bottom"
] );

export const Blend = z.enum( [
  "source-over",
  "darken",
  "lighten",
  "difference",
  "multiply",
  "exclusion",
  "screen",
  "copy",
  "overlay",
  "hard-light",
  "soft-light",
  "color-dodge",
  "color-burn",
  "lighter"
] );

/* ---------------- content discriminated union ------------------- */
const GridPatternSchema = z.object( {
  type: z.literal( "grid" ),
  columns: z.number().min( 0 )
    .max( 100 )
    .default( 9 ),
  strokeWeight: z.number().min( 0 )
    .max( 100 )
    .default( 1 ),
  stroke: RGBA.default( [
    226,
    215,
    205
  ] ),
  borders: z.boolean().default( false )
} );

const DotsPatternSchema = z.object( {
  type: z.literal( "dots" ),
  columns: z.number().min( 0 )
    .max( 100 )
    .default( 50 ),
  strokeWeight: z.number().min( 0 )
    .max( 100 )
    .default( 4 ),
  stroke: RGBA.default( [
    226,
    215,
    205
  ] ),
  borders: z.boolean().default( false )
} );

// Create a discriminated union for the pattern
export const PatternSchema = z
  .discriminatedUnion(
    "type",
    [
      GridPatternSchema,
      DotsPatternSchema
    ]
  )
  .default( {
    type: "grid",
    columns: 8,
    strokeWeight: 1,
    stroke: [
      226,
      215,
      205
    ],
    borders: false
  } );

export const BackgroundItemSchema = z.object( {
  type: z.literal( "background" ),
  background: RGBA.default( [
    246,
    235,
    225
  ] ),
  pattern: PatternSchema.optional()
} );

export const MetaItemSchema = z.object( {
  type: z.literal( "meta" ),
  topLeft: z.string().default( "@costardrouge.jpg" ),
  topRight: z.string().default( "" ),
  bottomLeft: z.string().default( "" ),
  bottomRight: z.string().default( "" ),
  font: z.string().default( "martian" ),
  blend: Blend.default( "source-over" ),
  fill: RGBA.default( [
    0,
    0,
    0
  ] ),
  stroke: RGBA.default( [
    255,
    255,
    255
  ] ),
  slideProgression: z
    .object( {
      hidden: z.boolean().default( false ),
      stroke: RGBA.default( [
        0,
        0,
        0
      ] )
    } )
    .default( {
      hidden: false,
      stroke: [
        0,
        0,
        0
      ]
    } )
} );

export const SpecsVisibilitySchema = z
  .discriminatedUnion(
    "mode",
    [
      z.object( {
        mode: z.literal( "fade" ),
        // timing as a fraction of the animation loop (0..1)
        revealEnd: z.number().min( 0 )
          .max( 1 )
          .default( 0.45 ),
        holdEnd: z.number().min( 0 )
          .max( 1 )
          .default( 0.7 ),
        fadeEnd: z.number().min( 0 )
          .max( 1 )
          .default( 0.8 )
      } ),
      z.object( {
        mode: z.literal( "permanent" )
      } )
    ]
  )
  .default( {
    mode: "permanent"
  } );

// Each highlight style only carries the parameters it actually uses, so the UI
// can show a dedicated set of controls per style (via a conditional group).
const highlightDuration = z.number().positive()
  .default( 0.9 );

export const SpecsHighlightSchema = z
  .discriminatedUnion(
    "style",
    [
      z.object( {
        style: z.literal( "off" )
      } ),
      z.object( {
        style: z.literal( "invert" ),
        // seconds the highlight takes to fade back to normal
        duration: highlightDuration,
        // colour of the inverted bar; the text auto-contrasts against it so it
        // stays readable for any text fill
        background: RGBA.default( [
          0,
          255,
          120
        ] )
      } ),
      z.object( {
        style: z.literal( "pulse" ),
        duration: highlightDuration
      } ),
      z.object( {
        style: z.literal( "pastille" ),
        duration: highlightDuration,
        // vertical offset as a fraction of font size ( + = downwards )
        pastilleOffset: z.number().default( 0 )
      } ),
      z.object( {
        style: z.literal( "underline" ),
        duration: highlightDuration,
        // vertical offset as a fraction of font size ( + = downwards ); a
        // negative value walks the rule onto the glyphs for a strike-through
        underlineOffset: z.number().default( 0 )
      } ),
      z.object( {
        style: z.literal( "blink" ),
        // how long the changed line keeps blinking, at full strength (no fade)
        duration: z.number().positive()
          .default( 0.5 ),
        // blinks per second (Hz) of the inverted-bar flash
        frequency: z.number().positive()
          .default( 6 ),
        background: RGBA.default( [
          0,
          255,
          120
        ] )
      } )
    ]
  )
  .default( {
    style: "invert",
    duration: 0.9,
    background: [
      0,
      255,
      120
    ]
  } );

/* ---------------- specs sound-on-change --------------------------- */

// Synth presets from @/lib/clickSynth — duplicated as a plain list so the
// schema layer stays free of audio imports (zod enums want literals anyway).
export const SPECS_SOUND_PRESETS = [
  "click",
  "tick",
  "blip",
  "pop",
  "beep",
  "wood",
  "typewriter"
] as const;

const soundRepeatInterval = z.number().min( 0.02 )
  .max( 2 );

// How a changed line clicks: once, an N-times burst (with optional pitch
// ramp, for a "spin-up" feel), or repeated for as long as the highlight
// effect stays hot (Geiger-counter style). Discriminated union so the panel
// shows only the controls the picked mode uses — same pattern as highlight.
export const SpecsSoundRepeatSchema = z
  .discriminatedUnion(
    "mode",
    [
      z.object( {
        mode: z.literal( "once" )
      } ),
      z.object( {
        mode: z.literal( "count" ),
        // total clicks per change (first one included)
        times: z.number().int()
          .min( 2 )
          .max( 16 )
          .default( 3 ),
        // seconds between clicks of the burst
        interval: soundRepeatInterval.default( 0.08 ),
        // pitch ramp per repeat, in octaves ( + rises, - falls, 0 = flat )
        pitchStep: z.number().min( -0.5 )
          .max( 0.5 )
          .default( 0.08 )
      } ),
      z.object( {
        mode: z.literal( "while-highlighted" ),
        // seconds between clicks while the line's highlight is still hot
        interval: soundRepeatInterval.default( 0.12 )
      } )
    ]
  )
  .default( {
    mode: "once"
  } );

export const SpecsSoundSchema = z
  .object( {
    // Master switch — off by default so existing decks stay silent.
    enabled: z.boolean().default( false ),
    // Voice from the shared click synth.
    preset: z.enum( SPECS_SOUND_PRESETS ).default( "click" ),
    volume: z.number().min( 0 )
      .max( 1 )
      .default( 0.5 ),
    // Global pitch multiplier (1 = as designed, 2 = octave up).
    pitch: z.number().min( 0.25 )
      .max( 4 )
      .default( 1 ),
    // Random per-click detune, 0..1 (1 ≈ ±half an octave) — "humanize".
    pitchVariation: z.number().min( 0 )
      .max( 1 )
      .default( 0.1 ),
    // Pitch offset by line index, in octaves across the whole list, so each
    // spec line gets its own recognisable tone ( + = lower lines are higher ).
    linePitchSpread: z.number().min( -1 )
      .max( 1 )
      .default( 0 ),
    // Minimum spacing between clicks (seconds). Simultaneous changes (e.g. a
    // randomize) are staggered by this amount — the slot-machine cascade —
    // instead of stacking into one loud transient.
    minInterval: z.number().min( 0 )
      .max( 0.5 )
      .default( 0.05 ),
    // Per-line retrigger cooldown (seconds): a value that changes every frame
    // (montage morphs) clicks at most once per this window.
    lineCooldown: z.number().min( 0 )
      .max( 2 )
      .default( 0.15 ),
    // Hard cap on queued clicks — keeps a deck-wide randomize from becoming a
    // machine gun.
    maxBurst: z.number().int()
      .min( 1 )
      .max( 32 )
      .default( 12 ),
    repeat: SpecsSoundRepeatSchema
  } )
  .prefault( {} );

export const SpecsItemSchema = z.object( {
  type: z.literal( "specs" ),
  style: z.enum( [
    "boot-log",
    "ticker"
  ] ).default( "boot-log" ),
  font: z.string().default( "spaceMonoRegular" ),
  size: z.number().positive()
    .default( 22 ),
  fill: RGBA.default( [
    0,
    255,
    120
  ] ),
  // Panel painted behind the specs block. Transparent black by default (draws
  // nothing) — set a colour to keep the text readable over busy sketches.
  backgroundColor: RGBA.default( [
    0,
    0,
    0,
    0
  ] ),
  // Optional outline around that panel. Defaults to the text fill colour with
  // zero opacity (so it draws nothing) — raise the alpha to reveal a border in
  // the same colour as the text.
  backgroundStroke: RGBA.default( [
    0,
    255,
    120,
    0
  ] ),
  // Corner radius of that panel, in pixels. 0 = sharp rectangle.
  backgroundRadius: z.number().min( 0 )
    .max( 200 )
    .default( 0 ),
  blend: Blend.default( "source-over" ),
  position: Vec2.default( {
    x: 0.05,
    y: 0.06
  } ),
  lineHeight: z.number().positive()
    .default( 1.4 ),
  showCursor: z.boolean().default( true ),
  // which parameter groups to list, ticked in any combination. Preprocess keeps
  // older items working: the previous single-enum selector and the original
  // includeSketchSettings boolean both map onto the new string array.
  content: z
    .preprocess(
      ( value ) => {
        if ( Array.isArray( value ) ) {
          return value;
        }

        if ( value === "general" || value === "sketch" ) {
          return [
            value
          ];
        }

        if ( value === "general-and-sketch" ) {
          return [
            "general",
            "sketch"
          ];
        }

        return undefined; // fall through to .default
      },
      z.array( z.enum( [
        "general",
        "sketch"
      ] ) )
    )
    .default( [
      "general",
      "sketch"
    ] ),
  visibility: SpecsVisibilitySchema,
  highlight: SpecsHighlightSchema,
  sound: SpecsSoundSchema
} );

/* ---------------- sketch breakdown (diff overlay) ------------------ */

// Which parameters become breakdown steps:
//   - "changed": only params whose final value differs from the sketch's
//     stock defaults (formValues, via window.getSketchFormMeta) — the diff.
//     Degrades to "all" when the bridge is unreachable (bare harness).
//   - "all": every animatable parameter group.
export const BREAKDOWN_SELECTION_MODES = [
  "changed",
  "all"
] as const;

// Header counter style: "1/3" vs spreadsheet letters "A", "B", …
export const BREAKDOWN_COUNTER_MODES = [
  "numeric",
  "letters"
] as const;

// Where the block sits: a fixed draggable anchor, or roaming — a
// deterministic corner-tour that moves to a different anchor each step so
// the block never hides the same region of the sketch twice.
export const BREAKDOWN_PLACEMENTS = [
  "fixed",
  "roaming"
] as const;

// How a line's changing value is rendered:
//   - "bar": gauge-style progress bar filling start → final (the default)
//   - "ticker": the live interpolated value printed as text
//   - "roll": per-character odometer from the start text to the final text
//   - "fade": alpha crossfade start text → final text
//   - "rise": start text slides up and out, final text rises in from below
export const BREAKDOWN_VALUE_STYLES = [
  "bar",
  "ticker",
  "roll",
  "fade",
  "rise"
] as const;

// Engine/derivation settings, grouped under `build` on purpose: this object's
// identity is the derived-cache key in the breakdown orchestrator, and it
// survives the drag layer's per-frame { ...item, position } wrapper — keying
// on the item itself would make the HUD (dragged wrapper) and the injection
// (raw store item) thrash the single-slot cache against each other.
export const BreakdownBuildSchema = z
  .object( {
    selection: z.enum( BREAKDOWN_SELECTION_MODES ).default( "changed" ),
    // How far start values depart from the final value (1 = the full
    // opposite end of the field's range, 0.1 = already close — the
    // breakdown just "stabilizes" the sketch).
    departure: z.number().min( 0 )
      .max( 1 )
      .default( 1 ),
    // Loop fractions reserved before step 1 and after the last step (the
    // block fades out during the outro, leaving the settled sketch alone).
    introRatio: z.number().min( 0 )
      .max( 0.3 )
      .default( 0 ),
    outroRatio: z.number().min( 0 )
      .max( 0.4 )
      .default( 0.1 ),
    // Fraction of each step window held ON the final value before the next
    // step starts (front-loaded morph, then lock).
    holdRatio: z.number().min( 0 )
      .max( 0.9 )
      .default( 0.15 ),
    // Easing key from easing.js applied to each step's local progress.
    easing: z.string().default( "easeInOutCubic" ),
    // Per-line offset WITHIN a step (0..1): 0 = every leaf of the group
    // animates together (default), 1 ≈ strictly one line after another.
    // Lives in `build` because it shifts the INJECTED values, not just the
    // overlay — the orchestrator's derived cache keys on this object.
    lineStagger: z.number().min( 0 )
      .max( 1 )
      .default( 0 ),
    // Params that snap at their window midpoint instead of lerping —
    // discrete or cache-invalidating values (montage precedent).
    snapKeys: z.array( z.string() ).default( [
      "seed"
    ] ),
    // Params that never animate (always final) and get no breakdown step.
    excludeKeys: z.array( z.string() ).default( [] )
  } )
  .prefault( {} );

// Diff-style narration overlay: only the parameters that change become
// steps, shown ONE AT A TIME in the specs visual language (same text/stroke
// colour, black panel) while the injected interpolation makes the running
// sketch visibly stabilize group by group. Parameter interpolation is
// injected in slides.getSketchSettings (see sketches/p5/utils/slides/
// breakdown/) — montage slides win; the first breakdown item per list wins
// (slide content over global).
export const BreakdownItemSchema = z.object( {
  type: z.literal( "breakdown" ),
  build: BreakdownBuildSchema,
  placement: z.enum( BREAKDOWN_PLACEMENTS ).default( "fixed" ),
  // Fixed placement only — roaming ignores it (and disables dragging).
  position: Vec2.default( {
    x: 0.06,
    y: 0.08
  } ),
  // Header row: "1/3 DOTS". Three independent switches — header kills the
  // whole row; counter and title hide their own half.
  showHeader: z.boolean().default( true ),
  showCounter: z.boolean().default( true ),
  showTitle: z.boolean().default( true ),
  counterMode: z.enum( BREAKDOWN_COUNTER_MODES ).default( "numeric" ),
  // Typewriter effect on the line text. Off by default: labels show up
  // whole immediately — only the value in front of them animates.
  typewriter: z.boolean().default( false ),
  valueStyle: z.enum( BREAKDOWN_VALUE_STYLES ).default( "bar" ),
  font: z.string().default( "spaceMonoRegular" ),
  size: z.number().positive()
    .default( 16 ),
  lineHeight: z.number().positive()
    .default( 1.4 ),
  fill: RGBA.default( [
    0,
    255,
    120
  ] ),
  // Unlike specs, the panel is VISIBLE by default: black at 50%, outlined in
  // the text colour ("text and contour share the same colour").
  backgroundColor: RGBA.default( [
    0,
    0,
    0,
    128
  ] ),
  backgroundStroke: RGBA.default( [
    0,
    255,
    120,
    255
  ] ),
  backgroundRadius: z.number().min( 0 )
    .max( 200 )
    .default( 0 ),
  blend: Blend.default( "source-over" ),
  // Sound on change — the breakdown narrates a diff one step at a time; each
  // parameter clicks into place as its value locks. Reuses the specs
  // sound-on-change schema (same click synth, staggering and repeat knobs).
  sound: SpecsSoundSchema
} );

export const TextItemSchema = z.object( {
  type: z.literal( "text" ),
  content: z.string().default( "" ),

  size: z.number().positive()
    .default( 24 ),
  stroke: RGBA.default( [
    255,
    255,
    255
  ] ),
  fill: RGBA.default( [
    0,
    0,
    0
  ] ),
  font: z.string().default( "martian" ),
  blend: Blend.default( "source-over" ),
  position: Vec2.default( {
    x: 0,
    y: 0.5
  } ),
  alignment: z
    .object( {
      horizontal: HorizontalAlign,
      vertical: VerticalAlign
    } )
    .default( {
      vertical: "baseline",
      horizontal: "center"
    } ),
  margin: z
    .object( {
      horizontal: z.number().min( 0 )
        .max( 1 )
        .default( 0.015 ),
      vertical: z.number().min( 0 )
        .max( 1 )
        .default( 0.015 )
    } )
    .default( {
      vertical: 0.01,
      horizontal: 0.01
    } )
} );

// A "title" content-item — the former per-sketch `options.sketch.title`
// (titleDefaultValues / renderTitle) promoted to a first-class content item so
// it can be added to the global or per-slide content list like any other item.
// Keeps the title's distinctive behaviour: an optional display window
// (displayFrom..displayTo, a fraction of the animation loop) and a fallback to
// the (uppercased, hyphen-broken) sketch name when `content` is left empty.
export const TitleItemSchema = z.object( {
  type: z.literal( "title" ),
  content: z.string().default( "" ),
  size: z.number().positive()
    .default( 128 ),
  fill: RGBA.default( [
    255,
    255,
    255
  ] ),
  stroke: RGBA.default( [
    0,
    0,
    0
  ] ),
  strokeWeight: z.number().min( 0 )
    .default( 2 ),
  font: z.string().default( "martian" ),
  blend: Blend.default( "exclusion" ),
  position: Vec2.default( {
    x: 0,
    y: 0
  } ),
  alignment: z
    .object( {
      horizontal: HorizontalAlign,
      vertical: VerticalAlign
    } )
    .default( {
      horizontal: "center",
      vertical: "center"
    } ),
  margin: z
    .object( {
      horizontal: z.number().min( 0 )
        .max( 1 )
        .default( 0.015 ),
      vertical: z.number().min( 0 )
        .max( 1 )
        .default( 0.015 )
    } )
    .default( {
      horizontal: 0.015,
      vertical: 0.015
    } ),
  displayFrom: z.number().min( 0 )
    .max( 1 )
    .default( 0 ),
  displayTo: z.number().min( 0 )
    .max( 1 )
    .default( 0.2 )
} );

export const ImageItemAnimations = z.discriminatedUnion(
  "name",
  [
    z.object( {
      name: z.literal( "noise-floating" ),
      amplitude: z.number().default( 50 ),
      // p5's noiseDetail( lod, falloff ) — a fixed pair, each with its own
      // range (mirrored by the two sliders in field-config). This was written
      // as `z.array( lod, falloff )`, where zod 3 silently swallowed the second
      // schema as its params argument, so `falloff` went unvalidated and the
      // tuple accepted any length. zod 4 rejects the extra argument outright.
      noiseDetail: z
        .tuple( [
          z.number().min( 0 )
            .max( 8 ),
          z.number().min( 0 )
            .max( 1 )
        ] )
        .default( [
          2,
          0.7
        ] )
    } )
  ]
);

export const ImagesStackAnimations = z.discriminatedUnion(
  "name",
  [
    z.object( {
      name: z.literal( "random" ),
      shift: z.number().default( 30 )
    } )
  ]
);

export const ImageItemSchema = z.object( {
  type: z.literal( "image" ),
  source: z.string().default( "" ),
  margin: z.number().min( 0 )
    .max( 1000 )
    .default( 0 ),
  center: z.boolean().default( true ),
  scale: z.number().min( 0 )
    .max( 6 )
    .default( 1 ),
  position: Vec2,
  animation: z.preprocess(
    ( v ) => {
      if ( v == null ) {
        return undefined;
      }

      if (
        typeof v === "object" &&
      "name" in ( v as any ) &&
      ( v as any ).name === ""
      ) {
        return undefined;
      }

      return v;
    },
    ImageItemAnimations.optional()
  )
} );

const NonEmptyPath = z.string().trim()
  .min( 1 );

export const ImagesStackItemSchema = z.object( {
  type: z.literal( "images-stack" ),
  sources: z.preprocess(
    ( v ) =>
      Array.isArray( v )
        ? v.filter( ( s ) => typeof s === "string" && s.trim().length > 0 )
        : [],
    z.array( NonEmptyPath ).default( [] )
  ),
  margin: z.number().nonnegative()
    .default( 0 ),
  scale: z.number().min( 0 )
    .max( 6 )
    .default( 1 ),
  rotation: z.number().default( 0 ),
  progressiveRotation: z.number().default( 0 ),
  center: z.boolean().default( false ),
  position: Vec2,
  animation: ImagesStackAnimations.optional()
} );

/* ---------------- embedded-sketch content item ------------------- */
// A whole other sketch, composited as a layer. It runs in its own p5 graphics
// buffer (see src/sketches/p5/utils/nestedSketch.js), so its `background()`
// calls, its canvas size and its frame rate are all the layer's own rather
// than the host's — which is what makes "add a sketch on top of a sketch"
// behave like every other content item instead of fighting the host's canvas.

/** Layer box shapes offered beside "follow the host canvas". */
export const SketchLayerAspectRatio = z.enum( [
  "canvas",
  "1:1",
  "4:5",
  "3:4",
  "2:3",
  "9:16",
  "3:2",
  "4:3",
  "16:9"
] );

/** How a layer's box relates to the canvas the embedded sketch draws for. */
export const SketchLayerSizing = z.enum( [
  "reflow",
  "scale"
] );

export const SketchLayerItemSchema = z.object( {
  type: z.literal( "sketch" ),
  // Catalogue path of the embedded sketch — "<category>/<name>", or a bare
  // "<name>" for an uncategorised one. The same string the sketch routes and
  // the generated module registry are keyed by, so the picker, the runtime
  // loader and a shared options JSON all speak one identifier. p5 only: the
  // layer renders into a p5 graphics buffer, which no other engine can fill.
  sketch: z.string().default( "" ),
  // The embedded sketch's own parameters. Free-form on purpose — every sketch
  // declares its own shape in its options.ts, and the inspector renders that
  // sketch's `formConfiguration` against this object.
  settings: z.any().default( {} ),

  enabled: z.boolean().default( true ),

  position: Vec2.default( {
    x: 0.5,
    y: 0.5
  } ),
  // The layer's width as a fraction of the host canvas' width.
  scale: z.number().min( 0.05 )
    .max( 4 )
    .default( 1 ),
  rotation: z.number().default( 0 ),
  aspectRatio: SketchLayerAspectRatio.default( "canvas" ),
  // What `scale` does to the embedded sketch. "reflow" hands it the layer's box
  // as its canvas, so a sketch that lays itself out from p.width/p.height
  // re-frames itself for the layer — right for a background or a pattern, and
  // the historical behaviour. "scale" hands it the box it would have at scale 1
  // and scales the result down, so the sketch keeps the framing it has on its
  // own page. The second is the only one that works for a sketch drawing at
  // absolute pixel sizes: shrinking the canvas under `peaks-sphere`, whose
  // radius is 250px whatever it is given, crops the sphere instead of
  // shrinking it.
  sizing: SketchLayerSizing.default( "reflow" ),
  // Buffer resolution as a fraction of the layer's own canvas. Below 1 the
  // sketch renders into fewer pixels and is scaled back up — the cheapest lever
  // there is on a heavy embedded sketch, and a look in its own right. It is a
  // pixel density only: the sketch is still told it has the full canvas, so
  // this never re-lays it out (nestedSketch.bufferPixels).
  resolution: z.number().min( 0.05 )
    .max( 2 )
    .default( 1 ),
  // Redraws per second of loop time; 0 follows the host's own frame rate. It
  // buys back performance AND is a design control (a 6fps layer over a 60fps
  // sketch reads as stop-motion).
  framerate: z.number().min( 0 )
    .max( 120 )
    .default( 0 ),
  // Whether the layer's animation runs. Off freezes it: the layer stops being
  // redrawn and holds the frame `progression` selects, which is stronger than
  // pinning the clock — a sketch that draws from p5's own random()/frameCount
  // would keep moving under a frozen clock, but cannot move if it is not
  // redrawn at all.
  play: z.boolean().default( true ),
  // Where the layer sits in its own loop, as a phase in [0, 1]. Playing, it is
  // an OFFSET added to the host's phase (two copies of one sketch can run half
  // a loop apart); frozen, it is the absolute position of the held frame — one
  // meaning, "where this layer's loop starts". 0 leaves the layer exactly in
  // step with the page, which is what every existing layer keeps.
  progression: z.number().min( 0 )
    .max( 1 )
    .default( 0 ),
  opacity: z.number().min( 0 )
    .max( 1 )
    .default( 1 ),
  blend: Blend.default( "source-over" ),
  // Let the embedded sketch paint its own background. Off by default: nearly
  // every sketch opens its draw with background(), which would make each
  // embedded sketch an opaque rectangle hiding the layers below it.
  drawBackground: z.boolean().default( false ),
  // Wipe the buffer before each redraw. Off keeps what earlier frames drew,
  // which is what trail / feedback sketches expect.
  clearEachFrame: z.boolean().default( true )
} );

export const QrCodeItemSchema = z.object( {
  type: z.literal( "qrcode" ),
  // Origin to encode. Empty -> NEXT_PUBLIC_SITE_URL (the production domain),
  // falling back to the live page origin. Set it to point at the public
  // domain when generating content from a localhost / capture URL. A bare
  // host ("mysite.com") is assumed https; include a scheme to override that.
  // The path is always taken from the live page.
  domainOverride: z.string().default( "" ),
  position: Vec2.default( {
    x: 0.5,
    y: 0.82
  } ),
  // QR side length as a fraction of min( canvas width, canvas height ).
  size: z.number().min( 0.02 )
    .max( 1 )
    .default( 0.22 ),
  // Quiet-zone border thickness, in modules (the spec recommends >= 4).
  quietZone: z.number().int()
    .min( 0 )
    .max( 8 )
    .default( 4 ),
  errorCorrection: z.enum( [
    "L",
    "M",
    "Q",
    "H"
  ] ).default( "M" ),
  foreground: RGBA.default( [
    0,
    0,
    0
  ] ),
  background: RGBA.default( [
    255,
    255,
    255,
    255
  ] ),
  blend: Blend.default( "source-over" ),
  // Caption: print the encoded URL underneath the code.
  showUrl: z.boolean().default( true ),
  urlFont: z.string().default( "spaceMonoRegular" ),
  urlSize: z.number().positive()
    .default( 20 ),
  urlFill: RGBA.default( [
    255,
    255,
    255
  ] )
} );

/* ---------------- HUD / telemetry content-items ------------------ */
// Each telemetry widget is its own standalone content-item type ("hud-badge",
// "hud-gauge", …) with its own style and placement. They used to live as slots
// inside a single "hud" container item — legacy trees are expanded by
// `migrateLegacyHudItems` (src/utils) BEFORE OptionsSchema parses, because an
// unknown `type` in the strictly-parsed content array would trip initOptions'
// top-level `.catch` and reset the whole options. Widgets bind to a `source`:
// a built-in live key (fps / frame / progression …) or a dotted key-path into
// the sketch settings ("magnitude.start").

const HudAnchor = z.enum( [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
  "center"
] );

const hudOffset = (
  x: number, y: number
) =>
  z
    .object( {
      x: z.number().min( 0 )
        .max( 1 )
        .default( x ),
      y: z.number().min( 0 )
        .max( 1 )
        .default( y )
    } )
    .default( {
      x,
      y
    } );

const hudWindow = {
  displayFrom: z.number().min( 0 )
    .max( 1 )
    .default( 0 ),
  displayTo: z.number().min( 0 )
    .max( 1 )
    .default( 1 )
};

// Ordered text values the badge can print. `resolution-fps` is a convenience
// combining both readouts into a single segment; the identity ones
// (engine / category / name) resolve from the running sketch.
export const BADGE_SEGMENTS = [
  "resolution",
  "fps",
  "resolution-fps",
  "engine",
  "category",
  "name"
] as const;

// Style every standalone HUD element carries — the old container-level
// defaults, so an element renders identically whether it was added fresh or
// expanded out of a legacy "hud" item.
const hudElementStyle = {
  fill: RGBA.default( [
    0,
    255,
    120,
    255
  ] ),
  font: z.string().default( "spaceMonoRegular" ),
  blend: Blend.default( "source-over" )
};

// Panel painted behind a boxed element's readout (badge, gauge, sparkline,
// counter, swatch — not the full-canvas crosshairs / bounding-box overlays).
// Transparent black by default (draws nothing) — set a colour to keep the
// telemetry readable over busy sketches. The stroke defaults to the accent
// with zero opacity; raise the alpha to reveal a border.
const hudBoxStyle = {
  backgroundColor: RGBA.default( [
    0,
    0,
    0,
    0
  ] ),
  backgroundStroke: RGBA.default( [
    0,
    255,
    120,
    0
  ] ),
  // Corner radius of the panel, in pixels. 0 = sharp rectangle.
  backgroundRadius: z.number().min( 0 )
    .max( 200 )
    .default( 0 )
};

// Legacy widget-slot style: optional, so an unset value fell back to the
// containing "hud" item's shared style. Only the migration parses this shape.
const legacyHudStyle = {
  fill: RGBA.optional(),
  font: z.string().optional(),
  blend: Blend.optional()
};

const hudBadgeFields = {
  // Which values to print, in order — each renders as its own segment with a
  // "·" separator between them. Defaults to the sketch identity line
  // (engine · category · name). A bad persisted token heals to "name" so one
  // stale value never resets the whole deck.
  segments: z
    .array( z.enum( BADGE_SEGMENTS ).catch( "name" ) )
    .default( [
      "engine",
      "category",
      "name"
    ] ),
  // When non-empty, replaces the entire badge text (segments are ignored).
  override: z.string().default( "" ),
  anchor: HudAnchor.default( "top-right" ),
  offset: hudOffset(
    0.95,
    0.06
  ),
  size: z.number().positive()
    .default( 20 )
};

const hudGaugeFields = {
  source: z.string().default( "progress%" ),
  anchor: HudAnchor.default( "bottom-left" ),
  offset: hudOffset(
    0.05,
    0.9
  ),
  size: z.number().positive()
    .default( 18 ),
  min: z.number().default( 0 ),
  max: z.number().default( 100 ),
  label: z.string().default( "" ),
  unit: z.string().default( "" ),
  decimals: z.number().int()
    .min( 0 )
    .max( 4 )
    .default( 0 ),
  easingFn: z.string().default( "linear" ),
  ...hudWindow
};

const hudSparklineFields = {
  source: z.string().default( "progress%" ),
  anchor: HudAnchor.default( "bottom-right" ),
  offset: hudOffset(
    0.95,
    0.9
  ),
  size: z.number().positive()
    .default( 16 ),
  min: z.number().default( 0 ),
  max: z.number().default( 100 ),
  historySize: z.number().int()
    .min( 8 )
    .max( 180 )
    .default( 120 ),
  decimals: z.number().int()
    .min( 0 )
    .max( 4 )
    .default( 0 ),
  unit: z.string().default( "" ),
  ...hudWindow
};

const hudCounterFields = {
  source: z.string().default( "frame" ),
  anchor: HudAnchor.default( "top-left" ),
  offset: hudOffset(
    0.05,
    0.85
  ),
  size: z.number().positive()
    .default( 28 ),
  label: z.string().default( "" ),
  unit: z.string().default( "" ),
  decimals: z.number().int()
    .min( 0 )
    .max( 4 )
    .default( 0 ),
  ...hudWindow
};

const hudCrosshairsFields = {
  source: z.string().default( "center" ),
  size: z.number().positive()
    .default( 16 ),
  ...hudWindow
};

const hudSwatchFields = {
  // Bind to a live colour source by default (the sketch fill, falling back to
  // the HUD accent) so the swatch renders a chip out of the box instead of
  // staying blank on an empty source.
  source: z.string().default( "fill" ),
  anchor: HudAnchor.default( "top-right" ),
  offset: hudOffset(
    0.95,
    0.2
  ),
  size: z.number().positive()
    .default( 18 ),
  label: z.string().default( "COLOR" ),
  ...hudWindow
};

// How a readout lays its label out against its value: the counter's stacked
// pair (small caption over a big value) or one "LABEL  value" line.
export const HUD_READOUT_LAYOUTS = [
  "stacked",
  "inline"
] as const;

const hudReadoutFields = {
  // Any source that resolves to something printable — a string parameter (the
  // sketch's font, a preset name), a boolean, an enum, or one of the identity
  // built-ins. Defaults to the sketch name so a fresh readout prints something.
  source: z.string().default( "name" ),
  anchor: HudAnchor.default( "top-left" ),
  offset: hudOffset(
    0.05,
    0.12
  ),
  size: z.number().positive()
    .default( 20 ),
  label: z.string().default( "" ),
  layout: z.enum( HUD_READOUT_LAYOUTS ).default( "stacked" ),
  uppercase: z.boolean().default( false ),
  ...hudWindow
};

// What a point source's numbers mean. `value` = the parameter's own units,
// plotted over [min, max]; `canvas` = canvas pixels, plotted over the canvas
// itself — which is what lets one widget map a normalized sketch vector and
// the pixel-space built-ins (mouse / center) without a second type.
export const HUD_VECTOR_SPACES = [
  "value",
  "canvas"
] as const;

// Which pair of numbers the map prints under its plot. "relative" is the
// point in parameter space (what the vector pad shows), "absolute" is where it
// lands on the canvas, in pixels.
export const HUD_COORDINATE_MODES = [
  "relative",
  "absolute",
  "none"
] as const;

const hudVectorFields = {
  // Point-valued source: a sketch vector2d parameter, or `mouse` / `center`.
  source: z.string().default( "mouse" ),
  anchor: HudAnchor.default( "bottom-right" ),
  offset: hudOffset(
    0.95,
    0.75
  ),
  size: z.number().positive()
    .default( 16 ),
  space: z.enum( HUD_VECTOR_SPACES ).default( "canvas" ),
  min: z.number().default( 0 ),
  max: z.number().default( 1 ),
  // Screen orientation of the vertical axis: with yDown the top of the map is
  // the minimum, matching a canvas position. Mirrors the vector2d pad's own
  // flag, which the quick-add copies from the control it was created from.
  yDown: z.boolean().default( true ),
  coordinates: z.enum( HUD_COORDINATE_MODES ).default( "relative" ),
  decimals: z.number().int()
    .min( 0 )
    .max( 4 )
    .default( 2 ),
  label: z.string().default( "" ),
  ...hudWindow
};

// The 3D vector element's views — mirrored by VECTOR3D_VIEW_IDS in
// src/sketches/p5/utils/hud/vector3dViews.js (a test keeps the two in step).
// box = the vector3d control's own orbit view · planes = XY / XZ / ZY maps ·
// map-depth = the 2D map plus a z gauge · bars = three axis gauges · gizmo =
// an arrow in a wireframe sphere.
export const HUD_VECTOR3D_VIEWS = [
  "box",
  "planes",
  "map-depth",
  "bars",
  "gizmo"
] as const;

// What the triple means, copied from the control: a position gets a floor
// and a shadow in the box, a direction an arrow from the centre.
export const HUD_VECTOR3D_KINDS = [
  "position",
  "direction"
] as const;

const hudVector3dFields = {
  // A `{ x, y, z }` sketch parameter (a vector3d control's key-path).
  source: z.string().default( "" ),
  view: z.enum( HUD_VECTOR3D_VIEWS ).default( "box" ),
  kind: z.enum( HUD_VECTOR3D_KINDS ).default( "position" ),
  anchor: HudAnchor.default( "bottom-right" ),
  offset: hudOffset(
    0.95,
    0.75
  ),
  size: z.number().positive()
    .default( 16 ),
  // Each axis' own domain, as the control resolves it (resolveAxes3D): the
  // views map every axis to the same box, so per-axis bounds keep a
  // [-1, 1] × [-0.5, 0.5] × [-1, 1] position honest instead of squashed.
  domain: z
    .object( {
      xMin: z.number().default( -1 ),
      xMax: z.number().default( 1 ),
      yMin: z.number().default( -1 ),
      yMax: z.number().default( 1 ),
      zMin: z.number().default( -1 ),
      zMax: z.number().default( 1 )
    } )
    .prefault( {} ),
  // p5's WEBGL y points down; true keeps "up in the widget" = up on canvas.
  yDown: z.boolean().default( true ),
  // The last ~48 frames of the point, fading: without it a box seen at an
  // angle cannot tell height from depth on a still frame.
  trail: z.boolean().default( true ),
  // Whole turns of the camera per loop, for the two views that have one (box,
  // gizmo). Read from the loop clock, so a capture matches the preview.
  spin: z.number().min( 0 )
    .max( 4 )
    .default( 0 ),
  coordinates: z.enum( [
    "relative",
    "none"
  ] ).default( "relative" ),
  decimals: z.number().int()
    .min( 0 )
    .max( 4 )
    .default( 2 ),
  label: z.string().default( "" ),
  ...hudWindow
};

const hudBoundingBoxFields = {
  source: z.string().default( "" ),
  size: z.number().positive()
    .default( 14 ),
  region: z
    .object( {
      x: z.number().min( 0 )
        .max( 1 )
        .default( 0.2 ),
      y: z.number().min( 0 )
        .max( 1 )
        .default( 0.2 ),
      w: z.number().min( 0 )
        .max( 1 )
        .default( 0.6 ),
      h: z.number().min( 0 )
        .max( 1 )
        .default( 0.6 )
    } )
    .default( {
      x: 0.2,
      y: 0.2,
      w: 0.6,
      h: 0.6
    } ),
  label: z.string().default( "ROI" ),
  ...hudWindow
};

// Every standalone element defaults to enabled — a layer added from the
// palette must show up. (The legacy slots mostly defaulted to `false`, but
// that only made sense while one item carried all seven at once.)
const hudEnabled = z.boolean().default( true );

export const HudBadgeItemSchema = z.object( {
  type: z.literal( "hud-badge" ),
  enabled: hudEnabled,
  ...hudBadgeFields,
  ...hudElementStyle,
  ...hudBoxStyle
} );

export const HudGaugeItemSchema = z.object( {
  type: z.literal( "hud-gauge" ),
  enabled: hudEnabled,
  ...hudGaugeFields,
  ...hudElementStyle,
  ...hudBoxStyle
} );

export const HudSparklineItemSchema = z.object( {
  type: z.literal( "hud-sparkline" ),
  enabled: hudEnabled,
  ...hudSparklineFields,
  ...hudElementStyle,
  ...hudBoxStyle
} );

export const HudCounterItemSchema = z.object( {
  type: z.literal( "hud-counter" ),
  enabled: hudEnabled,
  ...hudCounterFields,
  ...hudElementStyle,
  ...hudBoxStyle
} );

export const HudCrosshairsItemSchema = z.object( {
  type: z.literal( "hud-crosshairs" ),
  enabled: hudEnabled,
  ...hudCrosshairsFields,
  ...hudElementStyle
} );

export const HudSwatchItemSchema = z.object( {
  type: z.literal( "hud-swatch" ),
  enabled: hudEnabled,
  ...hudSwatchFields,
  ...hudElementStyle,
  ...hudBoxStyle
} );

export const HudReadoutItemSchema = z.object( {
  type: z.literal( "hud-readout" ),
  enabled: hudEnabled,
  ...hudReadoutFields,
  ...hudElementStyle,
  ...hudBoxStyle
} );

export const HudVectorItemSchema = z.object( {
  type: z.literal( "hud-vector" ),
  enabled: hudEnabled,
  ...hudVectorFields,
  ...hudElementStyle,
  ...hudBoxStyle
} );

export const HudVector3dItemSchema = z.object( {
  type: z.literal( "hud-vector3d" ),
  enabled: hudEnabled,
  ...hudVector3dFields,
  ...hudElementStyle,
  ...hudBoxStyle
} );

export const HudBoundingBoxItemSchema = z.object( {
  type: z.literal( "hud-bounding-box" ),
  enabled: hudEnabled,
  ...hudBoundingBoxFields,
  ...hudElementStyle
} );

// Legacy "hud" container slots, with their ORIGINAL defaults — the migration
// (src/utils/migrateLegacyHudItems.ts) parses persisted slots against these to
// tell "was configured" apart from "untouched default". Nothing else may use
// them: new code reads the Hud*ItemSchema shapes above.
const legacySlot = (
  enabledDefault: boolean, fields: Record<string, z.ZodType>
) =>
  z
    .object( {
      enabled: z.boolean().default( enabledDefault ),
      ...fields,
      ...legacyHudStyle
    } )
    .prefault( {} );

// Ordered like drawSlideHud's old WIDGET_ORDER (later = on top), so a migrated
// container expands into items whose array order reproduces the stacking the
// renderer used to force.
export const LEGACY_HUD_WIDGETS = [
  {
    key: "boundingBox",
    type: "hud-bounding-box",
    legacy: legacySlot(
      false,
      hudBoundingBoxFields
    ),
    item: HudBoundingBoxItemSchema
  },
  {
    key: "crosshairs",
    type: "hud-crosshairs",
    legacy: legacySlot(
      false,
      hudCrosshairsFields
    ),
    item: HudCrosshairsItemSchema
  },
  {
    key: "sparkline",
    type: "hud-sparkline",
    legacy: legacySlot(
      true,
      hudSparklineFields
    ),
    item: HudSparklineItemSchema
  },
  {
    key: "gauge",
    type: "hud-gauge",
    legacy: legacySlot(
      true,
      hudGaugeFields
    ),
    item: HudGaugeItemSchema
  },
  {
    key: "swatch",
    type: "hud-swatch",
    // The legacy swatch slot carried its own non-optional style defaults
    // (identical to hudElementStyle's), so it never actually inherited the
    // container style — parsing it with those defaults preserves that.
    legacy: z
      .object( {
        enabled: z.boolean().default( false ),
        ...hudSwatchFields,
        ...hudElementStyle
      } )
      .prefault( {} ),
    item: HudSwatchItemSchema
  },
  {
    key: "counter",
    type: "hud-counter",
    legacy: legacySlot(
      false,
      hudCounterFields
    ),
    item: HudCounterItemSchema
  },
  {
    key: "badge",
    type: "hud-badge",
    legacy: legacySlot(
      false,
      hudBadgeFields
    ),
    item: HudBadgeItemSchema
  }
] as const;

/* ---------------- transition sound (montage + sequence) ---------- */

// How a single transition sounds: one hit, or an N-hit burst with an optional
// pitch ramp (a "spin-up" whoosh as the variant snaps in). Discriminated union
// so the panel shows only the controls the picked mode uses, matching the
// specs sound-on-change pattern.
export const SlideTransitionSoundRepeatSchema = z
  .discriminatedUnion(
    "mode",
    [
      z.object( {
        mode: z.literal( "once" )
      } ),
      z.object( {
        mode: z.literal( "count" ),
        // total hits per transition (first one included)
        times: z.number().int()
          .min( 2 )
          .max( 16 )
          .default( 3 ),
        // seconds between hits of the burst
        interval: soundRepeatInterval.default( 0.06 ),
        // pitch ramp per hit, in octaves ( + rises, - falls, 0 = flat )
        pitchStep: z.number().min( -0.5 )
          .max( 0.5 )
          .default( 0.35 )
      } )
    ]
  )
  // Default to a short 3-hit rising burst: the "spin-up" reads more clearly as
  // a transition than a single tick. Fully specified so the parsed default is
  // complete (a bare { mode } would leave the burst fields unbound in the UI).
  .default( {
    mode: "count",
    times: 3,
    interval: 0.06,
    pitchStep: 0.35
  } );

// Sound played when a montage advances from one variant to the next — the
// audible counterpart of the visual dip / title switch, heard "in between" the
// two slides at each transition. Off by default so existing decks stay silent;
// routes through the sketch audio engine (audio.trigger("click", …)) so it is
// heard live AND baked into recordings, sample-accurate in deterministic
// captures. The sequence item plays the same hit at each scene change.
export const SlideTransitionSoundSchema = z
  .object( {
    // Master switch (independent from the montage master switch).
    enabled: z.boolean().default( false ),
    // Voice from the shared click synth.
    preset: z.enum( SPECS_SOUND_PRESETS ).default( "pop" ),
    volume: z.number().min( 0 )
      .max( 1 )
      .default( 0.5 ),
    // Global pitch multiplier (1 = as designed, 2 = octave up).
    pitch: z.number().min( 0.25 )
      .max( 4 )
      .default( 1 ),
    // Random per-transition detune, 0..1 (1 ≈ ±half an octave) — "humanize".
    pitchVariation: z.number().min( 0 )
      .max( 1 )
      .default( 0 ),
    // Pitch offset by the arriving variant's index, in octaves across the
    // montage, so each slide lands on its own note (a small arpeggio as the
    // montage cycles). 0 = every transition sounds at the same pitch.
    slidePitchSpread: z.number().min( -2 )
      .max( 2 )
      .default( 1.05 ),
    repeat: SlideTransitionSoundRepeatSchema
  } )
  .prefault( {} );

/* ---------------- sequence: whole sketches cut together ----------- */
// A "sequence" content item is a reel. Its scenes — a whole other sketch, a
// splash card, a loading screen, a colour plate — take turns on screen over the
// loop, each one ENTERING through a GL transition (the catalogue below), each
// framed by a camera move, and the whole thing graded like film (letterbox,
// vignette, grain, chromatic aberration…). Every scene is drawn into its own
// buffer — a sketch scene through the same runtime a "sketch" layer uses
// (nestedSketch.js) — and a fragment shader composites the two scenes a
// transition straddles. Everything is a pure function of the loop clock, so a
// capture renders the same cut as the preview. Runtime:
// src/sketches/p5/utils/sequence/.

/** What a scene is. */
export const SEQUENCE_SCENE_KINDS = [
  "sketch",
  "splash",
  "loader",
  "plate"
] as const;

/** `cyclic` plays the last scene's cut back into the first; `once` holds the last. */
export const SEQUENCE_LOOP_MODES = [
  "cyclic",
  "once"
] as const;

/**
 * The GL transition catalogue (transitionGlsl.js has one fragment per kind).
 * `cut` is the hard cut; `dip` and `flash` go through the transition colour;
 * everything else reveals the arriving scene through a mask or a warp whose
 * edge can carry the colour (or a palette ramp) as a glow.
 */
export const SEQUENCE_TRANSITION_KINDS = [
  "cut",
  "fade",
  "dip",
  "flash",
  "wipe",
  "iris",
  "push",
  "zoom",
  "dissolve",
  "pixelate",
  "glitch",
  "blinds",
  "tiles",
  "radial",
  "ripple",
  "swirl",
  "cube",
  "doom",
  "burn",
  "luma",
  "slice"
] as const;

export const SEQUENCE_IRIS_SHAPES = [
  "circle",
  "diamond",
  "square",
  "star"
] as const;

export const SEQUENCE_PUSH_MODES = [
  "push",
  "cover",
  "reveal"
] as const;

export const SEQUENCE_ZOOM_DIRECTIONS = [
  "in",
  "out"
] as const;

export const SEQUENCE_TILE_MOTIONS = [
  "flip",
  "shrink",
  "fall",
  "spin"
] as const;

export const SEQUENCE_CUBE_AXES = [
  "horizontal",
  "vertical"
] as const;

/** A scene's camera move over its own time on screen. */
export const SEQUENCE_CAMERA_MOVES = [
  "none",
  "push-in",
  "pull-out",
  "pan-left",
  "pan-right",
  "pan-up",
  "pan-down",
  "drift",
  "orbit",
  "handheld"
] as const;

/** How a plate (a splash / loader / plate scene's background) lays its two colours. */
export const SEQUENCE_PLATE_GRADIENTS = [
  "solid",
  "linear",
  "radial",
  "conic",
  "stripes"
] as const;

export const SEQUENCE_SPLASH_ANIMATIONS = [
  "none",
  "rise",
  "letters",
  "typewriter",
  "scale",
  "slide"
] as const;

export const SEQUENCE_SPLASH_ACCENTS = [
  "none",
  "bars",
  "rings",
  "grid",
  "confetti",
  "glow"
] as const;

export const SEQUENCE_LOADER_STYLES = [
  "bar",
  "ring",
  "dots",
  "blocks",
  "boot"
] as const;

/**
 * Where a transition's or a plate's colours come from: the item's own colour
 * field(s), or a shared palette (utils/palettes.js) whose ramp is swept — the
 * edge of a wipe walks the ramp as it crosses, a plate's gradient reads two
 * points of it. Kept a plain string: an unknown id falls back to the colour.
 */
export const SEQUENCE_PALETTE_OWN = "color";

const unitAmount = z.number().min( 0 )
  .max( 1 );
const angleDegrees = z.number().min( 0 )
  .max( 360 );
const effectSeed = z.number().int()
  .min( 0 )
  .max( 9999 )
  .default( 7 );
const effectCenter = Vec2.default( {
  x: 0.5,
  y: 0.5
} );

// Each effect carries only the parameters it reads, so the panel shows exactly
// those (conditional-group on `kind`). Every field has an explicit default:
// a branch switch rebuilds the object from them (see sketches.md on
// conditional-group).
export const SequenceEffectSchema = z
  .discriminatedUnion(
    "kind",
    [
      z.object( {
        kind: z.literal( "cut" )
      } ),
      z.object( {
        kind: z.literal( "fade" )
      } ),
      z.object( {
        kind: z.literal( "dip" )
      } ),
      z.object( {
        kind: z.literal( "flash" ),
        // How white-hot the flash gets at its peak (1 = a full frame of colour).
        intensity: unitAmount.default( 0.85 )
      } ),
      z.object( {
        kind: z.literal( "wipe" ),
        angle: angleDegrees.default( 0 ),
        softness: unitAmount.default( 0.08 )
      } ),
      z.object( {
        kind: z.literal( "iris" ),
        shape: z.enum( SEQUENCE_IRIS_SHAPES ).default( "circle" ),
        center: effectCenter,
        softness: unitAmount.default( 0.05 )
      } ),
      z.object( {
        kind: z.literal( "push" ),
        angle: angleDegrees.default( 0 ),
        mode: z.enum( SEQUENCE_PUSH_MODES ).default( "push" )
      } ),
      z.object( {
        kind: z.literal( "zoom" ),
        direction: z.enum( SEQUENCE_ZOOM_DIRECTIONS ).default( "in" ),
        amount: unitAmount.default( 0.6 ),
        center: effectCenter
      } ),
      z.object( {
        kind: z.literal( "dissolve" ),
        // Noise cells across the frame: low = big blotches, high = fine grain.
        scale: z.number().min( 1 )
          .max( 64 )
          .default( 8 ),
        softness: unitAmount.default( 0.15 ),
        seed: effectSeed
      } ),
      z.object( {
        kind: z.literal( "pixelate" ),
        // Coarsest mosaic reached mid-transition, in cells across the frame.
        cells: z.number().int()
          .min( 2 )
          .max( 200 )
          .default( 24 )
      } ),
      z.object( {
        kind: z.literal( "glitch" ),
        intensity: unitAmount.default( 0.7 ),
        blocks: z.number().int()
          .min( 2 )
          .max( 64 )
          .default( 12 ),
        seed: effectSeed
      } ),
      z.object( {
        kind: z.literal( "blinds" ),
        count: z.number().int()
          .min( 1 )
          .max( 64 )
          .default( 8 ),
        angle: angleDegrees.default( 90 ),
        softness: unitAmount.default( 0.05 )
      } ),
      z.object( {
        kind: z.literal( "tiles" ),
        columns: z.number().int()
          .min( 1 )
          .max( 32 )
          .default( 6 ),
        rows: z.number().int()
          .min( 1 )
          .max( 32 )
          .default( 8 ),
        // 0 = every tile turns at once, 1 = one after the other.
        stagger: unitAmount.default( 0.6 ),
        motion: z.enum( SEQUENCE_TILE_MOTIONS ).default( "flip" ),
        seed: effectSeed
      } ),
      z.object( {
        kind: z.literal( "radial" ),
        center: effectCenter,
        softness: unitAmount.default( 0.04 ),
        clockwise: z.boolean().default( true ),
        startAngle: angleDegrees.default( 0 )
      } ),
      z.object( {
        kind: z.literal( "ripple" ),
        rings: z.number().min( 1 )
          .max( 40 )
          .default( 10 ),
        amplitude: unitAmount.default( 0.3 ),
        center: effectCenter
      } ),
      z.object( {
        kind: z.literal( "swirl" ),
        // Turns at the centre at the peak; negative swirls the other way.
        strength: z.number().min( -3 )
          .max( 3 )
          .default( 1.5 ),
        center: effectCenter
      } ),
      z.object( {
        kind: z.literal( "cube" ),
        axis: z.enum( SEQUENCE_CUBE_AXES ).default( "horizontal" ),
        perspective: unitAmount.default( 0.4 )
      } ),
      z.object( {
        kind: z.literal( "doom" ),
        columns: z.number().int()
          .min( 2 )
          .max( 200 )
          .default( 40 ),
        seed: effectSeed
      } ),
      z.object( {
        kind: z.literal( "burn" ),
        scale: z.number().min( 1 )
          .max( 64 )
          .default( 6 ),
        softness: unitAmount.default( 0.25 ),
        seed: effectSeed
      } ),
      z.object( {
        kind: z.literal( "luma" ),
        softness: unitAmount.default( 0.1 ),
        // Dark parts of the outgoing scene go first instead of the bright ones.
        invert: z.boolean().default( false )
      } ),
      z.object( {
        kind: z.literal( "slice" ),
        count: z.number().int()
          .min( 2 )
          .max( 64 )
          .default( 10 ),
        angle: angleDegrees.default( 0 ),
        stagger: unitAmount.default( 0.5 )
      } )
    ]
  )
  .default( {
    kind: "wipe",
    angle: 0,
    softness: 0.08
  } );

// How a scene ENTERS. The duration is in seconds of the piece and is taken out
// of the scene's own time on screen; the outgoing scene keeps drawing under it.
export const SequenceTransitionSchema = z
  .object( {
    duration: z.number().min( 0 )
      .max( 10 )
      .default( 0.8 ),
    // Easing key from easing.js, applied to the transition's progress.
    easing: z.string().default( "easeInOutCubic" ),
    // The colour a dip / flash passes through and the glow on a reveal's edge.
    color: RGBA.default( [
      8,
      8,
      12
    ] ),
    // "color" = the colour above; a palette id sweeps that palette's ramp
    // along the edge over the transition.
    palette: z.string().default( SEQUENCE_PALETTE_OWN ),
    // Width and strength of the light along a reveal's edge (0 = none).
    glow: unitAmount.default( 0.35 ),
    effect: SequenceEffectSchema
  } )
  .prefault( {} );

// A scene's camera: a slow move over the time it is on screen, applied to the
// scene's buffer when it is composited — the scene itself never knows.
export const SequenceCameraSchema = z
  .object( {
    move: z.enum( SEQUENCE_CAMERA_MOVES ).default( "none" ),
    // How far the move travels (1 = the whole frame's worth).
    amount: unitAmount.default( 0.25 ),
    easing: z.string().default( "linear" ),
    // Handheld jitter on top of the move, from the loop clock (deterministic).
    shake: unitAmount.default( 0 ),
    // Dutch angle, in degrees, reached at the end of the move.
    roll: z.number().min( -45 )
      .max( 45 )
      .default( 0 )
  } )
  .prefault( {} );

// A plate: the ground a splash / loader / plate scene paints, two colours (or
// two points of a palette ramp) laid as a gradient that can travel over the
// scene, with an optional static grain.
export const SequencePlateSchema = z
  .object( {
    palette: z.string().default( SEQUENCE_PALETTE_OWN ),
    gradient: z.enum( SEQUENCE_PLATE_GRADIENTS ).default( "linear" ),
    from: RGBA.default( [
      24,
      20,
      60
    ] ),
    to: RGBA.default( [
      255,
      90,
      140
    ] ),
    angle: angleDegrees.default( 135 ),
    // How far the gradient travels over the scene's time (0 = still).
    drift: unitAmount.default( 0.3 ),
    grain: unitAmount.default( 0.15 )
  } )
  .prefault( {} );

// Every scene: how long it stays relative to the others, how it enters, how
// its camera moves while it is on.
const sequenceSceneBase = {
  weight: z.number().min( 0.1 )
    .max( 10 )
    .default( 1 ),
  transition: SequenceTransitionSchema,
  camera: SequenceCameraSchema
};

// A whole other sketch, run as a "sketch" layer is (same buffer, same swaps).
export const SequenceSketchSceneSchema = z.object( {
  kind: z.literal( "sketch" ),
  ...sequenceSceneBase,
  // Catalogue path, "<category>/<name>" — the string a sketch layer stores.
  sketch: z.string().default( "" ),
  // That sketch's own parameters, rendered from its formConfiguration.
  settings: z.any().default( {} ),
  // Loops of the sketch's own animation played over the scene's time on
  // screen; 0 follows the host's clock instead.
  loops: z.number().min( 0 )
    .max( 8 )
    .default( 1 ),
  // Where in its loop the sketch starts the scene.
  progression: unitAmount.default( 0 ),
  // Redraws per second of loop time; 0 follows the host.
  framerate: z.number().min( 0 )
    .max( 120 )
    .default( 0 ),
  // Buffer pixel density, as on a sketch layer.
  resolution: z.number().min( 0.05 )
    .max( 2 )
    .default( 1 ),
  // A scene is the whole picture, so unlike a layer it paints its own
  // background by default.
  drawBackground: z.boolean().default( true ),
  clearEachFrame: z.boolean().default( true )
} );

// A title card: a headline (and a line under it) animated in over a plate.
export const SequenceSplashSceneSchema = z.object( {
  kind: z.literal( "splash" ),
  ...sequenceSceneBase,
  title: z.string().default( "SKETCHBOOK" ),
  subtitle: z.string().default( "" ),
  font: z.string().default( "martian" ),
  size: z.number().positive()
    .default( 120 ),
  fill: RGBA.default( [
    255,
    255,
    255
  ] ),
  align: HorizontalAlign.default( "center" ),
  position: Vec2.default( {
    x: 0.5,
    y: 0.5
  } ),
  animation: z.enum( SEQUENCE_SPLASH_ANIMATIONS ).default( "letters" ),
  // Decorative motion behind the words, coloured from the plate.
  accent: z.enum( SEQUENCE_SPLASH_ACCENTS ).default( "bars" ),
  background: SequencePlateSchema
} );

// A loading screen that fills over the scene's time — a fake progress read as
// a beat, not a real one.
export const SequenceLoaderSceneSchema = z.object( {
  kind: z.literal( "loader" ),
  ...sequenceSceneBase,
  label: z.string().default( "LOADING" ),
  style: z.enum( SEQUENCE_LOADER_STYLES ).default( "bar" ),
  font: z.string().default( "spaceMonoRegular" ),
  size: z.number().positive()
    .default( 28 ),
  fill: RGBA.default( [
    255,
    255,
    255
  ] ),
  showPercent: z.boolean().default( true ),
  // How much the progress hesitates on its way up (0 = a straight ramp).
  stutter: unitAmount.default( 0.35 ),
  background: SequencePlateSchema
} );

// A bare plate: a beat of colour between two scenes.
export const SequencePlateSceneSchema = z.object( {
  kind: z.literal( "plate" ),
  ...sequenceSceneBase,
  background: SequencePlateSchema
} );

export const SequenceSceneSchema = z.discriminatedUnion(
  "kind",
  [
    SequenceSketchSceneSchema,
    SequenceSplashSceneSchema,
    SequenceLoaderSceneSchema,
    SequencePlateSceneSchema
  ]
);

// The finish laid over the whole composite, every frame: film chrome.
export const SequenceGradeSchema = z
  .object( {
    // Black bars top and bottom, as a fraction of the height (0 = none).
    letterbox: z.number().min( 0 )
      .max( 0.4 )
      .default( 0 ),
    vignette: unitAmount.default( 0 ),
    // Animated film grain, from the loop clock.
    grain: unitAmount.default( 0 ),
    // Chromatic aberration: the colour channels split towards the edges.
    aberration: unitAmount.default( 0 ),
    saturation: z.number().min( 0 )
      .max( 2 )
      .default( 1 ),
    contrast: z.number().min( 0.5 )
      .max( 2 )
      .default( 1 ),
    tint: RGBA.default( [
      255,
      200,
      120
    ] ),
    tintAmount: unitAmount.default( 0 ),
    scanlines: unitAmount.default( 0 )
  } )
  .prefault( {} );

export const SequenceItemSchema = z.object( {
  type: z.literal( "sequence" ),
  enabled: z.boolean().default( true ),
  scenes: z.array( SequenceSceneSchema ).default( [] ),
  loop: z.enum( SEQUENCE_LOOP_MODES ).default( "cyclic" ),
  // Placed and sized like a sketch layer, so a sequence can be the whole
  // picture (the default) or a picture-in-picture.
  position: Vec2.default( {
    x: 0.5,
    y: 0.5
  } ),
  scale: z.number().min( 0.05 )
    .max( 4 )
    .default( 1 ),
  aspectRatio: SketchLayerAspectRatio.default( "canvas" ),
  rotation: z.number().default( 0 ),
  opacity: unitAmount.default( 1 ),
  blend: Blend.default( "source-over" ),
  // Pixel density of the composite buffer (the scene buffers follow it).
  resolution: z.number().min( 0.05 )
    .max( 2 )
    .default( 1 ),
  grade: SequenceGradeSchema,
  // A hit at each scene change, through the sketch audio engine.
  sound: SlideTransitionSoundSchema
} );

export const ContentItemSchema = z.discriminatedUnion(
  "type",
  [
    BackgroundItemSchema,
    MetaItemSchema,
    SpecsItemSchema,
    BreakdownItemSchema,
    TextItemSchema,
    TitleItemSchema,
    ImagesStackItemSchema,
    ImageItemSchema,
    SketchLayerItemSchema,
    SequenceItemSchema,
    QrCodeItemSchema,
    HudBadgeItemSchema,
    HudGaugeItemSchema,
    HudSparklineItemSchema,
    HudCounterItemSchema,
    HudCrosshairsItemSchema,
    HudSwatchItemSchema,
    HudReadoutItemSchema,
    HudVectorItemSchema,
    HudVector3dItemSchema,
    HudBoundingBoxItemSchema
  ]
);

export const Assets = z
  .object( {
    images: z.array( z.string() ).default( [] ),
    videos: z.array( z.string() ).default( [] ),
    audios: z.array( z.string() ).default( [] )
  } )
  .prefault( {} );

/* ----------- shared size / animation schemas -------------------- */
export const SketchSizeSchema = z.object( {
  width: z.number().min( 50 )
    .max( 8192 )
    .default( 1080 ),
  height: z.number().min( 50 )
    .max( 8192 )
    .default( 1350 )
} );

// `.catch` on each leaf so one invalid value (e.g. a 0 duration) heals to the
// shared default WITHOUT taking its sibling — or the whole options object via
// the top-level catch in initOptions — down with it. `framerate` and
// `duration` are independent, so a bad duration must not also reset framerate.
export const SketchAnimationSchema = z.object( {
  framerate: z.coerce.number().int()
    .min( 1 )
    .max( 240 )
    .default( FRAMERATE_DEFAULT )
    .catch( FRAMERATE_DEFAULT ),
  duration: z.coerce.number().min( 1 )
    .max( 60 )
    .default( DURATION_DEFAULT )
    .catch( DURATION_DEFAULT )
} );

/* ---------------- montage / transition slide -------------------- */

export const TRANSITION_SOURCE_MODES = [
  "all",
  "selected"
] as const;

export const TRANSITION_LOOP_MODES = [
  "cyclic",
  "pingpong",
  "once"
] as const;

export const TRANSITION_STYLES = [
  "morph",
  "dip"
] as const;

/* ---------------- montage slide-title overlay ------------------- */

// How the current variant is identified in the title.
export const TITLE_MODES = [
  "name",
  "alphabet",
  "number",
  "id"
] as const;

// Visual chrome around the label — duplicated in spirit from the specs
// overlay's highlight styles so a title can match the on-screen specs look.
export const TITLE_DISPLAY_STYLES = [
  "plain",
  "bracket",
  "pill",
  "underline"
] as const;

// How the label transitions when the montage advances to the next variant.
// "roll" is the per-character odometer (bonus): digits / letters slide in the
// increment direction.
export const TITLE_CHANGE_ANIMATIONS = [
  "none",
  "fade",
  "rise",
  "scale",
  "roll"
] as const;

export const TITLE_ALIGNMENTS = [
  "left",
  "center",
  "right"
] as const;

// Overlay that names the variant a montage slide is currently showing. It
// rides on the same segment clock as the morph (see segmentMapper), so the
// label tracks — and animates between — the source slides as they cycle.
//
// Flat (not a discriminated union) on purpose: the panel toggles the
// mode-specific controls with conditional groups, mirroring how the rest of
// the montage panel reveals style-specific options.
export const SlideTitleSchema = z.object( {
  // Master switch (independent from the montage master switch).
  enabled: z.boolean().default( false ),

  // Which identifier to print for the current variant.
  mode: z.enum( TITLE_MODES ).default( "alphabet" ),

  // "name" / "alphabet" only — render the label in upper case.
  uppercase: z.boolean().default( true ),

  // "number" only — first index value and zero-padding width.
  numberStart: z.number().int()
    .default( 1 ),
  numberPadding: z.number().int()
    .min( 0 )
    .max( 6 )
    .default( 0 ),

  // "id" only — the slide id is long, so keep this many trailing characters.
  idLength: z.number().int()
    .min( 2 )
    .max( 36 )
    .default( 8 ),

  // Prefix printed before the identifier (e.g. "VARIANT 3"). Toggleable, and
  // the word itself is overridable ("version", "slide", …).
  showPrefix: z.boolean().default( true ),
  prefix: z.string().default( "VARIANT" ),

  // Placement — top-right, aligned with the specs overlay's default height.
  position: Vec2.default( {
    x: 0.95,
    y: 0.06
  } ),
  align: z.enum( TITLE_ALIGNMENTS ).default( "right" ),

  // Styling — defaults duplicated from the specs overlay (same green, same
  // mono font, same size) so a title reads as part of the same HUD.
  font: z.string().default( "spaceMonoRegular" ),
  size: z.number().positive()
    .default( 22 ),
  fill: RGBA.default( [
    0,
    255,
    120
  ] ),
  // Panel painted behind the label. Transparent black by default (draws
  // nothing) — set a colour (e.g. a solid dark) to keep a light label readable
  // over busy sketches. For the "bracket" style the panel extends to enclose
  // the [ ] glyphs too.
  backgroundColor: RGBA.default( [
    0,
    0,
    0,
    0
  ] ),
  // Optional outline around that panel. Defaults to the label fill colour with
  // zero opacity (draws nothing) — raise the alpha to reveal a border in the
  // same colour as the label.
  backgroundStroke: RGBA.default( [
    0,
    255,
    120,
    0
  ] ),
  // Corner radius of that panel, in pixels. 0 = sharp rectangle.
  backgroundRadius: z.number().min( 0 )
    .max( 200 )
    .default( 0 ),
  blend: Blend.default( "source-over" ),
  style: z.enum( TITLE_DISPLAY_STYLES ).default( "bracket" ),

  // Transition played each time the shown variant changes.
  changeAnimation: z.enum( TITLE_CHANGE_ANIMATIONS ).default( "roll" ),
  changeEasing: z.string().default( "easeOutCubic" )
} );

/* ---------------- montage transition sound ---------------------- */
// SlideTransitionSoundRepeatSchema / SlideTransitionSoundSchema are declared
// above the content-item union: the sequence item plays the same hit at each
// scene change.

// A "montage" slide morphs the sketch parameters of several OTHER slides into
// one another over its own duration, in a loop. Only the sources' `sketch`
// params are interpolated — the montage keeps its own size/animation, so source
// slides are assumed canvas-compatible.
export const SlideTransitionSchema = z.object( {
  // Master switch. A slide behaves as a montage only when enabled === true.
  enabled: z.boolean().default( false ),

  // "all" = every other (non-montage) slide in deck order.
  // "selected" = only the slides in `slideIds`, in that order.
  sources: z.enum( TRANSITION_SOURCE_MODES ).default( "all" ),

  // Persisted SlideSchema.id values; order = montage order. Self / unknown ids
  // are filtered at runtime. Ignored when sources === "all".
  slideIds: z.array( z.string() ).default( [] ),

  // "morph" = interpolate params between sources (numbers/colours lerp).
  // "dip"   = snap params at the segment midpoint, hidden behind a fade to
  //           dipColor — the robust choice for non-morphable variants whose
  //           seed/layout/structure differ too much to interpolate.
  style: z.enum( TRANSITION_STYLES ).default( "morph" ),

  // Easing key from easing.js (e.g. "linear", "easeInOutCubic").
  easing: z.string().default( "easeInOutCubic" ),

  // Auto-fit hold: fraction [0..0.9] of each segment spent static on the source
  // before the morph to the next begins. 0 = continuous morph.
  holdRatio: z.number().min( 0 )
    .max( 0.9 )
    .default( 0.3 ),

  loop: z.enum( TRANSITION_LOOP_MODES ).default( "cyclic" ),

  // morph only — how sequentially the individual parameters that differ between
  // the source slides change [0..1]. 0 = every changing param morphs together;
  // 1 = they change strictly one after another, each over its own even slice of
  // the transition (param 1, then 2, then 3, …). In between, the per-param
  // windows shrink and slide apart. Only leaves that actually differ are
  // sequenced.
  stagger: z.number().min( 0 )
    .max( 1 )
    .default( 0 ),

  // morph only — param paths (dotted, or a leaf name like "seed") that SNAP at
  // the segment boundary instead of interpolating: discrete params (random
  // seeds, enums, integer counts) or params that invalidate a heavy per-frame
  // cache.
  snapKeys: z.array( z.string() ).default( [
    "seed"
  ] ),

  // dip only — the colour the canvas fades through while params switch.
  dipColor: RGBA.default( [
    0,
    0,
    0
  ] ),

  // Overlay naming the variant currently on screen. Always present after parse
  // (its own `enabled` gates rendering) so existing montage decks heal in.
  title: SlideTitleSchema.prefault( {} ),

  // Sound played at each variant change. Always present after parse (its own
  // `enabled` gates playback) so existing montage decks heal in silently.
  sound: SlideTransitionSoundSchema.prefault( {} )
} );

/* ---------------- scene cut: a slide's entrance and exit ---------- */

// A slide (or the root document) opens its loop out of a colour plate and
// closes it back into it, through the sequence item's transition catalogue:
// the first `in.duration` seconds reveal the picture, the last `out.duration`
// seconds hide it. Slides joined in one export then cut like a film instead of
// jumping; a lone loop gets a bookend. Optional and absent until switched on,
// like the montage; a slide's block wins over the root's. Runtime:
// slides/common/drawSceneCut.js.
// No `.prefault` on the block itself: under zod 4 an optional key whose schema
// carries one is materialised on every parse, and the cut must stay absent
// from a document that never asked for it (the montage's `transition` is the
// precedent). `SceneCutSchema.parse( {} )` still fills every default — the
// panel's switch parses the whole block in that way.
export const SceneCutSchema = z.object( {
  enabled: z.boolean().default( false ),
  // The ground the picture comes out of and goes back into.
  plate: SequencePlateSchema,
  in: SequenceTransitionSchema,
  out: SequenceTransitionSchema
} );

/* ---------------- slide schema (with name) ---------------------- */
export const SlideSchema = z.object( {
  // Persisted, durable id (see makeSlideId). Backfilled on every parse when
  // absent, so existing decks heal automatically and montage references survive
  // reorder / duplicate / reload.
  id: z.string().default( () => makeSlideId() ),
  name: z.string().optional(),
  size: SketchSizeSchema.optional(),
  animation: SketchAnimationSchema.optional(),
  content: z.array( ContentItemSchema ).default( [] ),
  assets: Assets,
  sketch: z.any().optional(),
  // Per-slide interaction-bindings namespace (`{ bindings, interaction }`),
  // overriding the root `interactive` key-by-key — see migrateInteractiveOptions.
  interactive: z.any().optional(),
  transition: SlideTransitionSchema.optional(),
  cut: SceneCutSchema.optional()
} );

/* ---------------- root options.json ----------------------------- */

export const OptionsSchema = z.object( {
  id: z.string().default( "" )
    .optional(),
  name: z.string().default( "" )
    .optional(),
  size: SketchSizeSchema.default( {
    width: 1080,
    height: 1350
  } ),
  animation: SketchAnimationSchema.default( {
    framerate: FRAMERATE_DEFAULT,
    duration: DURATION_DEFAULT
  } ),
  content: z.array( ContentItemSchema ).default( [] ),
  assets: Assets,
  slides: z.array( SlideSchema ).default( [] ),
  // zod 3 treated a bare `z.any()` key as implicitly optional; zod 4 requires
  // the key to be present unless it says so. Spelled out to match SlideSchema
  // above and keep `OptionsSchema.parse( {} )` working — per-sketch params are
  // supplied by each sketch's own options.ts, not by this root schema.
  sketch: z.any().optional(),
  // The interaction-bindings plugin's namespace (`{ bindings, interaction }`),
  // kept OUTSIDE `sketch` so binding data never pollutes the sketch's own
  // parameters (exports, save-defaults, randomize, sketch code). Untyped like
  // `sketch` — its shape belongs to the plugin, not this root schema.
  interactive: z.any().optional(),
  // The document's own scene cut, for a piece without slides (a slide's wins).
  cut: SceneCutSchema.optional()
} );

export type ContentItem = z.infer<typeof ContentItemSchema>;
export type BreakdownItemOption = z.infer<typeof BreakdownItemSchema>;
export type BreakdownBuildOption = z.infer<typeof BreakdownBuildSchema>;
export type SlideOption = z.infer<typeof SlideSchema>;
export type SlideTransitionOption = z.infer<typeof SlideTransitionSchema>;
export type SlideTitleOption = z.infer<typeof SlideTitleSchema>;
export type SlideTransitionSoundOption = z.infer<typeof SlideTransitionSoundSchema>;
export type SequenceItemOption = z.infer<typeof SequenceItemSchema>;
export type SequenceSceneOption = z.infer<typeof SequenceSceneSchema>;
export type SequenceTransitionOption = z.infer<typeof SequenceTransitionSchema>;
export type SequenceEffectOption = z.infer<typeof SequenceEffectSchema>;
export type SequenceCameraOption = z.infer<typeof SequenceCameraSchema>;
export type SequencePlateOption = z.infer<typeof SequencePlateSchema>;
export type SequenceGradeOption = z.infer<typeof SequenceGradeSchema>;
export type SceneCutOption = z.infer<typeof SceneCutSchema>;
export type AssetsOption = z.infer<typeof Assets>;

export type SketchOption = z.infer<typeof OptionsSchema>;
export type SlideOptionInput = z.input<typeof SlideSchema>;
export type SketchOptionInput = z.input<typeof OptionsSchema>;
