"use client";

import React, {
  useEffect, useState
} from "react";

import {
  Download, Grid, List, Menu as MenuIcon, RotateCcw, Trash2, X
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
import getP5SketchThumbnailURL from "@/utils/getP5SketchThumbnailURL";

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
      <div className="w-full bg-hover rounded-xl border border-theme h-2 overflow-hidden">
        <div
          className="h-2 bg-blue-500"
          style={{
            width: `${ progress }%`
          }} />
      </div>

      <div className="text-xs text-foreground mt-1">{progress}%</div>
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
    <Menu as="div" className="relative">
      <MenuButton>
        <MenuIcon className="h-4"/>
      </MenuButton>

      <MenuItems className="absolute right-0 w-48 border border-theme rounded-xl z-50 bg-background overflow-hidden">
        {job.status === "completed" &&
          <MenuItem>
            {( {
              focus
            } ) => (
              <button
                onClick={async() => await fetchDownload( `/api/recordings/download/${ job.id }` )}
                className={`${ focus ? "bg-hover" : "" } group flex w-full items-center gap-2 px-4 py-2 text-sm`}
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
              className={`${ focus ? "bg-hover" : "" } group flex w-full items-center gap-2 px-4 py-2 text-sm`}
            >
              <Download className="h-5" />
              <span>Download .json</span>
            </button>
          )}
        </MenuItem>

        <div className="my-1 h-px bg-border" />

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
                className={`${ focus ? "bg-hover" : "" } group flex w-full items-center gap-2 px-4 py-2 text-sm`}
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
                className={`${ focus ? "bg-hover" : "" } group flex w-full items-center gap-2 px-4 py-2 text-sm`}
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
                className={`${ focus ? "bg-hover" : "" } group flex w-full items-center gap-2 px-4 py-2 text-sm`}
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
    <div className="space-y-6 p-2 bg-hover/50">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Recordings</h1>

        <div className="flex flex-wrap items-center gap-1 text-xs">
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={( e ) => setSearch( e.target.value )}
            className="px-2 rounded-xl w-full sm:w-40 bg-background h-8 border border-theme border-b-2"
          />

          <select
            value={statusFilter}
            onChange={( e ) => setStatusFilter( e.target.value )}
            className="px-2 rounded-xl bg-background h-8 border border-theme border-b-2"
          >
            <option value="all">All Status</option>
            <option value="draft">Drafted</option>
            <option value="queued">Queued</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <div className="">
            <button
              onClick={() => setView( "cards" )}
              className={`rounded-l-xl border border-theme border-b-2 border-r-0 px-2 py-[6.5] h-full ${ view === "cards" ? "bg-hover" : "hover:bg-hover" }`}
            >
              <Grid className="w-4 h-4" />
            </button>

            <button
              onClick={() => setView( "table" )}
              className={`rounded-r-xl border border-theme border-b-2 border-l-0 px-2 py-[6.5] ${ view === "table" ? "bg-hover" : "hover:bg-hover" }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* <RecordingDashboard />*/}

      {/* Table View */}
      {view === "table" && (
        <div className="overflow-x-auto rounded-xl border border-theme border-b-2 bg-background">
          <table className="min-w-full">
            <thead className="bg-hover/30">
              <tr className="text-left text-xs text-foreground uppercase border-b ">
                <th className="font-medium p-1 w-14">Thumb</th>
                <th className="font-medium p-1 w-4">ID</th>
                <th className="font-medium p-1 w-4">Template</th>
                <th className="font-medium p-1 w-2">Date</th>
                <th className="font-medium p-1 w-6">Status</th>
                <th className="font-medium p-1 w-2">Progress</th>
                <th className="font-medium p-1 w-1 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-theme">
              {filtered.map( ( job ) => (
                <tr
                  key={job.id}
                  className="hover:bg-hover"
                  onDoubleClick={async() => await fetchDownload( `/api/download/${ job.id }` )}
                >
                  <td className="p-0 whitespace-nowrap sm:table-cell">
                    <img
                      src={getP5SketchThumbnailURL( job.template.replace(
                        "p5",
                        ""
                      ) )}
                      alt={job.template}
                      loading="lazy"
                      className="w-16 object-contain"
                    />
                  </td>

                  <td className="p-1 whitespace-nowrap text-sm">
                    <HardLink href={`templates/${ job.template }?id=${ job.id }`}>
                      {job.id.slice(
                        0,
                        8
                      )}
                      <span className="text-gray-400 ml-2">➔</span>
                    </HardLink>
                  </td>

                  <td className="p-1 whitespace-nowrap text-sm">
                    <HardLink href={`templates/${ job.template }`}>
                      {job.template}
                      <span className="text-gray-400 ml-2">➔</span>
                    </HardLink>
                  </td>

                  <td className="p-1 whitespace-nowrap text-sm text-foreground">
                    {new Date( job.createdAt ).toLocaleString()}
                  </td>

                  <td className="p-1 whitespace-nowrap text-sm">
                    <StatusBadge status={job.status} />
                  </td>

                  <td className="p-1 whitespace-nowrap">
                    <ProgressBar progress={job.progress} />
                  </td>

                  <td className="p-1 whitespace-nowrap text-sm text-right">
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
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-2">
          {filtered.map( ( job ) => (
            <div key={job.id} className="bg-background border border-theme rounded-xl transition relative overflow-hidden">
              <StatusBadge
                status={job.status}
                className="absolute top-2 left-2 rounded-xl"
              />

              <img
                src={getP5SketchThumbnailURL( job.template.replace(
                  "p5",
                  ""
                ) )}
                alt={job.template}
                loading="lazy"
                className="object-contain"
              />

              <div className="p-2 space-y-1">
                <HardLink
                  href={`templates/${ job.template }`}
                  className="block text-sm text-blue-600 hover:underline truncate"
                >
                  {job.template} →
                </HardLink>

                <div className="mb-1">
                  <HardLink
                    href={`templates/${ job.template }?id=${ job.id }`}
                    className="text-xs font-medium truncate"
                  >
                    {job.id.slice(
                      0,
                      8
                    )} →
                  </HardLink>
                </div>

                <div className="flex justify-between">
                  <div className="flex-grow">
                    <div className="text-xs text-label mb-2">
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
