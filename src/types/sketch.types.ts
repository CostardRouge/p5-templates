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
      .optional()
      .default( 255 )
  ] )
] );

const Vec2 = z
  .object( {
    x: z
      .number()
      .min( 0 )
      .max( 1 )
      .default( 0.5 ),
    y: z
      .number()
      .min( 0 )
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
  columns: z
    .number()
    .positive()
    .min( 0 )
    .max( 100 ),
  strokeWeight: z
    .number()
    .positive()
    .min( 0 )
    .max( 100 ),
  stroke: RGBA.default( [
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
    0
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

export const BackgroundItemSchema = z.object( {
  type: z.literal( "background" ),
  background: RGBA.default( [
    246,
    235,
    225
  ] ),
  pattern: PatternSchema,
} );

export const MetaItemSchema = z.object( {
  type: z.literal( "meta" ),
  topRight: z.string().default( "" ),
  topLeft: z.string().default( "" ),
  bottomLeft: z.string().default( "" ),
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
  slideProgression: z.object( {
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

export const TextItemSchema = z.object( {
  type: z.literal( "text" ),
  content: z.string().default( "" ),
  size: z.number()
    .positive()
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
    "left",
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
        noiseDetail: z
          .array(
            z
              .number()
              .min( 0 )
              .max( 8 ),
            z.number()
              .min( 0 )
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
    z
      .object( {
        name: z.literal( "random" ),
        shift: z.number().default( 30 ),
      } )
  ]
);

export const ImageItemSchema = z.object( {
  type: z.literal( "image" ),
  source: z.string().default( "" ),
  // .min(
  //   1,
  //   "Image is required"
  // ),
  margin: z.number()
    .min( 0 )
    .max( 1000 )
    .default( 0 ),
  center: z.boolean().default( true ),
  scale: z.number()
    .min( 0 )
    .max( 6 )
    .default( 1 ),
  position: Vec2,
  animation: ImageItemAnimations.optional()
} );

export const ImagesStackItemSchema = z.object( {
  type: z.literal( "images-stack" ),
  margin: z.number().nonnegative()
    .default( 0 ),
  center: z.boolean().default( false ),
  position: Vec2,
  animation: ImagesStackAnimations.optional(),
  sources: z
    .array( z
      .string()
      .default( "" ) )
    .min( 1 )
    .default( [
      ""
    ] ),
} );

// const VideoItem = z.object( {
//   type: z.literal( "video" )
// } ).passthrough();
// const VisualItem = z.object( {
//   type: z.literal( "visual" )
// } ).passthrough();

export const ContentItemSchema = z.discriminatedUnion(
  "type",
  [
    BackgroundItemSchema,
    MetaItemSchema,
    TextItemSchema,

    ImagesStackItemSchema,
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
  id: z
    .string()
    .default( "" )
    .optional(),
  name: z
    .string()
    .default( "" )
    .optional(),
  consumeTestImages: z
    .boolean()
    .default( false )
    .optional(),
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
  } )
    .default( {
      width: 1080,
      height: 1350
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
  } ).default( {
    framerate: 60,
    duration: 12
  } ),
  layout: z
    .string()
    .default( "free" ),
  content: z
    .array( ContentItemSchema )
    .default( [
    ] ),
  assets: Assets,
  slides: z
    .array( Slide )
    .default( [
    ] ),
} );

export type ContentItem = z.infer<typeof ContentItemSchema>;
export type SketchOption = z.infer<typeof OptionsSchema>;
export type SlideOption = z.infer<typeof Slide>;
export type AssetsOption = z.infer<typeof Assets>;