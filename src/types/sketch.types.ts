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
  ] ), // Assuming RGBA
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

const ImagesStackItem = z.object( {
  type: z.literal( "images-stack" ),
  margin: z.number().nonnegative()
    .optional(),
  center: z.boolean().default( false ),
  position: Vec2.optional(),
  animation: z.string().optional(),
  shift: z.number().default( 30 ),
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
  font: z.string().optional(),
  blend: Blend.optional(),
  position: Vec2.optional(),
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

const ImageItem = z.object( {
  type: z.literal( "image" ),
  index: z.number().int()
    .nonnegative(),
  margin: z.number().nonnegative()
    .optional(),
  center: z.boolean().optional(),
  scale: z.number().positive()
    .optional(),
  position: Vec2.optional(),
  animation: z
    .object( {
      name: z.string(),
    } )
    .optional(),
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
    ImagesStackItem,
    MetaItem,
    TextItem,
    ImageItem,
    VideoItem,
    VisualItem,
  ]
);

export const Assets = z
  .object( {
    images: z
      .array( z.string() )
      .default( [
      ] )
      .optional(),
    videos: z.
      array( z.string() )
      .default( [
      ] )
      .optional(),
  } )
  .default( {
  } )
  .optional();

/* ---------------- slide schema (with name) ---------------------- */
export const Slide = z.object( {
  name: z.string().optional(),
  layout: z.string(),
  content: z.array( ContentItemSchema ),
  assets: Assets
} );

/* ---------------- root options.json ----------------------------- */
export const OptionsSchema = z.object( {
  id: z.string().optional(),
  name: z.string().optional(),
  consumeTestImages: z.boolean().optional(),
  size: z.object( {
    width: z.number().int()
      .positive(),
    height: z.number().int()
      .positive(),
  } ).optional(),
  animation: z.object( {
    framerate: z.number().int()
      .positive(),
    duration: z.number().positive(),
  } ).optional(),
  layout: z.string().optional(),
  content: z.array( ContentItemSchema ).optional(),
  assets: Assets,
  slides: z.array( Slide ).optional(),
} );

export type MetaItem = z.infer<typeof MetaItem>;
export type ContentItem = z.infer<typeof ContentItemSchema>;
export type SketchOption = z.infer<typeof OptionsSchema>;
export type SlideOption = z.infer<typeof Slide>;
export type AssetsOption = z.infer<typeof Assets>;