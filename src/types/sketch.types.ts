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
    .min( 0 )
    .max( 100 )
    .default( 9 ),
  strokeWeight: z
    .number()
    .min( 0 )
    .max( 100 )
    .default( 1 ),
  stroke: RGBA
    .default( [
      226,
      215,
      205
    ] ),
  borders: z
    .boolean()
    .default( false ),
} );

const DotsPatternSchema = z.object( {
  type: z.literal( "dots" ),
  columns: z
    .number()
    .min( 0 )
    .max( 100 )
    .default( 50 ),
  strokeWeight: z
    .number()
    .min( 0 )
    .max( 100 )
    .default( 4 ),
  stroke: RGBA
    .default( [
      226,
      215,
      205
    ] ),
  borders: z
    .boolean()
    .default( false ),
} );

// Create a discriminated union for the pattern
export const PatternSchema = z.discriminatedUnion(
  "type",
  [
    GridPatternSchema,
    DotsPatternSchema,
  ]
).default( {
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
  topLeft: z.string().default( "" ),
  topRight: z.string().default( "" ),
  bottomLeft: z.string().default( "" ),
  bottomRight: z.string().default( "" ),
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
    x: 0,
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
  animation: z.preprocess(
    ( v ) => {
      if ( v == null ) {
        return undefined;
      }

      if ( typeof v === "object" && "name" in ( v as any ) && ( v as any ).name === "" ) {
        return undefined;
      }

      return v;
    },
    ImageItemAnimations.optional()
  ),
} );

const NonEmptyPath = z
  .string()
  .trim()
  .min( 1 );

export const ImagesStackItemSchema = z.object( {
  type: z.literal( "images-stack" ),

  sources: z.preprocess(
    ( v ) => Array.isArray( v )
      ? v.filter( ( s ) => typeof s === "string" && s.trim().length > 0 )
      : [
      ],
    z.array( NonEmptyPath ).default( [
    ] )
  ),

  margin: z.number().nonnegative()
    .default( 0 ),
  center: z.boolean().default( false ),
  position: Vec2,
  animation: ImagesStackAnimations.optional(),
} );

export const ContentItemSchema = z.discriminatedUnion(
  "type",
  [
    BackgroundItemSchema,
    MetaItemSchema,
    TextItemSchema,
    ImagesStackItemSchema,
    ImageItemSchema,
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
export const SlideSchema = z.object( {
  name: z.string().optional( ),
  content: z.array( ContentItemSchema ).default( [
  ] ),
  assets: Assets
} );

/* ---------------- root options.json ----------------------------- */
const SketchSizeSchema = z.object( {
  width: z
    .number()
    .min( 50 )
    .max( 8192 )
    .default( 1080 ),
  height: z
    .number()
    .min( 50 )
    .max( 8192 )
    .default( 1350 ),
} );

const SketchAnimationSchema = z.object( {
  framerate: z
    .number()
    .int()
    .min( 1 )
    .max( 240 )
    .default( 60 ),
  duration: z.coerce
    .number()
    .min( 1 )
    .max( 60 )
    .default( 12 ),
} );

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
  size: SketchSizeSchema
    .default( {
      width: 1080,
      height: 1350
    } ),
  animation: SketchAnimationSchema
    .default( {
      framerate: 60,
      duration: 12
    } ),
  content: z
    .array( ContentItemSchema )
    .default( [
    ] ),
  assets: Assets,
  slides: z
    .array( SlideSchema )
    .default( [
    ] ),
} );

export type ContentItem = z.infer<typeof ContentItemSchema>;
export type SlideOption = z.infer<typeof SlideSchema>;
export type AssetsOption = z.infer<typeof Assets>;

export type SketchOption = z.infer<typeof OptionsSchema>;
export type SketchOptionInput = z.input<typeof OptionsSchema>;