import clsx from "clsx";
import {
  Eye, Video
} from "lucide-react";
import {
  useState
} from "react";
import {
  useSketchThumbnail
} from "@/components/ClientProcessingSketch/components/SketchProvider/hooks/useSketchThumbnail";
import type {
  JobModel
} from "@/types/recording.types";
import {
  getSlideCount
} from "@/utils/getSlideCount";
import SlidePreviewGrid from "./SlidePreviewGrid";

interface RecordingThumbnailProps {
  job: JobModel;
  onClick?: () => void;
  className?: string;
  showEyeInCorner?: boolean;
  enableHoverPreview?: boolean;
}

export default function RecordingThumbnail( {
  job,
  onClick,
  className,
  showEyeInCorner = false,
  enableHoverPreview = false
}: RecordingThumbnailProps ) {
  const [
    imageError,
    setImageError
  ] = useState( false );
  const [
    showPreview,
    setShowPreview
  ] = useState( false );

  const [
    templateEngine,
    ...templateNameParts
  ] = job.template.split( "/" );
  const templateName = templateNameParts.join( "/" );
  const {
    thumbnailUrl: src
  } = useSketchThumbnail( {
    engine: templateEngine,
    name: templateName,
    persistedJob: job,
    updatedAt: new Date( job.updatedAt ).getTime()
  } );
  const showEyeIcon =
    job.status === "completed" && job.videoUrls && job.thumbnails;
  const isRecording = job.status === "active";
  const isQueued = job.status === "queued";
  const isFailed = job.status === "failed";
  const isCompleted = job.status === "completed";
  const slideCount = getSlideCount( job );

  // We assume the API will return the template thumbnail if the recording one isn't ready.
  // If the image fails to load (404 etc), we show the placeholder.
  const shouldShowThumbnail = !imageError;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() =>
        enableHoverPreview && slideCount > 1 && setShowPreview( true )
      }
      onMouseLeave={() => setShowPreview( false )}
      className={clsx(
        className,
        "relative overflow-hidden flex items-center justify-center bg-gray-100 dark:bg-gray-800",
        {
          "animate-pulse": isQueued,
          "cursor-pointer": !!onClick
        }
      )}
    >
      {/* Hover Preview Grid (Desktop only, completed jobs only) */}
      {enableHoverPreview && job.status === "completed" && (
        <SlidePreviewGrid
          jobId={job.id}
          slideCount={slideCount}
          isVisible={showPreview}
        />
      )}

      {!shouldShowThumbnail ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-400">
          <Video className="w-8 h-8 opacity-50" />
          <div className="text-center px-2">
            <div className="text-xs font-medium opacity-75">No Preview</div>
            <div className="text-[10px] opacity-50 truncate max-w-full px-10 elipsis">
              {job.template}
            </div>
          </div>
        </div>
      ) : (
        <>
          {showEyeIcon && !showEyeInCorner && (
            <Eye className="w-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-foreground bg-background rounded-lg py-1 px-1 border border-theme z-40" />
          )}
          {showEyeIcon && showEyeInCorner && (
            <div className="absolute bottom-3 left-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 z-40">
              <button className="p-2 bg-background/90 backdrop-blur-sm hover:bg-hover rounded-lg border border-border shadow-lg transition-colors inline-flex items-center justify-center">
                <Eye className="h-4 w-4 text-foreground" />
              </button>
            </div>
          )}
          {isRecording && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40">
              <div className="relative">
                <div
                  className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75"
                  style={{
                    width: "24px",
                    height: "24px"
                  }}
                />
                <div
                  className="relative rounded-full bg-red-600 shadow-lg"
                  style={{
                    width: "24px",
                    height: "24px"
                  }}
                />
              </div>
            </div>
          )}
          {isFailed && (
            <div className="absolute inset-0 bg-red-500/20 z-20 mix-blend-multiply pointer-events-none" />
          )}
          <img
            src={src}
            alt={job.template}
            loading="lazy"
            onError={() => setImageError( true )}
            className={clsx(
              "w-full h-full object-cover transition-all duration-300",
              {
                grayscale: !isCompleted
              }
            )}
          />
        </>
      )}
    </div>
  );
}
