import { z } from "zod";

// Wave mode schemas
const LinearWaveSchema = z.object({
  mode: z.literal("linear"),
  directionX: z.number().min(-1).max(1).default(-1),
  directionY: z.number().min(-1).max(1).default(-1),
});

const RadialWaveSchema = z.object({
  mode: z.literal("radial"),
  fromCenter: z.boolean().default(true),
});

export const WaveConfigSchema = z.discriminatedUnion("mode", [
  LinearWaveSchema,
  RadialWaveSchema,
]);
