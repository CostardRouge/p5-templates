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
const HorizontalAlign = z.enum( [
  "left",
  "center",
  "right"
] );
const VerticalAlign = z.enum( [
  "top",
  "center",
  "baseline",
  "bottom"
] );
const Blend = z.enum( [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "exclusion",
] );

/* ---------------- content discriminated union ------------------- */
const GridPatternSchema = z.object( {
  type: z.literal( "grid" ),
  columns: z.number().positive(),
  strokeWeight: z.number().min( 0 ),
  stroke: RGBA, // Assuming RGBA
} );

const DotsPatternSchema = z.object( {
  type: z.literal( "dots" ),
  size: z.number().positive(),
  padding: z.number().min( 0 ),
  fill: RGBA,
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
  background: RGBA,
  pattern: PatternSchema,
} );

const ImagesStackItem = z.object( {
  type: z.literal( "images-stack" ),
  margin: z.number().nonnegative()
    .optional(),
  center: z.boolean().optional(),
  position: Vec2.optional(),
  animation: z.string().optional(),
  shift: z.number().optional(),
} );

const MetaItem = z.object( {
  type: z.literal( "meta" ),
  topRight: z.string(),
  topLeft: z.string(),
  bottomLeft: z.string(),
  stroke: RGBA,
  fill: RGBA,
  slideProgression: z.object( {
    hidden: z.boolean().optional(),
    stroke: RGBA,
    fill: RGBA,
  } )
} );

const TextItem = z.object( {
  type: z.literal( "text" ),
  content: z.string(),
  size: z.number().positive(),
  stroke: RGBA,
  fill: RGBA,
  font: z.string().optional(),
  blend: Blend.optional(),
  position: Vec2.optional(),
  horizontalMargin: z.number().min( 0 )
    .max( 1 )
    .optional(),
  verticalMargin: z.number().min( 0 )
    .max( 1 )
    .optional(),
  align: z.array(
    HorizontalAlign,
    VerticalAlign
  ).optional(),
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