import type {
  JobModel
} from "@/types/recording.types";

interface StatusBadgeProps {
  status: JobModel["status"];
  className?: string;
}

export default function StatusBadge( {
  status, className = ""
}: StatusBadgeProps ) {
  const classes: Record<string, string> = {
    completed: "bg-green-500/70 text-green-800 border-green-500/20",
    failed: "bg-red-500/50 text-red-600 dark:text-red-400 border-red-500/20",
    cancelled: "bg-yellow-500/50 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
    active: "bg-blue-500/50 text-blue-700 dark:text-blue-400 border-blue-500/20",
    queued: "bg-foreground/5 text-foreground/70 border-foreground/10",
    draft: "bg-purple-500/50 text-purple-700 dark:text-purple-400 border-purple-500/20",
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${ classes[ status ] || classes.queued } ${ className }`}>
      {status}
    </span>
  );
}
