"use client";

import {
  useEffect, useState
} from "react";

type Job = {
  id: string;
  template: string;
  status: string;
  progress: number;
  resultUrl: string | null;
};

export default function JobsPage() {
  const [
    jobs,
    setJobs
  ] = useState<Job[]>( [
  ] );

  // Fetch initial list of jobs
  useEffect(
    () => {
      async function fetchJobs() {
        try {
          const res = await fetch( "/api/jobs" );

          if ( !res.ok ) throw new Error( "Failed to fetch jobs" );
          const data: Job[] = await res.json();

          setJobs( data );
        } catch ( err ) {
          console.error( err );
        }
      }
      fetchJobs();
    },
    [
    ]
  );

  // Subscribe to SSE for live progress updates
  useEffect(
    () => {
      const eventSource = new EventSource( "/api/jobs/events" );

      eventSource.onmessage = ( event ) => {
        try {
          const {
            jobId, progress
          } = JSON.parse( event.data );

          setJobs( ( prev ) =>
            prev.map( ( job ) =>
              job.id === jobId ? {
                ...job,
                progress: Math.floor( progress )
              } : job ) );
        } catch {
        // ignore malformed messages
        }
      };
      return () => {
        eventSource.close();
      };
    },
    [
    ]
  );

  // Handler: Cancel a job
  async function handleCancel( jobId: string ) {
    try {
      const res = await fetch(
        `/api/jobs/${ jobId }`,
        {
          method: "DELETE",
        }
      );

      if ( res.ok ) {
        setJobs( ( prev ) =>
          prev.map( ( job ) =>
            job.id === jobId
              ? {
                ...job,
                status: "cancelled",
                progress: 100
              }
              : job ) );
      }
    } catch ( err ) {
      console.error( err );
    }
  }

  // Handler: Retry a job
  async function handleRetry( jobId: string ) {
    try {
      const res = await fetch(
        `/api/jobs/${ jobId }?cmd=retry`,
        {
          method: "POST",
        }
      );

      if ( res.ok ) {
        setJobs( ( prev ) =>
          prev.map( ( job ) =>
            job.id === jobId
              ? {
                ...job,
                status: "queued",
                progress: 0
              }
              : job ) );
      }
    } catch ( err ) {
      console.error( err );
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Recording Jobs</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Job
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Template
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Progress
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {jobs.map( ( job ) => (
              <tr key={job.id}>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                  {job.id.slice(
                    0,
                    8
                  )}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                  {job.template}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm">
                  <span
                    className={`px-2 inline-flex text-xs font-semibold leading-5 rounded-full ${
                      job.status === "completed"
                        ? "bg-green-100 text-green-800"
                        : job.status === "failed"
                          ? "bg-red-100 text-red-800"
                          : job.status === "cancelled"
                            ? "bg-yellow-100 text-yellow-800"
                            : job.status === "active"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {job.status}
                  </span>
                </td>
                <td className="px-4 py-2 whitespace-nowrap w-40">
                  <div className="w-full bg-gray-200 rounded h-2">
                    <div
                      className="h-2 bg-blue-500 rounded"
                      style={{
                        width: `${ job.progress }%`
                      }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {job.progress}%
                  </div>
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm space-x-2">
                  {( job.status === "queued" || job.status === "active" ) && (
                    <button
                      onClick={() => handleCancel( job.id )}
                      className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs"
                    >
                      Cancel
                    </button>
                  )}
                  {job.status === "failed" && (
                    <button
                      onClick={() => handleRetry( job.id )}
                      className="px-2 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-xs"
                    >
                      Retry
                    </button>
                  )}
                  {job.resultUrl && (
                    <a
                      href={job.resultUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                    >
                      Download
                    </a>
                  )}
                </td>
              </tr>
            ) )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
