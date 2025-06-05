import { updateJob } from './jobsDB';

type Progress = {
  step: string;
  percentage: number
};

const TTL = 15 * 60 * 1000; // keep entries 15min after finish/error

export const jobs = new Map<
    string,
    Progress & {
      timestamp: number;
      done?: boolean
    }
>();

/* ------- helpers ------- */
export function setProgress(
  id: string, step: string, percentage: number
) {
  jobs.set(
    id,
    {
      step,
      percentage,
      timestamp: Date.now(),
      done: step === "done" || step === "error"
    }
  );
  updateJob(id, { step, progress: percentage });
}

export function getProgress( id: string ): Progress | undefined {
  const job = jobs.get( id );

  return job && {
    step: job.step,
    percentage: job.percentage
  };
}

export function hasJob( id: string ) {
  return jobs.has( id );
}

/* optional: periodically prune old finished jobs */
setInterval(
  () => {
    const now = Date.now();

    for ( const [
      id,
      entry
    ] of jobs ) {
      if ( entry.done && now - entry.timestamp > TTL ) jobs.delete( id );
    }
  },
  60_000
);