type Progress = {
 step: string; pct: number
};

const TTL = 5 * 60 * 1000; // keep entries 5 min after finish/error

/* singleton Map<jobId, Progress & { ts: number }> */
const jobs = new Map<
    string,
    Progress & {
 ts: number; done?: boolean
}
>();

/* ------- helpers ------- */
export function setProgress( id: string, step: string, pct: number ) {
  jobs.set(
    id,
    {
      step,
      pct,
      ts: Date.now(),
      done: step === "done" || step === "error"
    }
  );
}

export function getProgress( id: string ): Progress | undefined {
  const job = jobs.get( id );

  return job && {
    step: job.step,
    pct: job.pct
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
      if ( entry.done && now - entry.ts > TTL ) jobs.delete( id );
    }
  },
  60_000
); // run every minute