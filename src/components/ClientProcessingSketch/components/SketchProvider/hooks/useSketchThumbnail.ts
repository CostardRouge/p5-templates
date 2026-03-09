import { useMemo } from "react";
import type { JobModel } from "@/types/recording.types";
import getP5SketchThumbnailURL from "@/utils/getP5SketchThumbnailURL";

interface UseSketchThumbnailProps {
  name: string;
  persistedJob?: JobModel;
  updatedAt?: number;
}

export function useSketchThumbnail({
  name,
  persistedJob,
  updatedAt,
}: UseSketchThumbnailProps) {
  const thumbnailUrl = useMemo(() => {
    if (persistedJob?.id && persistedJob?.thumbnails) {
      const timestamp =
        updatedAt ||
        (persistedJob.updatedAt &&
          new Date(persistedJob.updatedAt).getTime()) ||
        Date.now();
      return `/api/recordings/${persistedJob.id}/thumbnail?t=${timestamp}`;
    }

    return getP5SketchThumbnailURL(name);
  }, [
    name,
    persistedJob?.id,
    persistedJob?.thumbnails,
    persistedJob?.updatedAt,
    updatedAt,
  ]);

  return {
    thumbnailUrl,
  };
}
