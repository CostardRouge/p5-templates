import type {
  ExportFrameCount
} from "./variants";

/**
 * The concrete, ordered frame indices a still-sequence export grabs.
 *
 * A numeric count samples the loop evenly (start-aligned, so the loop's
 * endpoint is never duplicated); `"all"` walks every frame. Numeric counts are
 * clamped to the frames actually available, so a short loop cannot emit the
 * same still twice.
 */
export function resolveFrameIndices(
  count: ExportFrameCount, totalFrames: number
): number[] {
  if ( count === "all" ) {
    return Array.from(
      {
        length: totalFrames
      },
      (
        _unused, index
      ) => index
    );
  }

  const sampleCount = Math.min(
    count,
    totalFrames
  );

  return Array.from(
    {
      length: sampleCount
    },
    (
      _unused, index
    ) => Math.floor( ( index * totalFrames ) / sampleCount )
  );
}
