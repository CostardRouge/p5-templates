import HardLink from "@/components/HardLink";
import CompactProgressBar from "@/components/CompactProgressBar";
import { getRecordingSteps } from "@/utils/recordingSteps";
import RecordingThumbnail from "./RecordingThumbnail";
import StatusBadge from "./StatusBadge";
import ActionsMenu from "./ActionsMenu";
import { formatDuration } from "../utils/formatters";
import type { JobModel } from "@/types/recording.types";

interface RecordingCardProps {
  job: JobModel;
  startTime?: number;
  isSelected: boolean;
  onToggleSelection: () => void;
  onPreview: () => void;
  onCancel: ( job: JobModel ) => void;
  onDelete: ( job: JobModel ) => void;
  onRetry: ( job: JobModel ) => void;
  onStart: ( job: JobModel ) => void;
  onClone: ( job: JobModel ) => void;
}

export default function RecordingCard( {
  job,
  startTime,
  isSelected,
  onToggleSelection,
  onPreview,
  onCancel,
  onDelete,
  onRetry,
  onStart,
  onClone
}: RecordingCardProps ) {
  return (
    <div className="group bg-background border border-border hover:border-foreground/20 rounded-2xl transition-all duration-300 hover:shadow-lg hover:shadow-foreground/5 hover:-translate-y-0.5 relative">
      {/* Thumbnail Section */}
      <div className="relative overflow-hidden rounded-t-2xl">
        {/* Checkbox Overlay */}
        <div className="absolute top-3 left-3 z-20">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelection}
            className="w-5 h-5 rounded border-2 border-white shadow-lg text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer bg-white/90 backdrop-blur-sm"
            onClick={( e ) => e.stopPropagation()}
          />
        </div>
        <RecordingThumbnail
          job={job}
          onClick={() => {
            if ( job.status === "completed" && job.videoUrls ) {
              onPreview();
            }
          }}
          className={`w-full aspect-square object-cover transition-all duration-300 ${
            job.videoUrls ? "cursor-pointer group-hover:scale-105" : "cursor-default"
          }`}
          showEyeInCorner={true}
        />
        
        {/* Status Badge Overlay */}
        <div className="absolute top-3 right-3 z-10">
          <StatusBadge
            status={job.status}
            className="shadow-lg backdrop-blur-sm"
          />
        </div>

        {/* Actions Menu Overlay */}
        <div className="absolute bottom-3 right-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
          <ActionsMenu
            job={job}
            onCancel={onCancel}
            onDelete={onDelete}
            onRetry={onRetry}
            onStart={onStart}
            onPreviewModal={onPreview}
            onClone={onClone}
          />
        </div>
      </div>

      {/* Content Section */}
      <div className="p-4 space-y-3">
        {/* Template & ID */}
        <div className="space-y-1.5">
          <HardLink
            href={`templates/${ job.template }`}
            className="block text-sm font-semibold text-foreground hover:text-foreground/70 transition-colors truncate group/link"
          >
            {job.template}
            <span className="inline-block ml-1 opacity-0 group-hover/link:opacity-100 transition-opacity">→</span>
          </HardLink>

          <HardLink
            href={`templates/${ job.template }?id=${ job.id }`}
            className="block text-xs font-mono text-foreground/60 hover:text-foreground/80 transition-colors truncate group/link"
          >
            #{job.id.slice( 0, 8 )}
            <span className="inline-block ml-1 opacity-0 group-hover/link:opacity-100 transition-opacity">→</span>
          </HardLink>
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-2 text-xs text-foreground/50">
          <span className="truncate">
            {new Date( job.createdAt ).toLocaleDateString( undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit"
            } )}
          </span>
          {job.recordingDuration && (
            <>
              <span className="text-border">•</span>
              <span>{formatDuration( job.recordingDuration )}</span>
            </>
          )}
        </div>

        {/* Progress Bar */}
        {( job.status === "active" || job.status === "queued" || job.progress < 100 ) && (
          <div className="pt-1">
            <CompactProgressBar
              job={job}
              steps={job.status === 'active' ? getRecordingSteps(job) : []}
              startTime={startTime}
            />
          </div>
        )}
      </div>
    </div>
  );
}
