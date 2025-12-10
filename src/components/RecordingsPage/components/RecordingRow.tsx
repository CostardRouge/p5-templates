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

interface RecordingRowProps {
  job: JobModel;
  startTime?: number;
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

export default function RecordingRow( {
  job,
  startTime,
  isSelected,
  isNewlyAdded = false,
  onToggleSelection,
  onPreview,
  onCancel,
  onDelete,
  onRetry,
  onStart,
  onClone
}: RecordingRowProps ) {
  const slideCount = getSlideCount( job );

  return (
    <tr className={`group hover:bg-hover/50 transition-colors ${
      isNewlyAdded ? "animate-[slideInFromTop_0.5s_ease-out,highlightFade_1s_ease-out]" : ""
    }`}>
      <td className="px-2 py-2 sm:px-4 sm:py-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelection}
          className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded border-border text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
          onClick={( e ) => e.stopPropagation()}
        />
      </td>
      <td className="px-2 py-2 sm:px-4 sm:py-3">
        <RecordingThumbnail
          job={job}
          onClick={() => {
            if ( job.status === "completed" && job.videoUrls ) {
              onPreview();
            }
          }}
          className={`w-14 h-14 sm:w-20 sm:h-20 rounded-lg sm:rounded-xl border border-border object-cover ${
            job.videoUrls ? "cursor-pointer" : "cursor-default"
          }`}
          enableHoverPreview={true}
        />
      </td>

      <td className="px-2 py-2 sm:px-4 sm:py-3">
        <HardLink
          href={`templates/${ job.template }?id=${ job.id }`}
          className="group/link text-xs sm:text-sm text-foreground hover:text-foreground/70 transition-colors"
        >
          <div className="font-mono truncate">
            #{job.id.slice(
              0,
              8
            )}
            <span className="inline-block ml-1 opacity-0 group-hover/link:opacity-100 transition-opacity text-[10px] sm:text-xs">→</span>
          </div>
          {slideCount > 1 && (
            <div className="text-[10px] sm:text-xs text-foreground/50 font-sans mt-0.5">
              {slideCount} slides
            </div>
          )}
        </HardLink>
      </td>

      <td className="px-2 py-2 sm:px-4 sm:py-3">
        <HardLink
          href={`templates/${ job.template }`}
          className="group/link inline-flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm font-medium text-foreground hover:text-foreground/70 transition-colors"
        >
          {job.template}
          <span className="opacity-0 group-hover/link:opacity-100 transition-opacity text-[10px] sm:text-xs">→</span>
        </HardLink>
      </td>

      <td className="px-2 py-2 sm:px-4 sm:py-3">
        <div className="space-y-0.5">
          <div className="text-xs sm:text-sm text-foreground">
            {new Date( job.createdAt ).toLocaleDateString(
              undefined,
              {
                month: "short",
                day: "numeric",
                year: "numeric"
              }
            )}
          </div>
          <div className="text-[10px] sm:text-xs text-foreground/50">
            {new Date( job.createdAt ).toLocaleTimeString(
              undefined,
              {
                hour: "2-digit",
                minute: "2-digit"
              }
            )}
            {job.recordingDuration && ` • ${ formatDuration( job.recordingDuration ) }`}
          </div>
        </div>
      </td>

      <td className="px-2 py-2 sm:px-4 sm:py-3">
        <StatusBadge status={job.status} />
      </td>

      <td className="px-2 py-2 sm:px-4 sm:py-3">
        <div className="min-w-[120px] sm:min-w-[200px] max-w-xs">
          <CompactProgressBar
            job={job}
            steps={job.status === "active" ? getRecordingSteps( job ) : [
            ]}
            startTime={startTime}
          />
        </div>
      </td>

      <td className="px-2 py-2 sm:px-4 sm:py-3 text-right">
        <ActionsMenu
          job={job}
          onCancel={onCancel}
          onDelete={onDelete}
          onRetry={onRetry}
          onStart={onStart}
          onPreviewModal={onPreview}
          onClone={onClone}
        />
      </td>
    </tr>
  );
}
