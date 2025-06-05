'use client';
import { useEffect, useState } from 'react';

interface Job {
  id: string;
  status: string;
  progress: number;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    const fetchJobs = () => {
      fetch('/api/jobs')
        .then(res => res.json())
        .then(setJobs);
    };
    fetchJobs();
    const interval = setInterval(fetchJobs, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const sources: Record<string, EventSource> = {};
    jobs.forEach(job => {
      if (job.status === 'active' && !sources[job.id]) {
        const source = new EventSource(`/api/record-progress?id=${job.id}`);
        source.onmessage = e => {
          const p = JSON.parse(e.data);
          setJobs(cur => cur.map(j => j.id === job.id ? { ...j, progress: p.percentage } : j));
        };
        sources[job.id] = source;
      }
    });
    return () => {
      Object.values(sources).forEach(s => s.close());
    };
  }, [jobs]);

  const action = async(id: string, act: string) => {
    await fetch(`/api/jobs/${id}/${act}`, { method: 'POST' });
  };
  const download = async(id: string) => {
    const r = await fetch(`/api/jobs/${id}/download`);
    const { url } = await r.json();
    window.open(url, '_blank');
  };

  return (
    <div className="p-4">
      <h1 className="text-xl mb-4">Jobs</h1>
      <table className="min-w-full text-sm">
        <thead>
          <tr>
            <th className="p-2 text-left">Id</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-left">Progress</th>
            <th className="p-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map(job => (
            <tr key={job.id} className="border-b">
              <td className="p-2">{job.id}</td>
              <td className="p-2">{job.status}</td>
              <td className="p-2">{Math.round(job.progress || 0)}%</td>
              <td className="p-2 flex gap-2">
                <button onClick={() => action(job.id,'cancel')} className="underline">Cancel</button>
                <button onClick={() => action(job.id,'stop')} className="underline">Stop</button>
                <button onClick={() => action(job.id,'retry')} className="underline">Retry</button>
                <button onClick={() => download(job.id)} className="underline">Download</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
