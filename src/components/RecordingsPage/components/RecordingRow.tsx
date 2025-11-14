import HardLink from "@/components/HardLink";
import CompactProgressBar from "@/components/CompactProgressBar";
import { getRecordingSteps } from "@/utils/recordingSteps";
import RecordingThumbnail from "./RecordingThumbnail";
import StatusBadge from "./StatusBadge";
import ActionsMenu from "./ActionsMenu";
import { formatDuration } from "../utils/formatters";
import type { JobModel } from "@/types/recording.types";

interface RecordingRowProps {
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

export default function RecordingRow( {
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
}: RecordingRowProps ) {
  return (
    <tr className="group hover:bg-hover/50 transition-colors">
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelection}
          className="w-4 h-4 rounded border-border text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
          onClick={( e ) => e.stopPropagation()}
        />
      </td>
      <td className="px-4 py-3">
        <RecordingThumbnail
          job={job}
          onClick={() => {
            if ( job.status === "completed" && job.videoUrls ) {
              onPreview();
            }
          }}
          className={`w-20 h-20 rounded-xl border border-border object-cover transition-all duration-300 ${
            job.videoUrls ? "cursor-pointer group-hover:scale-105 group-hover:shadow-md" : "cursor-default"
          }`}
        />
      </td>

      <td className="px-4 py-3">
        <HardLink 
          href={`templates/${ job.template }?id=${ job.id }`}
          className="group/link inline-flex items-center gap-1.5 text-sm font-mono text-foreground hover:text-foreground/70 transition-colors"
        >
          #{job.id.slice( 0, 8 )}
          <span className="opacity-0 group-hover/link:opacity-100 transition-opacity text-xs">→</span>
        </HardLink>
      </td>

      <td className="px-4 py-3">
        <HardLink 
          href={`templates/${ job.template }`}
          className="group/link inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-foreground/70 transition-colors"
        >
          {job.template}
          <span className="opacity-0 group-hover/link:opacity-100 transition-opacity text-xs">→</span>
        </HardLink>
      </td>

      <td className="px-4 py-3">
        <div className="space-y-0.5">
          <div className="text-sm text-foreground">
            {new Date( job.createdAt ).toLocaleDateString( undefined, {
              month: "short",
              day: "numeric",
              year: "numeric"
            } )}
          </div>
          <div className="text-xs text-foreground/50">
            {new Date( job.createdAt ).toLocaleTimeString( undefined, {
              hour: "2-digit",
              minute: "2-digit"
            } )}
            {job.recordingDuration && ` • ${formatDuration( job.recordingDuration )}`}
          </div>
        </div>
      </td>

      <td className="px-4 py-3">
        <StatusBadge status={job.status} />
      </td>

      <td className="px-4 py-3">
        <div className="min-w-[200px]">
          <CompactProgressBar
            job={job}
            steps={job.status === 'active' ? getRecordingSteps(job) : []}
            startTime={startTime}
          />
        </div>
      </td>

      <td className="px-4 py-3 text-right">
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
