import {
  z
} from "zod";

// Wave mode schemas
const LinearWaveSchema = z.object( {
  mode: z.literal( "linear" ),
  directionX: z.number().min( -1 )
    .max( 1 )
    .default( -1 ),
  directionY: z.number().min( -1 )
    .max( 1 )
    .default( -1 ),
} );

const RadialWaveSchema = z.object( {
  mode: z.literal( "radial" ),
  fromCenter: z.boolean().default( true ),
  radialRotation: z.boolean().default( true ),
} );

const InteractiveWaveSchema = z.object( {
  mode: z.literal( "interactive" ),
  useMouse: z.boolean().default( false ),
  sensitivity: z.number().min( 0.1 )
    .max( 2 )
    .default( 0.5 ),
  sinMultiplier: z.number().min( 1 )
    .max( 9 )
    .default( 3 ),
  cosMultiplier: z.number().min( 1 )
    .max( 9 )
    .default( 1 ),
} );

export const WaveConfigSchema = z.discriminatedUnion(
  "mode",
  [
    LinearWaveSchema,
    RadialWaveSchema,
    InteractiveWaveSchema,
  ]
);
