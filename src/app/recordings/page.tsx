"use client";

import React, {
  useEffect, useState
} from "react";

import {
  AlertTriangle,
  Clapperboard,
  Download,
  Eye,
  FileArchive,
  Grid,
  Link,
  List,
  Menu as MenuIcon,
  RotateCcw,
  Trash2,
  X
} from "lucide-react";

import {
  Menu, MenuButton, MenuItem, MenuItems
} from "@headlessui/react";

import HardLink from "@/components/HardLink";
import fetchDownload from "@/components/utils/fetchDownload";
import VideoPreviewModal from "@/components/VideoPreviewModal";

import useMultiRecordingStatusStream from "@/hooks/useMultiRecordingStatusStream";
import {
  JobModel, JobStatusEnum
} from "@/types/recording.types";
import clsx from "clsx";

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

// Helper function to format file size
function formatFileSize( bytes: number | null ): string {
  if ( bytes === null ) return "";
  if ( bytes === 0 ) return "0 B";
  const k = 1024;
  const sizes = [
    "B",
    "KB",
    "MB",
    "GB"
  ];
  const i = Math.floor( Math.log( bytes ) / Math.log( k ) );

  return `${ parseFloat( ( bytes / Math.pow(
    k,
    i
  ) ).toFixed( 1 ) ) } ${ sizes[ i ] }`;
}

// Download menu items component
function DownloadMenuItems( {
  job
}: {
  job: JobModel
} ) {
  const [
    mediaData,
    setMediaData
  ] = useState<{
    videos: Array<{
      url: string;
      size: number | null;
      index: number;
      key: string;
    }>;
    zipSize: number | null;
  } | null>( null );
  const [
    loading,
    setLoading
  ] = useState( true );

  useEffect(
    () => {
      if ( job.status !== "completed" ) {
        setLoading( false );
        return;
      }

      const fetchMediaData = async() => {
        try {
          const response = await fetch( `/api/recordings/${ job.id }/media` );

          if ( response.ok ) {
            const data = await response.json();

            setMediaData( data );
          }
        } catch ( error ) {
          console.error(
            "Failed to fetch media data:",
            error
          );
        } finally {
          setLoading( false );
        }
      };

      fetchMediaData();
    },
    [
      job.id,
      job.status
    ]
  );

  if ( job.status !== "completed" ) return null;
  if ( loading ) {
    return (
      <MenuItem>
        {( {
          focus
        } ) => (
          <div className={`${ focus ? "bg-hover" : "" } px-4 py-2 text-sm text-gray-400`}>
            Loading...
          </div>
        )}
      </MenuItem>
    );
  }

  const videos = mediaData?.videos || [
  ];
  const zipSize = mediaData?.zipSize;

  return (
    <>
      {videos.length > 1 && videos.map( (
        video, idx
      ) => (
        <MenuItem key={video.index}>
          {( {
            focus
          } ) => (
            <button
              onClick={async() => await fetchDownload( `/api/recordings/download/${ job.id }/slide/${ video.index }` )}
              className={`${ focus ? "bg-hover" : "" } group flex w-full items-center gap-2 px-4 py-2 text-sm`}
            >
              <Download className="h-5" />
              <span>
                Download slide { video.index + 1 }
                {video.size && (
                  <span className="text-xs text-gray-400 ml-1">({ formatFileSize( video.size ) })</span>
                )}
              </span>
            </button>
          )}
        </MenuItem>
      ) )}

      {videos.length === 1 && (
        <MenuItem>
          {( {
            focus
          } ) => (
            <button
              onClick={async() => await fetchDownload( `/api/recordings/download/${ job.id }/slide/0` )}
              className={`${ focus ? "bg-hover" : "" } group flex w-full items-center gap-2 px-4 py-2 text-sm`}
            >
              <Download className="h-5" />
              <span>
                Download
                {videos[ 0 ].size && (
                  <span className="text-xs text-gray-400 ml-1">({ formatFileSize( videos[ 0 ].size ) })</span>
                )}
              </span>
            </button>
          )}
        </MenuItem>
      )}

      {videos.length > 1 && (
        <>
          <div className="my-1 h-px bg-border" />
          <MenuItem>
            {( {
              focus
            } ) => (
              <button
                onClick={async() => await fetchDownload( `/api/recordings/download/${ job.id }/zip` )}
                className={`${ focus ? "bg-hover" : "" } group flex w-full items-center gap-2 px-4 py-2 text-sm`}
              >
                <FileArchive className="h-5" />
                <span>
                  Download all (.zip)
                  {zipSize && (
                    <span className="text-xs text-gray-400 ml-1">({ formatFileSize( zipSize ) })</span>
                  )}
                </span>
              </button>
            )}
          </MenuItem>
        </>
      )}
    </>
  );
}

