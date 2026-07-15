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
    ...RGB.items,
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
  .default( {} );

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
      noiseDetail: z
        .array(
          z.number().min( 0 )
            .max( 8 ),
          z.number().min( 0 )
            .max( 1 )
        )
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

// Visual items
export const neonGraffitiSchema = z.object( {
  name: z.literal( "neon-graffiti" )
} );

export const neonLineSchema = z.object( {
  name: z.literal( "neon-line" )
} );

export const neonDotSchema = z.object( {
  name: z.literal( "neon-dot" )
} );

export const churrosSnakeSchema = z.object( {
  name: z.literal( "churros-snake" )
} );

export const VisualOptions = z
  .discriminatedUnion(
    "name",
    [
      neonGraffitiSchema,
      neonLineSchema,
      neonDotSchema,
      churrosSnakeSchema
    ]
  )
  .default( {
    name: "neon-graffiti"
  } );

export const VisualItemSchema = z.object( {
  type: z.literal( "visual" ),
  visual: VisualOptions.optional(),

  position: Vec2.default( {
    x: 0,
    y: 0
  } ),
  scale: z.number().default( 1 ),
  rotation: z.number().default( 0 )
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

/* ---------------- HUD / telemetry content-item ------------------ */
// A single "hud" content-item holds one slot per telemetry widget. Each widget
// binds to a `source`: a built-in live key (fps / frame / progression …) or a
// dotted key-path into the sketch settings ("magnitude.start").

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

export const HudBadgeSchema = z
  .object( {
    enabled: z.boolean().default( false ),
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
      .default( 20 ),
    fill: RGBA.optional(),
    font: z.string().optional(),
    blend: Blend.optional()
  } )
  .default( {} );

export const HudGaugeSchema = z
  .object( {
    enabled: z.boolean().default( true ),
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
    fill: RGBA.optional(),
    blend: Blend.optional(),
    ...hudWindow
  } )
  .default( {} );

export const HudSparklineSchema = z
  .object( {
    enabled: z.boolean().default( true ),
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
    fill: RGBA.optional(),
    blend: Blend.optional(),
    ...hudWindow
  } )
  .default( {} );

export const HudCounterSchema = z
  .object( {
    enabled: z.boolean().default( false ),
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
    fill: RGBA.optional(),
    blend: Blend.optional(),
    ...hudWindow
  } )
  .default( {} );

export const HudCrosshairsSchema = z
  .object( {
    enabled: z.boolean().default( false ),
    source: z.string().default( "center" ),
    size: z.number().positive()
      .default( 16 ),
    fill: RGBA.optional(),
    blend: Blend.optional(),
    ...hudWindow
  } )
  .default( {} );

export const HudSwatchSchema = z
  .object( {
    enabled: z.boolean().default( false ),
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
    fill: RGBA.default( [
      0,
      255,
      120,
      255
    ] ),
    font: z.string().default( "spaceMonoRegular" ),
    blend: Blend.default( "source-over" ),
    ...hudWindow
  } )
  .default( {} );

export const HudBoundingBoxSchema = z
  .object( {
    enabled: z.boolean().default( false ),
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
    fill: RGBA.optional(),
    blend: Blend.optional(),
    ...hudWindow
  } )
  .default( {} );

export const HudItemSchema = z.object( {
  type: z.literal( "hud" ),
  fill: RGBA.default( [
    0,
    255,
    120,
    255
  ] ),
  // Panel painted behind each widget's readout. Transparent black by default
  // (draws nothing) — set a colour to keep the telemetry readable over busy
  // sketches. Applies to the boxed widgets, not the full-canvas crosshairs /
  // bounding-box overlays.
  backgroundColor: RGBA.default( [
    0,
    0,
    0,
    0
  ] ),
  // Optional outline around each widget's panel. Defaults to the fill colour
  // with zero opacity (draws nothing) — raise the alpha to reveal a border in
  // the same colour as the readout.
  backgroundStroke: RGBA.default( [
    0,
    255,
    120,
    0
  ] ),
  // Corner radius of those panels, in pixels. 0 = sharp rectangle.
  backgroundRadius: z.number().min( 0 )
    .max( 200 )
    .default( 0 ),
  font: z.string().default( "spaceMonoRegular" ),
  blend: Blend.default( "source-over" ),
  badge: HudBadgeSchema,
  gauge: HudGaugeSchema,
  sparkline: HudSparklineSchema,
  counter: HudCounterSchema,
  crosshairs: HudCrosshairsSchema,
  swatch: HudSwatchSchema,
  boundingBox: HudBoundingBoxSchema
} );

export const ContentItemSchema = z.discriminatedUnion(
  "type",
  [
    BackgroundItemSchema,
    MetaItemSchema,
    SpecsItemSchema,
    TextItemSchema,
    TitleItemSchema,
    ImagesStackItemSchema,
    ImageItemSchema,
    VisualItemSchema,
    QrCodeItemSchema,
    HudItemSchema
  ]
);

export const Assets = z
  .object( {
    images: z.array( z.string() ).default( [] ),
    videos: z.array( z.string() ).default( [] )
  } )
  .default( {} );

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
// captures.
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
  .default( {} );

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

  // morph only — spread [0..0.9] of the per-group phase offset, so top-level
  // param groups don't all morph in lockstep (e.g. colours lead, geometry
  // follows). 0 = every group morphs together.
  stagger: z.number().min( 0 )
    .max( 0.9 )
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
  title: SlideTitleSchema.default( {} ),

  // Sound played at each variant change. Always present after parse (its own
  // `enabled` gates playback) so existing montage decks heal in silently.
  sound: SlideTransitionSoundSchema.default( {} )
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
  transition: SlideTransitionSchema.optional()
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
  sketch: z.any()
} );

export type ContentItem = z.infer<typeof ContentItemSchema>;
export type SlideOption = z.infer<typeof SlideSchema>;
export type SlideTransitionOption = z.infer<typeof SlideTransitionSchema>;
export type SlideTitleOption = z.infer<typeof SlideTitleSchema>;
export type SlideTransitionSoundOption = z.infer<typeof SlideTransitionSoundSchema>;
export type AssetsOption = z.infer<typeof Assets>;

export type SketchOption = z.infer<typeof OptionsSchema>;
export type SlideOptionInput = z.input<typeof SlideSchema>;
export type SketchOptionInput = z.input<typeof OptionsSchema>;
