"use client";

import {
  useEffect, useState, useCallback
} from "react";

type Job = {
  id: string;
  template: string;
  status: string;
  progress: number;
  resultUrl: string | null;
};

/**
 * Badge that represents job status with corresponding styles.
 */
function StatusBadge( {
  status
}: {
 status: Job["status"]
} ) {
  const statusClasses: Record<string, string> = {
    completed: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    cancelled: "bg-yellow-100 text-yellow-800",
    active: "bg-blue-100 text-blue-800",
    queued: "bg-gray-100 text-gray-800",
  };

  return (
    <span
      className={`px-2 inline-flex text-xs font-semibold leading-5 rounded-full ${
        statusClasses[ status ] || statusClasses.queued
      }`}
    >
      {status}
    </span>
  );
}

/**
 * Visual progress bar and percentage text.
 */
function ProgressBar( {
  progress
}: {
 progress: number
} ) {
  return (
    <div className="w-40">
      <div className="w-full bg-gray-200 rounded h-2">
        <div
          className="h-2 bg-blue-500 rounded"
          style={{
            width: `${ progress }%`
          }}
        />
      </div>
      <div className="text-xs text-gray-500 mt-1">{progress}%</div>
    </div>
  );
}

/**
 * Action buttons for each job row: Cancel, Retry, Download.
 */
function JobActions( {
  job, onCancel, onRetry
}: {
  job: Job, onCancel: ( id: Job["id"] ) => void, onRetry: ( id: Job["id"] ) => void
} ) {
  return (
    <div className="space-x-2">
      {/* {( job.status === "queued" || job.status === "active" ) && (*/}
      <button
        onClick={() => onCancel( job.id )}
        className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs"
      >
        Cancel
      </button>
      {/* )}*/}
      {job.status === "failed" && (
        <button
          onClick={() => onRetry( job.id )}
          className="px-2 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-xs"
        >
          Retry
        </button>
      )}
      {job.resultUrl && (
        <a
          href={`/api/download/${ job.id }`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
        >
          Download
        </a>
      )}
    </div>
  );
}

/**
 * Single row representing a job.
 */
function JobRow( {
  job, onCancel, onRetry
}:{
  job: Job, onCancel: ( id: Job["id"] ) => void, onRetry: ( id: Job["id"] ) => void
} ) {
  return (
    <tr>
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
        <StatusBadge status={job.status} />
      </td>
      <td className="px-4 py-2 whitespace-nowrap">
        <ProgressBar progress={job.progress} />
      </td>
      <td className="px-4 py-2 whitespace-nowrap text-sm">
        <JobActions job={job} onCancel={onCancel} onRetry={onRetry} />
      </td>
    </tr>
  );
}

/**
 * Main page displaying list of recording jobs.
 */
export default function JobsPage() {
  const [
    jobs,
    setJobs
  ] = useState<Job[]>( ( [
  ] ) );

  // Fetch jobs once on mount
  useEffect(
    () => {
      async function loadJobs() {
        try {
          const response = await fetch( "/api/jobs" );

          if ( !response.ok ) throw new Error( "Failed to fetch jobs" );
          const data = /** @type {Job[]} */ ( await response.json() );

          setJobs( data );
        } catch ( error ) {
          console.error( error );
        }
      }

      loadJobs();
    },
    [
    ]
  );

  const handleCancel = useCallback(
    async( jobId: Job["id"] ) => {
      try {
        const response = await fetch(
          `/api/jobs/${ jobId }`,
          {
            method: "DELETE"
          }
        );

        if ( response.ok ) {
          setJobs( prev =>
            prev.map( job =>
              job.id === jobId
                ? {
                  ...job,
                  status: "cancelled",
                  progress: 100
                }
                : job ) );
        }
      } catch ( error ) {
        console.error( error );
      }
    },
    [
    ]
  );

  const handleRetry = useCallback(
    async( jobId: Job["id"] ) => {
      try {
        const response = await fetch(
          `/api/jobs/${ jobId }?cmd=retry`,
          {
            method: "POST"
          }
        );

        if ( response.ok ) {
          await response.json();
          setJobs( prev =>
            prev.map( job =>
              job.id === jobId
                ? {
                  ...job,
                  status: "queued",
                  progress: 0
                }
                : job ) );
        }
      } catch ( error ) {
        console.error( error );
      }
    },
    [
    ]
  );

  return (
    <>
      <h1 className="text-2xl font-semibold mb-4">Recordings</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {[
                "Job",
                "Template",
                "Status",
                "Progress",
                "Actions"
              ].map( header => (
                <th
                  key={header}
                  className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                >
                  {header}
                </th>
              ) )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {jobs.map( job => (
              <JobRow
                key={job.id}
                job={job}
                onCancel={handleCancel}
                onRetry={handleRetry}
              />
            ) )}
          </tbody>
        </table>
      </div>
    </>
  );
}
