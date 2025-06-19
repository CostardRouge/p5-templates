"use client";

import {
  useEffect, useState, useCallback
} from "react";
import HardLink from "@/components/HardLink";
import {
  RecordingDashboard
} from "@/components/recording-dashboard";

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
 * Single row representing a job.
 */
function JobRow( {
  job
}:{
  job: Job
} ) {
  return (
    <tr>
      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
        <HardLink
          href={`/templates/${ job.template }?id=${ job.id }`}
        >
          {job.id.slice(
            0,
            8
          )}
        </HardLink>
      </td>
      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
        <HardLink
          href={`/templates/${ job.template }`}
        >
          {job.template}
        </HardLink>
      </td>
      <td className="px-4 py-2 whitespace-nowrap text-sm">
        <StatusBadge status={job.status} />
      </td>
      <td className="px-4 py-2 whitespace-nowrap">
        <ProgressBar progress={job.progress} />
      </td>
      <td className="px-4 py-2 whitespace-nowrap text-sm">
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

  return (
    <>
      <h1 className="text-2xl font-semibold mb-4">Recordings</h1>

      <RecordingDashboard />

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
              />
            ) )}
          </tbody>
        </table>
      </div>
    </>
  );
}
