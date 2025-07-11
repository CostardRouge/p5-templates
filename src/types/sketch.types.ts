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

/* ---------------- slide schema (with name) ---------------------- */
export const Slide = z.object( {
  name: z.string().optional(),
  layout: z.string(), // "free", "grid2x2", …
  content: z.array( ContentItem ),
  assets: z
    .object( {
      images: z.array( z.string() ).default( [
      ] ),
      videos: z.array( z.string() ).default( [
      ] ),
    } )
    .default( {
    } ),
} );

/* ---------------- root options.json ----------------------------- */
export const OptionsSchema = z.object( {
  name: z.string(),
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
  // no global colors / lines / durationBar anymore
  layout: z.string().optional(), // root-level layout if you want one
  content: z.array( ContentItem ).optional(), // root-level free content
  assets: z.object( {
    images: z.array( z.string() ).default( [
    ] ),
  } ),
  slides: z.array( Slide ).default( [
  ] ),
} );

export type RecordingSketchOptions = z.infer<typeof OptionsSchema>;
export type SlideOptions = z.infer<typeof Slide>;