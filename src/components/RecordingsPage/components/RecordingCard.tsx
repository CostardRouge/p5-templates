import HardLink from "@/components/HardLink";
import CompactProgressBar from "@/components/CompactProgressBar";
import {
  getRecordingSteps
} from "@/utils/recordingSteps";
import {
  getSlideCount
} from "@/utils/getSlideCount";
import RecordingThumbnail from "./RecordingThumbnail";
import StatusBadge from "./StatusBadge";
import ActionsMenu from "./ActionsMenu";
import {
  formatDuration
} from "../utils/formatters";
import type {
  JobModel
} from "@/types/recording.types";
import type {
  JobProgression
} from "../hooks/useRecordings";

interface RecordingCardProps {
  job: JobModel;
  startTime?: number;
  progression?: JobProgression;
  isSelected: boolean;
  isNewlyAdded?: boolean;
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
  progression,
  isSelected,
  isNewlyAdded = false,
  onToggleSelection,
  onPreview,
  onCancel,
  onDelete,
  onRetry,
  onStart,
  onClone
}: RecordingCardProps ) {
  const slideCount = getSlideCount( job );
  const slideOptions = ( job.options as any )?.slides ?? undefined;

  return (
    <div
      className={ `group bg-background border border-border hover:border-foreground/20 rounded-xl sm:rounded-2xl transition-all duration-300 hover:shadow-lg hover:shadow-foreground/5 hover:-translate-y-0.5 relative overflow-hidden ${
        isNewlyAdded
          ? "animate-[slideInFromTop_0.5s_ease-out,highlightFade_1s_ease-out]"
          : ""
      }` }
    >
      {/* Thumbnail Section */}
      <div className="relative overflow-hidden rounded-t-xl sm:rounded-t-2xl">
        {/* Checkbox Overlay */}
        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-20">
          <input
            type="checkbox"
            checked={ isSelected }
            onChange={ onToggleSelection }
            className="w-5 h-5 rounded border-2 border-white shadow-lg text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer bg-white/90 backdrop-blur-sm"
            onClick={ ( e ) => e.stopPropagation() }
          />
        </div>
        <RecordingThumbnail
          job={ job }
          onClick={ () => {
            if ( job.status === "completed" && job.videoUrls ) {
              onPreview();
            }
          } }
          className={ `w-full aspect-square object-cover ${
            job.videoUrls ? "cursor-pointer" : "cursor-default"
          }` }
          showEyeInCorner={ true }
          enableHoverPreview={ true }
        />

        {/* Status Badge Overlay */}
        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-40">
          <StatusBadge
            status={ job.status }
            className="shadow-lg backdrop-blur-sm"
          />
        </div>

        {/* Actions Menu Overlay */}
        <div className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 z-40">
          <ActionsMenu
            job={ job }
            onCancel={ onCancel }
            onDelete={ onDelete }
            onRetry={ onRetry }
            onStart={ onStart }
            onPreviewModal={ onPreview }
            onClone={ onClone }
          />
        </div>
      </div>

      {/* Content Section */}
      <div className="p-2 sm:p-4 space-y-2 sm:space-y-3">
        {/* Template & ID */}
        <div className="space-y-1 sm:space-y-1.5">
          <HardLink
            href={ `/${ job.template }` }
            className="block text-xs sm:text-sm font-semibold text-foreground hover:text-foreground/70 transition-colors truncate group/link"
          >
            {job.template}
            <span className="inline-block ml-1 opacity-0 group-hover/link:opacity-100 transition-opacity">
              →
            </span>
          </HardLink>

          <HardLink
            href={ `/${ job.template }?id=${ job.id }` }
            className="block text-[10px] sm:text-xs font-mono text-foreground/60 hover:text-foreground/80 transition-colors group/link"
          >
            <span className="truncate">
              #{job.id.slice(
                0,
                8
              )}
              {slideCount > 1 && (
                <>
                  <span className="text-border mx-1">·</span>
                  <span className="font-sans">{slideCount} slides</span>
                </>
              )}
            </span>
            <span className="inline-block ml-1 opacity-0 group-hover/link:opacity-100 transition-opacity">
              →
            </span>
          </HardLink>
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-foreground/50">
          <span className="truncate">
            {new Date( job.createdAt ).toLocaleDateString(
              undefined,
              {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
              }
            )}
          </span>
          {job.recordingDuration && (
            <>
              <span className="text-border">·</span>
              <span>{formatDuration( job.recordingDuration )}</span>
            </>
          )}
        </div>

        {/* Progress Bar */}
        {( job.status === "active" ||
          job.status === "queued" ||
          job.progress < 100 ) && (
          <div className="pt-0.5 sm:pt-1 min-w-0">
            <CompactProgressBar
              job={ job }
              steps={ job.status === "active" ? getRecordingSteps( job ) : [] }
              recordingSteps={ progression?.steps }
              currentSlideIndex={ progression?.currentSlideIndex }
              slideOptions={ slideOptions }
              startTime={ startTime }
            />
          </div>
        )}
      </div>
    </div>
  );
}
