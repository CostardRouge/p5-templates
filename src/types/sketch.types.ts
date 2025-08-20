/* ---------------- shared atoms stay unchanged ------------------- */
import {
  z
} from "zod";

const RGB = z.tuple( [
  z.number(),
  z.number(),
  z.number(),
] );
const RGBA = z.union( [
  RGB,
  z.tuple( [
    ...RGB.items,
    z.number()
  ] )
] );

const Vec2 = z.object( {
  x: z
    .number()
    .min( 0 )
    .max( 1 ),
  y: z
    .number()
    .min( 0 )
    .max( 1 )
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
  columns: z.number().positive(),
  strokeWeight: z.number().min( 0 ),
  stroke: RGBA.default( [
    255,
    255,
    255,
    255
  ] ),
  borders: z.boolean().default( false ), // Assuming RGBA
} );

const DotsPatternSchema = z.object( {
  type: z.literal( "dots" ),
  size: z.number().positive(),
  padding: z.number().min( 0 ),
  fill: RGBA.default( [
    0,
    0,
    0,
    255
  ] ),
} );

// Create a discriminated union for the pattern
export const PatternSchema = z.discriminatedUnion(
  "type",
  [
    GridPatternSchema,
    DotsPatternSchema,
  ]
);

const BackgroundItem = z.object( {
  type: z.literal( "background" ),
  background: RGBA.default( [
    246,
    235,
    225,
    255
  ] ),
  pattern: PatternSchema,
} );

const MetaItem = z.object( {
  type: z.literal( "meta" ),
  topRight: z.string().default( "" ),
  topLeft: z.string().default( "" ),
  bottomLeft: z.string().default( "" ),
  stroke: RGBA.default( [
    255,
    255,
    255,
    255
  ] ),
  fill: RGBA.default( [
    0,
    0,
    0,
    255
  ] ),
  slideProgression: z.object( {
    hidden: z.boolean().default( false ),
    stroke: RGBA.default( [
      255,
      255,
      255,
      255
    ] )
  } )
} );

const TextItem = z.object( {
  type: z.literal( "text" ),
  content: z.string(),
  size: z.number().positive(),
  stroke: RGBA.default( [
    255,
    255,
    255,
    255
  ] ),
  fill: RGBA.default( [
    0,
    0,
    0,
    255
  ] ),
  font: z.string().default( "martian" ),
  blend: Blend.optional(),
  position: Vec2.default( {
    x: 0.5,
    y: 0.5
  } ),
  horizontalMargin: z.number()
    .min( 0 )
    .max( 1 )
    .default( 0.015 ),
  verticalMargin: z.number()
    .min( 0 )
    .max( 1 )
    .default( 0.015 ),
  align: z.tuple( [
    HorizontalAlign,
    VerticalAlign
  ] ).default( [
    "center",
    "baseline"
  ] ),
} );

export const ImageItemAnimations = z.discriminatedUnion(
  "name",
  [
    z
      .object( {
        name: z.literal( "noise-floating" ),
        amplitude: z.number().default( 50 ),
        noiseDetail: z.array( z.number().min( 2 ) ).default( [
          2,
          0.7
        ] )
      } )
  ]
);

export const ImagesStackAnimations = z.discriminatedUnion(
  "name",
  [
    z
      .object( {
        name: z.literal( "random" ),
        shift: z.number().default( 80 ),
      } )
  ]
);

const ImageItemSchema = z.object( {
  type: z.literal( "image" ),
  source: z.string().min(
    1,
    "Image is required"
  ),
  margin: z.number().nonnegative()
    .default( 0 ),
  center: z.boolean().default( true ),
  scale: z.number().positive()
    .default( 1 ),
  position: Vec2.default( {
    x: 0.5,
    y: 0.5
  } ),
  animation: ImageItemAnimations
} );

const ImagesStackItem = z.object( {
  type: z.literal( "images-stack" ),
  margin: z.number().nonnegative()
    .optional(),
  center: z.boolean().default( false ),
  position: Vec2.default( {
    x: 0.5,
    y: 0.5
  } ),
  animation: ImagesStackAnimations,
  shift: z.number().default( 30 ),
  sources: z.array( z.string().min( 1 ) ).min( 1 ),
} );

const VideoItem = z.object( {
  type: z.literal( "video" )
} ).passthrough();
const VisualItem = z.object( {
  type: z.literal( "visual" )
} ).passthrough();

export const ContentItemSchema = z.discriminatedUnion(
  "type",
  [
    BackgroundItem,
    MetaItem,
    TextItem,

    ImagesStackItem,
    ImageItemSchema,

    // VideoItem,
    // VisualItem,
  ]
);

export const Assets = z
  .object( {
    images: z
      .array( z.string() )
      .default( [
      ] ),
    videos: z.
      array( z.string() )
      .default( [
      ] ),
  } )
  .default( {
  } );

/* ---------------- slide schema (with name) ---------------------- */
export const Slide = z.object( {
  name: z.string().default( "new slide" ),
  layout: z.string(),
  content: z.array( ContentItemSchema ),
  assets: Assets
} );

/* ---------------- root options.json ----------------------------- */
export const OptionsSchema = z.object( {
  id: z.string().optional(),
  name: z.string().optional(),
  consumeTestImages: z.boolean().default( false ),
  size: z.object( {
    width: z
      .number()
      .int()
      .positive()
      .default( 1080 ),
    height: z
      .number()
      .int()
      .positive()
      .default( 1350 ),
  } ),
  animation: z.object( {
    framerate: z
      .number()
      .int()
      .positive()
      .default( 60 ),
    duration: z
      .number()
      .positive()
      .default( 12 ),
  } ),
  layout: z.string().default( "free" ),
  content: z.array( ContentItemSchema )
    .default( [
    ] ),
  assets: Assets,
  slides: z.array( Slide )
    .default( [
    ] ),
} );

export type MetaItem = z.infer<typeof MetaItem>;
export type ContentItem = z.infer<typeof ContentItemSchema>;
export type SketchOption = z.infer<typeof OptionsSchema>;
export type SlideOption = z.infer<typeof Slide>;
export type AssetsOption = z.infer<typeof Assets>;