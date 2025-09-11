"use client";

import React, {
  useState, useEffect
} from "react";

import {
  Grid, List, MoreVertical, Download, Trash2, RotateCcw, X, Clapperboard
} from "lucide-react";

import {
  Menu, MenuButton, MenuItem, MenuItems
} from "@headlessui/react";

import HardLink from "@/components/HardLink";
import fetchDownload from "@/components/utils/fetchDownload";

import useMultiRecordingStatusStream from "@/hooks/useMultiRecordingStatusStream";
import {
  JobModel, JobStatusEnum
} from "@/types/recording.types";

function getThumbnailURL( template: string ) {
  return `/assets/scripts/p5-sketches/sketches/${ template.replaceAll(
    "p5/",
    ""
  ) }/thumbnail.jpeg`;
}

// Badge component
function StatusBadge( {
  status, className
}: {
 status: JobModel["status"],
  className?: string
} ) {
  const classes: Record<string, string> = {
    completed: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    cancelled: "bg-yellow-100 text-yellow-800",
    active: "bg-blue-100 text-blue-800",
    queued: "bg-gray-100 text-gray-800",
  };

  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ classes[ status ] || classes.queued } ${ className }`}>{status}</span>;
}

// Progress bar component
function ProgressBar( {
  progress
}: {
 progress: number
} ) {
  return (
    <div className="w-full">
      <div className="w-full bg-gray-200 rounded h-2 overflow-hidden">
        <div
          className="h-2 bg-blue-500"
          style={{
            width: `${ progress }%`
          }} />
      </div>

      <div className="text-xs text-gray-500 mt-1">{progress}%</div>
    </div>
  );
}

// Actions dropdown
function ActionsMenu( {
  job,
  onCancel,
  onDelete,
  onRetry,
  onStart
}: {
  job: JobModel;
  onCancel?: ( job: JobModel ) => void;
  onDelete?: ( job: JobModel ) => void;
  onStart?: ( job: JobModel ) => void;
  onRetry?: () => void;
} ) {
  return (
    <Menu as="div" className=" inline-block text-left">
      <MenuButton className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full inline-flex items-center">
        <MoreVertical />
      </MenuButton>

      <MenuItems className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
        {job.status === "completed" &&
          <MenuItem>
            {( {
              focus
            } ) => (
              <button
                onClick={async() => await fetchDownload( `/api/recordings/download/${ job.id }` )}
                className={`${ focus ? "bg-gray-100 dark:bg-gray-700" : "" } group flex w-full items-center gap-2 px-4 py-2 text-sm`}
              >
                <Download className="h-5" />
                Download
              </button>
            )}
          </MenuItem>
        }

        {/* {job.status === "draft" &&*/}
        {/*  <MenuItem>*/}
        {/*    {( {*/}
        {/*      focus*/}
        {/*    } ) => (*/}
        {/*      <button*/}
        {/*        onClick={async() => await fetchDownload( `/api/recordings/download/${ job.id }` )}*/}
        {/*        className={`${ focus ? "bg-gray-100 dark:bg-gray-700" : "" } group flex w-full items-center gap-2 px-4 py-2 text-sm`}*/}
        {/*      >*/}
        {/*        <Clapperboard className="h-5" />*/}
        {/*        Start recording*/}
        {/*      </button>*/}
        {/*    )}*/}
        {/*  </MenuItem>*/}
        {/* }*/}

        <MenuItem>
          {( {
            focus
          } ) => (
            <button
              onClick={async() => await fetchDownload( `/api/options/download/${ job.id }` )}
              className={`${ focus ? "bg-gray-100 dark:bg-gray-700" : "" } group flex w-full items-center gap-2 px-4 py-2 text-sm`}
            >
              <Download className="h-5" />
              <span>Download .json</span>
            </button>
          )}
        </MenuItem>

        <div className="my-1 h-px bg-white/5"/>

        {![
          "completed",
          "cancelled",
          "draft",
          "failed",
          "active",
        ].includes( job.status ) && (
          <MenuItem>
            {( {
              focus
            } ) => (
              <button
                onClick={async() => {
                  try {
                    const response = await fetch(
                      "/api/recordings/cancel",
                      {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json"
                        },
                        body: JSON.stringify( {
                          ids: [
                            job.id
                          ]
                        } ),
                      }
                    );

                    if ( !response.ok ) {
                      throw new Error( "Cancel failed" );
                    }

                    const {
                      cancelled
                    } = await response.json();

                    if ( cancelled.includes( job.id ) ) {
                      return onCancel?.( job );
                    }

                    alert( `could not cancel job: ${ job.id }` );
                  } catch ( error ) {
                    console.error(
                      "Cancel failed:",
                      error
                    );
                  }
                }}
                className={`${ focus ? "bg-gray-100 dark:bg-gray-700" : "" } group flex w-full items-center gap-2 px-4 py-2 text-sm`}
              >
                <X className="h-5" />
                Cancel
              </button>
            )}
          </MenuItem>
        )}

        {[
          "cancelled",
          "failed",
        ].includes( job.status ) && (
          <MenuItem>
            {( {
              focus
            } ) => (
              <button
                onClick={async() => {
                  try {
                    const response = await fetch(
                      "/api/recordings/retry",
                      {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json"
                        },
                        body: JSON.stringify( {
                          ids: [
                            job.id
                          ]
                        } ),
                      }
                    );

                    if ( !response.ok ) {
                      throw new Error( "Retry failed" );
                    }

                    const {
                      retried
                    } = await response.json();

                    if ( retried.includes( job.id ) ) {
                      return onRetry?.();
                    }

                    alert( `could not retry job: ${ job.id }` );
                  } catch ( error ) {
                    console.error(
                      "Retry failed:",
                      error
                    );
                  }
                }}
                className={`${ focus ? "bg-gray-100 dark:bg-gray-700" : "" } group flex w-full items-center gap-2 px-4 py-2 text-sm`}
              >
                <RotateCcw className="h-5" />
                Retry
              </button>
            )}
          </MenuItem>
        )}

        {[
          "completed",
          "cancelled",
          "draft",
          "failed",
        ].includes( job.status ) && (
          <MenuItem>
            {( {
              focus
            } ) => (
              <button
                onClick={async() => {
                  try {
                    const response = await fetch(
                      "/api/recordings/delete",
                      {
                        method: "DELETE",
                        headers: {
                          "Content-Type": "application/json"
                        },
                        body: JSON.stringify( {
                          ids: [
                            job.id
                          ]
                        } ),
                      }
                    );

                    if ( !response.ok ) {
                      throw new Error( "Delete failed" );
                    }

                    const {
                      deleted
                    } = await response.json();

                    if ( deleted.includes( job.id ) ) {
                      return onDelete?.( job );
                    }

                    alert( `could not delete job: ${ job.id }` );
                  } catch ( error ) {
                    console.error(
                      "Delete failed:",
                      error
                    );
                  }
                }}
                className={`${ focus ? "bg-gray-100 dark:bg-gray-700" : "" } group flex w-full items-center gap-2 px-4 py-2 text-sm`}
              >
                <Trash2 />
                Delete
              </button>
            )}
          </MenuItem>
        )}
      </MenuItems>
    </Menu>
  );
}

export default function RecordingsPage() {
  const [
    staticJobs,
    setStaticJobs
  ] = useState<JobModel[]>( [
  ] );
  const [
    inFlightJobs,
    setInFlightJobs
  ] = useState<JobModel[]>( [
  ] );

  const [
    view,
    setView
  ] = useState<"table" | "cards">( "table" );
  const [
    search,
    setSearch
  ] = useState<string>( "" );
  const [
    statusFilter,
    setStatusFilter
  ] = useState<string>( "all" );

  // fetch jobs
  useEffect(
    () => {
      fetch( "/api/recordings" )
        .then( ( res ) => res.ok ? res.json() : Promise.reject( "Fetch error" ) )
        .then( ( data: JobModel[] ) => {
          const staticJobs = data.filter( j => [
            "draft",
            "completed",
            "failed",
            "cancelled"
          ].includes( j.status ) );
          const inFlightJobs = data.filter( j => [
            "queued",
            "active"
          ].includes( j.status ) );

          setStaticJobs( staticJobs );
          setInFlightJobs( inFlightJobs );
        } )
        .catch( console.error );
    },
    [
    ]
  );

  const {
    subscribe, unsubscribe
  } = useMultiRecordingStatusStream();

  useEffect(
    () => {
      if ( inFlightJobs.length === 0 ) return;

      const jobIds = inFlightJobs.map( j => j.id );

      subscribe(
        jobIds,
        ( {
          jobId, data
        } ) => {
          setInFlightJobs( ( prev ) =>
            prev.map( j => j.id === jobId ? {
              ...j,
              progress: data.percentage,
              status: data.status as JobStatusEnum
            } : j ) );

          // If job is completed/failed/cancelled, move it to static
          if ( [
            "completed",
            "failed",
            "cancelled"
          ].includes( data.status ) ) {
            setInFlightJobs( prev => prev.filter( j => j.id !== jobId ) );

            const completedJob = inFlightJobs.find( j => j.id === jobId );

            if ( completedJob ) {
              // TODO: fetch the job individually

              setStaticJobs( prev => [
                ...prev,
                {
                  ...completedJob,
                  progress: 100, // data.percentage,
                  status: data.status as JobStatusEnum
                }
              ] );
            }

            unsubscribe( jobId );
          }
        }
      );

      return () => {
        jobIds.forEach( unsubscribe );
      };
    },
    [
      inFlightJobs,
      subscribe,
      unsubscribe
    ]
  );

  useEffect(
    () => {
      const interval = setInterval(
        async() => {
          try {
            const res = await fetch( "/api/recordings?status=queued,active" );

            if ( !res.ok ) throw new Error( "Polling failed" );

            const newLiveJobs: JobModel[] = await res.json();

            setInFlightJobs( ( prev ) => {
              const prevIds = new Set( prev.map( j => j.id ) );
              const merged = [
                ...prev
              ];

              for ( const job of newLiveJobs ) {
                if ( !prevIds.has( job.id ) ) {
                  merged.push( job );
                }
              }

              return merged;
            } );
          } catch ( err ) {
            console.warn(
              "Polling error:",
              err
            );
          }
        },
        5000
      ); // 5 seconds

      return () => clearInterval( interval );
    },
    [
    ]
  );

  // filter/search
  const allJobs = [
    ...inFlightJobs,
    ...staticJobs,
  ];

  const filtered = allJobs.filter( ( job ) => {
    const matchSearch = job.id.includes( search ) || job.template.includes( search );
    const matchStatus = statusFilter === "all" || job.status === statusFilter;

    return matchSearch && matchStatus;
  } );

  const handleCancel = ( job: JobModel ) => {
    setInFlightJobs( ( prev ) => prev.filter( ( j ) => j.id !== job.id ) );
    setStaticJobs( ( prev ) => [
      ...prev,
      {
        ...job,
        status: "cancelled",
        progress: 100
      },
    ] );
  };

  const handleDelete = ( job: JobModel ) => {
    setInFlightJobs( prev => prev.filter( j => j.id !== job.id ) );
    setStaticJobs( prev => prev.filter( j => j.id !== job.id ) );
  };

  const handleRetry = () => {

  };

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Recordings</h1>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={( e ) => setSearch( e.target.value )}
            className="px-3 rounded w-full sm:w-48 bg-gray-50 dark:bg-gray-800 h-9"
          />

          <select
            value={statusFilter}
            onChange={( e ) => setStatusFilter( e.target.value )}
            className="px-2 rounded bg-gray-50 dark:bg-gray-800 h-9"
          >
            <option value="all">All Status</option>
            <option value="draft">Drafted</option>
            <option value="queued">Queued</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <button
            onClick={() => setView( "cards" )}
            className={`p-2 rounded ${ view === "cards" ? "bg-gray-200 dark:bg-gray-700" : "hover:bg-gray-100 dark:hover:bg-gray-600" }`}
          >
            <Grid className="w-5 h-5"/>
          </button>

          <button
            onClick={() => setView( "table" )}
            className={`p-2 rounded ${ view === "table" ? "bg-gray-200 dark:bg-gray-700" : "hover:bg-gray-100 dark:hover:bg-gray-600" }`}
          >
            <List className="w-5 h-5"/>
          </button>
        </div>
      </div>

      {/* <RecordingDashboard />*/}

      {/* Table View */}
      {view === "table" && (
        <div className="overflow-x-auto rounded border border-gray-700 dark:bg-gray-800">
          <table className="min-w-full">
            <thead className="bg-gray-300 dark:bg-gray-200">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Thumb</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Template</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-700">
              {filtered.map( ( job ) => (
                <tr
                  key={job.id}
                  className="hover:bg-gray-700"
                  onDoubleClick={async() => await fetchDownload( `/api/download/${ job.id }` )}
                >
                  <td className="px-4 py-2 whitespace-nowrap hidden sm:table-cell">
                    <img
                      src={getThumbnailURL( job.template )}
                      alt={job.template}
                      loading="lazy"
                      className="w-12 h-15 object-contain"
                    />
                  </td>

                  <td className="px-4 py-2 whitespace-nowrap text-sm">
                    <HardLink href={`templates/${ job.template }?id=${ job.id }`}>
                      {job.id.slice(
                        0,
                        8
                      )}
                      <span className="text-gray-500 dark:text-gray-400 ml-2">➔</span>
                    </HardLink>
                  </td>

                  <td className="px-4 py-2 whitespace-nowrap text-sm">
                    <HardLink href={`templates/${ job.template }`}>
                      {job.template}
                      <span className="text-gray-500 dark:text-gray-400 ml-2">➔</span>
                    </HardLink>
                  </td>

                  <td className="px-4 py-2 whitespace-nowrap text-sm text-white">
                    {new Date( job.createdAt ).toLocaleString()}
                  </td>

                  <td className="px-2 py-1 whitespace-nowrap text-sm">
                    <StatusBadge status={job.status} />
                  </td>

                  <td className="px-4 py-2 whitespace-nowrap">
                    <ProgressBar progress={job.progress} />
                  </td>

                  <td className="px-4 py-2 whitespace-nowrap text-sm">
                    <ActionsMenu
                      job={job}
                      onCancel={handleCancel}
                      onDelete={handleDelete}
                      onRetry={handleRetry}
                      onStart={handleRetry}
                    />
                  </td>
                </tr>
              ) )}
            </tbody>
          </table>
        </div>
      )}

      {/* Card View */}
      {view === "cards" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map( ( job ) => (
            <div key={job.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow hover:shadow-md transition relative">
              <StatusBadge
                status={job.status}
                className="absolute top-2 left-2 rounded-sm"
              />

              <img
                src={getThumbnailURL( job.template )}
                alt={job.template}
                loading="lazy"
                className="object-contain w-full rounded-t-lg"
              />

              <div className="p-4 space-y-1">
                <HardLink
                  href={`templates/${ job.template }`}
                  className="block text-center text-xs text-blue-600 hover:underline truncate mb-4"
                >
                  {job.template} →
                </HardLink>

                <div className="mb-1">
                  <HardLink
                    href={`templates/${ job.template }?id=${ job.id }`}
                    className="text-sm font-medium truncate"
                  >
                    {job.id.slice(
                      0,
                      8
                    )} →
                  </HardLink>
                </div>

                <div className="flex justify-between">
                  <div className="flex-grow">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      { new Date( job.createdAt ).toLocaleString() }
                    </div>

                    <ProgressBar progress={ job.progress } />
                  </div>

                  <div className="self-center">
                    <ActionsMenu
                      job={job}
                      onCancel={handleCancel}
                      onDelete={handleDelete}
                      onRetry={handleRetry}
                    />
                  </div>
                </div>

              </div>
            </div>
          ) )}
        </div>
      )}
    </div>
  );
}
