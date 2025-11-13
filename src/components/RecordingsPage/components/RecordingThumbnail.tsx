import { useState } from "react";
import { Eye, Video } from "lucide-react";
import clsx from "clsx";
import type { JobModel } from "@/types/recording.types";

interface RecordingThumbnailProps {
  job: JobModel;
  onClick?: () => void;
  className?: string;
  showEyeInCorner?: boolean;
}

export default function RecordingThumbnail( {
  job,
  onClick,
  className,
  showEyeInCorner = false
}: RecordingThumbnailProps ) {
  const [
    imageError,
    setImageError
  ] = useState( false );
  
  const src = `/api/recordings/${ job.id }/thumbnail`;
  const showEyeIcon = job.status === "completed" && job.videoUrls && job.thumbnails;
  const isRecording = job.status === "active";

  const getStatusColor = () => {
    switch ( job.status ) {
      case "completed": return "bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400";
      case "active": return "bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400";
      case "failed": return "bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400";
      case "cancelled": return "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400";
      case "queued": return "bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400";
      default: return "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400";
    }
  };

  return (
    <div
      onClick={onClick}
      className={clsx(
        className,
        "relative overflow-hidden flex items-center justify-center",
        {
          "animate-pulse": job.status === "active"
        }
      )}
    >
      {imageError ? (
        <div className={`w-full h-full flex flex-col items-center justify-center gap-2 ${ getStatusColor() }`}>
          <Video className="w-8 h-8 opacity-50" />
          <div className="text-center px-2">
            <div className="text-xs font-medium opacity-75">No Preview</div>
            <div className="text-[10px] opacity-50 truncate max-w-full">{job.template}</div>
          </div>
        </div>
      ) : (
        <>
          {showEyeIcon && !showEyeInCorner && (
            <Eye
              className="w-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-foreground bg-background rounded-lg py-1 px-1 border border-theme z-10"
            />
          )}
          {showEyeIcon && showEyeInCorner && (
            <div className="absolute bottom-3 left-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 z-10">
              <button className="p-2 bg-background/90 backdrop-blur-sm hover:bg-hover rounded-lg border border-border shadow-lg transition-colors inline-flex items-center justify-center">
                <Eye className="h-4 w-4 text-foreground"/>
              </button>
            </div>
          )}
          {isRecording && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" style={{ width: '24px', height: '24px' }} />
                <div className="relative rounded-full bg-red-600 shadow-lg" style={{ width: '24px', height: '24px' }} />
              </div>
            </div>
          )}
          <img
            src={src}
            alt={job.template}
            loading="lazy"
            onError={() => setImageError( true )}
            className={clsx( "w-full h-full object-cover", {
              grayscale: job.status !== "completed"
            } )}
          />
        </>
      )}
    </div>
  );
}
