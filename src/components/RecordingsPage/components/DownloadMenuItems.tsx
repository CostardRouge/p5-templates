import {
  MenuItem
} from "@headlessui/react";
import {
  FileArchive, Video
} from "lucide-react";
import fetchDownload from "@/utils/fetchDownload";
import {
  formatFileSize
} from "../utils/formatters";
import type {
  JobModel
} from "@/types/recording.types";

interface DownloadMenuItemsProps {
  job: JobModel;
}

export default function DownloadMenuItems( {
  job
}: DownloadMenuItemsProps ) {
  if ( job.status !== "completed" ) return null;

  const videoUrls = ( job.videoUrls as unknown as string[] ) || [];
  const videoSizes = ( job.videoSizes as unknown as number[] ) || [];

  let zipSize: number | null = null;

  if ( videoSizes.length > 0 ) {
    const totalVideoSize = videoSizes.reduce(
      (
        sum, size
      ) => sum + ( size || 0 ),
      0
    );

    zipSize = totalVideoSize + videoSizes.length * 100 + 1024;
  }

  const videos = videoUrls.map( (
    url, index
  ) => ( {
    url,
    size: videoSizes[ index ] || null,
    index,
    key: url
  } ) );

  return (
    <>
      {videos.length > 1 &&
        videos.map( ( video ) => (
          <MenuItem key={video.index}>
            {( {
              focus
            } ) => (
              <button
                onClick={async() =>
                  await fetchDownload( `/api/recordings/download/${ job.id }/slide/${ video.index }` )
                }
                className={`${ focus ? "bg-hover" : "" } flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors`}
              >
                <Video className="h-4 w-4 text-foreground/70" />
                <div className="flex-1 flex items-center justify-between">
                  <span className="font-medium">Slide {video.index + 1}</span>
                  {video.size && (
                    <span className="text-xs text-foreground/50">
                      {formatFileSize( video.size )}
                    </span>
                  )}
                </div>
              </button>
            )}
          </MenuItem>
        ) )}

      {videos.length === 1 && (
        <MenuItem>
          {( {
            focus
          } ) => (
            <button
              onClick={async() =>
                await fetchDownload( `/api/recordings/download/${ job.id }/slide/0` )
              }
              className={`${ focus ? "bg-hover" : "" } flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors`}
            >
              <Video className="h-4 w-4 text-foreground/70" />
              <div className="flex-1 flex items-center justify-between">
                <span className="font-medium">Video</span>
                {videos[ 0 ].size && (
                  <span className="text-xs text-foreground/50">
                    {formatFileSize( videos[ 0 ].size )}
                  </span>
                )}
              </div>
            </button>
          )}
        </MenuItem>
      )}

      {videos.length > 1 && (
        <MenuItem>
          {( {
            focus
          } ) => (
            <button
              onClick={async() =>
                await fetchDownload( `/api/recordings/download/${ job.id }/zip` )
              }
              className={`${ focus ? "bg-hover" : "" } flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors`}
            >
              <FileArchive className="h-4 w-4 text-foreground/70" />
              <div className="flex-1 flex items-center justify-between">
                <span className="font-medium">All Slides (ZIP)</span>
                {zipSize && (
                  <span className="text-xs text-foreground/50">
                    {formatFileSize( zipSize )}
                  </span>
                )}
              </div>
            </button>
          )}
        </MenuItem>
      )}
    </>
  );
}