// Progress bar component
function ProgressBar( {
  progress,
  status
}: {
 progress: number,
  status?: JobModel["status"]
} ) {
  // Show indeterminate state for active/queued jobs with 0 progress
  const isIndeterminate = ( status === "active" || status === "queued" ) && progress === 0;

  return (
    <div className="w-full">
      <div className="w-full bg-hover rounded-xl h-2 overflow-hidden">
        {isIndeterminate ? (
          <div className="h-2 bg-blue-500 animate-pulse w-full opacity-50" />
        ) : (
          <div
            className="h-2 bg-blue-500"
            style={{
              width: `${ progress }%`
            }} />
        )}
      </div>

      <div className="text-xs text-foreground mt-1">
        {isIndeterminate ? "Starting..." : `${ progress }%`}
      </div>
    </div>
  );
}

// Actions dropdown
function ActionsMenu( {
  job,
  onCancel,
  onDelete,
  onRetry,
  onStart,
  onPreviewModal,
  onForceCancel
}: {
  job: JobModel;
  onCancel?: ( job: JobModel ) => void;
  onDelete?: ( job: JobModel ) => void;
  onStart?: ( job: JobModel ) => void;
  onRetry?: ( job: JobModel ) => void;
  onPreviewModal?: ( ) => void;
  onForceCancel?: ( job: JobModel ) => void;
} ) {
  // Check if job is stale (active/queued for more than 1 hour)
  const isStale = [
    "active",
    "queued"
  ].includes( job.status ) &&
    ( Date.now() - new Date( job.updatedAt ).getTime() ) > 60 * 60 * 1000;

  return (
    <Menu as="div" className="relative">
      <MenuButton>
        <MenuIcon className="h-4"/>
      </MenuButton>

      <MenuItems className="absolute right-0 w-64 border border-theme rounded-xl z-50 bg-background overflow-hidden">
        {( job.status === "completed" && job.videoUrls ) && (
          <>
            <MenuItem>
              {( {
                focus
              } ) => (
                <button
                  onClick={onPreviewModal}
                  className={`${ focus ? "bg-hover" : "" } group flex w-full items-center gap-2 px-4 py-2 text-sm`}
                >
                  <Eye className="h-5" />
                  Open preview modal
                </button>
              )}
            </MenuItem>

            <div className="my-1 h-px bg-border" />
          </>
        )}

        <MenuItem>
          {( {
            focus
          } ) => (
            <HardLink
              href={`templates/${ job.template }?id=${ job.id }`}
              className={`${ focus ? "bg-hover" : "" } group flex w-full items-center gap-2 px-4 py-2 text-sm`}
            >
              <Link className="h-5" />
              <span>Open recording&nbsp;
                <u>{
                  job.id.slice(
                    0,
                    8
                  )}
                </u>
              </span>
            </HardLink>
          )}
        </MenuItem>

        <MenuItem>
          {( {
            focus
          } ) => (
            <HardLink
              href={`templates/${ job.template }`}
              className={`${ focus ? "bg-hover" : "" } grup overflow-hidden flex w-full items-start justify-around gap-2 px-4 py-2 text-sm`}
            >
              <Link className="h-5 flex-1" />
              <span className="text-ellipsis flex-1">Open template&nbsp;
                <u>{job.template}</u>
              </span>
            </HardLink>
          )}
        </MenuItem>

        <div className="my-1 h-px bg-border" />

        <DownloadMenuItems job={job} />

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

        {job.status === "draft" && (
          <MenuItem>
            {( {
              focus
            } ) => (
              <button
                onClick={async() => {
                  try {
                    const res = await fetch(
                      `/api/recordings/${ job.id }/start`,
                      {
                        method: "POST"
                      }
                    );

                    if ( !res.ok ) throw new Error( "Start failed" );
                    const {
                      started
                    } = await res.json();

                    if ( started ) onStart?.( job );
                  } catch ( error ) {
                    console.error(
                      "Start failed:",
                      error
                    );
                  }
                }}
                className={`${ focus ? "bg-hover" : "" } group flex w-full items-center gap-2 px-4 py-2 text-sm`}
              >
                <Clapperboard className="h-5" />
                Start recording
              </button>
            )}
          </MenuItem>
        )}

        {/* Divider: only show if there are actions below */}
        {( job.status === "queued" || [
          "cancelled",
          "failed",
          "completed",
          "draft"
        ].includes( job.status ) ) && (
          <div className="my-1 h-px bg-border" />
        )}

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
                      `/api/recordings/${ job.id }/cancel`,
                      {
                        method: "POST"
                      }
                    );

                    if ( !response.ok ) throw new Error( "Cancel failed" );

                    const {
                      cancelled
                    } = await response.json();

                    if ( cancelled ) return onCancel?.( job );

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

        {isStale && (
          <MenuItem>
            {( {
              focus
            } ) => (
              <button
                onClick={async() => {
                  if ( !confirm( `Force cancel stale job ${ job.id.slice(
                    0,
                    8
                  ) }? This will mark it as cancelled.` ) ) {
                    return;
                  }
                  try {
                    const response = await fetch(
                      `/api/recordings/${ job.id }/force-cancel`,
                      {
                        method: "POST"
                      }
                    );

                    if ( !response.ok ) throw new Error( "Force cancel failed" );

                    const {
                      cancelled
                    } = await response.json();

                    if ( cancelled ) return onForceCancel?.( job );

                    alert( `could not force cancel job: ${ job.id }` );
                  } catch ( error ) {
                    console.error(
                      "Force cancel failed:",
                      error
                    );
                  }
                }}
                className={`${ focus ? "bg-hover" : "" } group flex w-full items-center gap-2 px-4 py-2 text-sm text-orange-600`}
              >
                <AlertTriangle className="h-5" />
                Force Cancel (Stale)
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
                      `/api/recordings/${ job.id }/retry`,
                      {
                        method: "POST"
                      }
                    );

                    if ( !response.ok ) throw new Error( "Retry failed" );

                    const {
                      retried
                    } = await response.json();

                    if ( retried ) return onRetry?.( job );

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
                      `/api/recordings/${ job.id }`,
                      {
                        method: "DELETE"
                      }
                    );

                    if ( !response.ok ) throw new Error( "Delete failed" );

                    const {
                      deleted
                    } = await response.json();

                    if ( deleted ) return onDelete?.( job );

                    alert( `could not delete job: ${ job.id }` );
                  } catch ( error ) {
                    console.error(
                      "Delete failed:",
                      error
                    );
                  }
                }}
                className={`${ focus ? "bg-hover" : "" } group flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600`}
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
  const [
    previewJobId,
    setPreviewJobId
  ] = useState<string | null>( null );

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

            // Fetch the complete job data from the server to get thumbnails and videoUrls
            fetch( `/api/recordings/${ jobId }` )
              .then( res => res.ok ? res.json() : Promise.reject( "Fetch error" ) )
              .then( ( updatedJob: JobModel ) => {
                // Insert at the beginning to maintain newest-first order
                setStaticJobs( prev => [
                  updatedJob,
                  ...prev
                ] );
              } )
              .catch( err => {
                console.error(
                  "Failed to fetch updated job:",
                  err
                );
                // Fallback to using the data we have
                const completedJob = inFlightJobs.find( j => j.id === jobId );

                if ( completedJob ) {
                  setStaticJobs( prev => [
                    {
                      ...completedJob,
                      progress: 100,
                      status: data.status as JobStatusEnum
                    },
                    ...prev
                  ] );
                }
              } );

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
      {
        ...job,
        status: "cancelled",
        progress: 100
      },
      ...prev,
    ] );
  };

  const handleDelete = ( job: JobModel ) => {
    setInFlightJobs( prev => prev.filter( j => j.id !== job.id ) );
    setStaticJobs( prev => prev.filter( j => j.id !== job.id ) );
  };

  const handleStart = ( job: JobModel ) => {
    // Move draft job into in-flight as queued
    setStaticJobs( ( prev ) => prev.filter( j => j.id !== job.id ) );
    setInFlightJobs( ( prev ) => [
      {
        ...job,
        status: "queued",
        progress: 0,
      },
      ...prev,
    ] );
  };

  const handleRetry = ( job: JobModel ) => {
    // Move cancelled/failed job back to in-flight as queued
    setStaticJobs( ( prev ) => prev.filter( j => j.id !== job.id ) );
    setInFlightJobs( ( prev ) => [
      {
        ...job,
        status: "queued",
        progress: 0,
      },
      ...prev,
    ] );
  };

  return (
    <div>
      <div className="space-y-6 p-2">
        {/* Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Recordings ({filtered.length})</h1>

          <div className="flex flex-wrap items-center gap-1 text-xs">
            <input
              type="text"
              placeholder="Search…"
              value={search}
              onChange={( e ) => setSearch( e.target.value )}
              className="px-2 rounded-xl w-full sm:w-40 bg-background h-8 border border-theme "
            />

            <select
              value={statusFilter}
              onChange={( e ) => setStatusFilter( e.target.value )}
              className="px-2 rounded-xl bg-background h-8 border border-theme "
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
                className={`rounded-l-xl border border-theme  border-r-0 px-2 py-[6.5] h-full ${ view === "cards" ? "bg-hover" : "hover:bg-hover" }`}
              >
                <Grid className="w-4 h-4" />
              </button>

              <button
                onClick={() => setView( "table" )}
                className={`rounded-r-xl border border-theme  border-l-0 px-2 py-[6.5] ${ view === "table" ? "bg-hover" : "hover:bg-hover" }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* <RecordingDashboard />*/}

        {/* Table View */}
        {view === "table" && (
          <div className="overflow-x-auto rounded-xl border border-theme  bg-background">
            <table className="min-w-full">
              <thead className="bg-hover/70">
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
                  >
                    <td className="p-0 whitespace-nowrap sm:table-cell">
                      <RecordingThumbnail
                        job={job}
                        onClick={() => {
                        // Only open preview if job has videoUrls (new recordings)
                          if ( job.status === "completed" && job.videoUrls ) {
                            setPreviewJobId( job.id );
                          }
                        }}
                        className={`w-16 h-16 object-cover transition ${
                          job.videoUrls ? "cursor-pointer hover:opacity-80" : "cursor-default"
                        }`}
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
                      <ProgressBar progress={job.progress} status={job.status} />
                    </td>

                    <td className="p-1 whitespace-nowrap text-sm text-right">
                      <ActionsMenu
                        job={job}
                        onCancel={handleCancel}
                        onDelete={handleDelete}
                        onRetry={handleRetry}
                        onStart={handleStart}
                        onForceCancel={handleCancel}
                        onPreviewModal={() => setPreviewJobId( job.id )}
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

                <RecordingThumbnail
                  job={job}
                  onClick={() => {
                  // Only open preview if job has videoUrls (new recordings)
                    if ( job.status === "completed" && job.videoUrls ) {
                      setPreviewJobId( job.id );
                    }
                  }}
                  className={`w-full aspect-square object-cover transition ${
                    job.videoUrls ? "cursor-pointer hover:opacity-80" : "cursor-default"
                  }`}
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

                      <ProgressBar progress={ job.progress } status={job.status} />
                    </div>

                    <div className="self-center">
                      <ActionsMenu
                        job={job}
                        onCancel={handleCancel}
                        onDelete={handleDelete}
                        onRetry={handleRetry}
                        onStart={handleStart}
                        onForceCancel={handleCancel}
                      />
                    </div>
                  </div>

                </div>
              </div>
            ) )}
          </div>
        )}
      </div>

      {/* Video Preview Modal */}
      {previewJobId && (
        <VideoPreviewModal
          jobId={previewJobId}
          isOpen={!!previewJobId}
          onClose={() => setPreviewJobId( null )}
        />
      )}
    </div>
  );
}

// Thumbnail component that displays recording thumbnail via redirect route
function RecordingThumbnail( {
  job,
  onClick,
  className
}: {
  job: JobModel;
  onClick?: () => void;
  className?: string;
} ) {
  // Use the thumbnail redirect route - it handles all the logic server-side
  const src = `/api/recordings/${ job.id }/thumbnail`;
  
  // Show Eye icon for completed recordings with videoUrls (new recordings)
  const showEyeIcon = job.status === "completed" && job.videoUrls && job.thumbnails;

  return (
    <div
      onClick={onClick}
      className={clsx(
        className,
        "relative overflow-hidden",
        {
          grayscale: job.status !== "completed",
          "animate-pulse": job.status === "active"
        }
      )}
    >
      { showEyeIcon && (
        <Eye
          className="w-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-foreground bg-background rounded-lg py-1 px-1 border border-theme"
        />
      ) }
      <img
        src={src}
        alt={job.template}
        loading="lazy"
      />
    </div>
  );
}
