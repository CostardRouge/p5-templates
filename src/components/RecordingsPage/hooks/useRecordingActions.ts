import { useState } from "react";
import type { JobModel } from "@/types/recording.types";

export default function useRecordingActions() {
  const [
    isActionInProgress,
    setIsActionInProgress
  ] = useState(false);

  const handleClone = async (job: JobModel): Promise<JobModel | null> => {
    setIsActionInProgress(true);
    try {
      const response = await fetch(`/api/recordings/${job.id}/clone`, {
        method: "POST"
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
        }));
        throw new Error(errorData.error || "Failed to clone recording");
      }

      const result = await response.json();

      if (result.success && result.jobId) {
        const jobResponse = await fetch(`/api/recordings/${result.jobId}`);
        if (jobResponse.ok) {
          const newJob: JobModel = await jobResponse.json();
          return newJob;
        }
      }

      alert("Could not clone recording");
      return null;
    } catch (error) {
      console.error("Clone error:", error);
      alert("Failed to clone recording. Please try again.");
      return null;
    } finally {
      setIsActionInProgress(false);
    }
  };

  return {
    handleClone,
    isActionInProgress
  };
}
