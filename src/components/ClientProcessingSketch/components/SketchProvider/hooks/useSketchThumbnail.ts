import {
  useMemo
} from "react";
import type {
  JobModel
} from "@/types/recording.types";
import getSketchThumbnailURL from "@/utils/getSketchThumbnailURL";

interface UseSketchThumbnailProps {
  engine: string;
  name: string;
  persistedJob?: JobModel;
  updatedAt?: number;
}

export function useSketchThumbnail( {
  engine,
  name,
  persistedJob,
  updatedAt,
}: UseSketchThumbnailProps ) {
  const thumbnailUrl = useMemo(
    () => {
      if ( persistedJob?.id && persistedJob?.thumbnails ) {
        const timestamp =
        updatedAt ||
        ( persistedJob.updatedAt &&
          new Date( persistedJob.updatedAt ).getTime() ) ||
        Date.now();

        return `/api/recordings/${ persistedJob.id }/thumbnail?t=${ timestamp }`;
      }

      return getSketchThumbnailURL(
        engine,
        name
      );
    },
    [
      engine,
      name,
      persistedJob?.id,
      persistedJob?.thumbnails,
      persistedJob?.updatedAt,
      updatedAt,
    ]
  );

  return {
    thumbnailUrl,
  };
}
