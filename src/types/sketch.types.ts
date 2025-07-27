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
const BackgroundItem = z.object( {
  type: z.literal( "background" ),
  background: RGBA,
  pattern: z
    .object( {
      type: z.literal( "grid" ),
      columns: z.number().int()
        .positive(),
      strokeWeight: z.number().positive(),
      stroke: RGBA,
    } )
    .optional(),
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

export const ContentItem = z.discriminatedUnion(
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
    images: z.array( z.string() ).default( [
    ] ),
    videos: z.array( z.string() ).default( [
    ] ),
  } )
  .default( {
  } );

/* ---------------- slide schema (with name) ---------------------- */
export const Slide = z.object( {
  name: z.string().optional(),
  layout: z.string(),
  content: z.array( ContentItem ),
  assets: Assets
} );

/* ---------------- root options.json ----------------------------- */
export const OptionsSchema = z.object( {
  id: z.string(),
  name: z.string(),
  consumeTestImages: z.boolean().optional(),
  size: z.object( {
    width: z.number().int()
      .positive(),
    height: z.number().int()
      .positive(),
  } ),
  animation: z.object( {
    framerate: z.number().int()
      .positive(),
    duration: z.number().positive(),
  } ),
  layout: z.string().optional(),
  content: z.array( ContentItem ).optional(),
  assets: Assets,
  slides: z.array( Slide ).optional(),
} );

export type ContentItem = z.infer<typeof ContentItem>;
export type SketchOption = z.infer<typeof OptionsSchema>;
export type SlideOption = z.infer<typeof Slide>;
export type AssetsOption = z.infer<typeof Assets>;