/* ---------------- shared atoms stay unchanged ------------------- */
import {
  z
} from "zod";

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

const Vec2 = z
  .object( {
    x: z.number().min( 0 )
      .max( 1 )
      .default( 0.5 ),
    y: z.number().min( 0 )
      .max( 1 )
      .default( 0.5 )
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
  blend: Blend.default( "source-over" ),
  position: Vec2.default( {
    x: 0.05,
    y: 0.06
  } ),
  lineHeight: z.number().positive()
    .default( 1.4 ),
  showCursor: z.boolean().default( true ),
  includeSketchSettings: z.boolean().default( true ),
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

export const ContentItemSchema = z.discriminatedUnion(
  "type",
  [
    BackgroundItemSchema,
    MetaItemSchema,
    SpecsItemSchema,
    TextItemSchema,
    ImagesStackItemSchema,
    ImageItemSchema,
    VisualItemSchema
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

export const SketchAnimationSchema = z.object( {
  framerate: z.number().int()
    .min( 1 )
    .max( 240 )
    .default( 60 ),
  duration: z.coerce.number().min( 1 )
    .max( 60 )
    .default( 12 )
} );

/* ---------------- slide schema (with name) ---------------------- */
export const SlideSchema = z.object( {
  name: z.string().optional(),
  size: SketchSizeSchema.optional(),
  animation: SketchAnimationSchema.optional(),
  content: z.array( ContentItemSchema ).default( [] ),
  assets: Assets,
  sketch: z.any().optional()
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
    framerate: 60,
    duration: 12
  } ),
  content: z.array( ContentItemSchema ).default( [] ),
  assets: Assets,
  slides: z.array( SlideSchema ).default( [] ),
  sketch: z.any()
} );

export type ContentItem = z.infer<typeof ContentItemSchema>;
export type SlideOption = z.infer<typeof SlideSchema>;
export type AssetsOption = z.infer<typeof Assets>;

export type SketchOption = z.infer<typeof OptionsSchema>;
export type SlideOptionInput = z.input<typeof SlideSchema>;
export type SketchOptionInput = z.input<typeof OptionsSchema>;
