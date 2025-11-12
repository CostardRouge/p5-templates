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
  Video,
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
    completed: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
    failed: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    cancelled: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
    active: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    queued: "bg-foreground/5 text-foreground/70 border-foreground/10",
    draft: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${ classes[ status ] || classes.queued } ${ className }`}>
      {status}
    </span>
  );
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

// Helper function to format duration
function formatDuration( ms: number | null ): string {
  if ( ms === null ) return "";
  const seconds = Math.floor( ms / 1000 );
  const minutes = Math.floor( seconds / 60 );
  const remainingSeconds = seconds % 60;
  
  if ( minutes > 0 ) {
    return `${ minutes }m ${ remainingSeconds }s`;
  }
  return `${ seconds }s`;
}

// Download menu items component
function DownloadMenuItems( {
  job
}: {
  job: JobModel
} ) {
  if ( job.status !== "completed" ) return null;

  // Get video sizes directly from job data
  const videoUrls = ( job.videoUrls as unknown as string[] ) || [];
  const videoSizes = ( job.videoSizes as unknown as number[] ) || [];

  // Calculate zip size from video sizes
  let zipSize: number | null = null;
  if ( videoSizes.length > 0 ) {
    const totalVideoSize = videoSizes.reduce( ( sum, size ) => sum + ( size || 0 ), 0 );
    // Add small overhead for zip structure (roughly 100 bytes per file + 1KB for headers)
    zipSize = totalVideoSize + ( videoSizes.length * 100 ) + 1024;
  }

  const videos = videoUrls.map( (
    url, index
  ) => ( {
    url,
    size: videoSizes[ index ] || null,
    index,
    key: url
  } ) );

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
    <div className="w-full space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-foreground/50">
          {isIndeterminate ? "Starting..." : "Progress"}
        </span>
        <span className="text-foreground font-semibold tabular-nums">
          {isIndeterminate ? "—" : `${ progress }%`}
        </span>
      </div>
      
      <div className="w-full bg-hover/50 rounded-full h-2 overflow-hidden">
        {isIndeterminate ? (
          <div className="h-full bg-gradient-to-r from-blue-500 via-blue-400 to-blue-500 animate-pulse w-full opacity-60" />
        ) : (
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-300 ease-out rounded-full"
            style={{
              width: `${ progress }%`
            }} />
        )}
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
      <div className="space-y-6 p-6">
        {/* Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Recordings</h1>
            <p className="text-sm text-foreground/60 mt-1">
              {filtered.length} {filtered.length === 1 ? "recording" : "recordings"}
              {statusFilter !== "all" && ` • ${statusFilter}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search recordings..."
                value={search}
                onChange={( e ) => setSearch( e.target.value )}
                className="pl-4 pr-4 py-2.5 rounded-xl w-full sm:w-56 bg-background border border-border hover:border-foreground/30 focus:border-foreground/50 focus:outline-none focus:ring-2 focus:ring-foreground/10 transition-all text-sm placeholder:text-foreground/40"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={( e ) => setStatusFilter( e.target.value )}
              className="px-4 py-2.5 rounded-xl bg-background border border-border hover:border-foreground/30 focus:border-foreground/50 focus:outline-none focus:ring-2 focus:ring-foreground/10 transition-all text-sm font-medium cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="queued">Queued</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            {/* View Toggle */}
            <div className="flex items-center bg-background border border-border rounded-xl overflow-hidden">
              <button
                onClick={() => setView( "cards" )}
                className={`px-3 py-2.5 transition-all duration-200 ${ 
                  view === "cards" 
                    ? "bg-hover text-foreground" 
                    : "text-foreground/60 hover:text-foreground hover:bg-hover/50" 
                }`}
                title="Card view"
              >
                <Grid className="w-4 h-4" />
              </button>

              <div className="w-px h-6 bg-border" />

              <button
                onClick={() => setView( "table" )}
                className={`px-3 py-2.5 transition-all duration-200 ${ 
                  view === "table" 
                    ? "bg-hover text-foreground" 
                    : "text-foreground/60 hover:text-foreground hover:bg-hover/50" 
                }`}
                title="Table view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Table View */}
        {view === "table" && (
          <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-border bg-hover/30">
                    <th className="text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider px-4 py-4">
                      Preview
                    </th>
                    <th className="text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider px-4 py-4">
                      ID
                    </th>
                    <th className="text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider px-4 py-4">
                      Template
                    </th>
                    <th className="text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider px-4 py-4">
                      Created
                    </th>
                    <th className="text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider px-4 py-4">
                      Status
                    </th>
                    <th className="text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider px-4 py-4">
                      Progress
                    </th>
                    <th className="text-right text-xs font-semibold text-foreground/70 uppercase tracking-wider px-4 py-4">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-border">
                  {filtered.map( ( job ) => (
                    <tr
                      key={job.id}
                      className="group hover:bg-hover/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <RecordingThumbnail
                          job={job}
                          onClick={() => {
                            // Only open preview if job has videoUrls (new recordings)
                            if ( job.status === "completed" && job.videoUrls ) {
                              setPreviewJobId( job.id );
                            }
                          }}
                          className={`w-20 h-20 rounded-xl border border-border object-cover transition-all duration-300 ${
                            job.videoUrls ? "cursor-pointer group-hover:scale-105 group-hover:shadow-md" : "cursor-default"
                          }`}
                        />
                      </td>

                      <td className="px-4 py-3">
                        <HardLink 
                          href={`templates/${ job.template }?id=${ job.id }`}
                          className="group/link inline-flex items-center gap-1.5 text-sm font-mono text-foreground hover:text-foreground/70 transition-colors"
                        >
                          #{job.id.slice( 0, 8 )}
                          <span className="opacity-0 group-hover/link:opacity-100 transition-opacity text-xs">→</span>
                        </HardLink>
                      </td>

                      <td className="px-4 py-3">
                        <HardLink 
                          href={`templates/${ job.template }`}
                          className="group/link inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-foreground/70 transition-colors"
                        >
                          {job.template}
                          <span className="opacity-0 group-hover/link:opacity-100 transition-opacity text-xs">→</span>
                        </HardLink>
                      </td>

                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          <div className="text-sm text-foreground">
                            {new Date( job.createdAt ).toLocaleDateString( undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric"
                            } )}
                          </div>
                          <div className="text-xs text-foreground/50">
                            {new Date( job.createdAt ).toLocaleTimeString( undefined, {
                              hour: "2-digit",
                              minute: "2-digit"
                            } )}
                            {job.recordingDuration && ` • ${formatDuration( job.recordingDuration )}`}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <StatusBadge status={job.status} />
                      </td>

                      <td className="px-4 py-3">
                        <div className="min-w-[120px]">
                          <ProgressBar progress={job.progress} status={job.status} />
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right">
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
            
            {/* Empty State */}
            {filtered.length === 0 && (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-hover/50 mb-4">
                  <Video className="w-8 h-8 text-foreground/40" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1">No recordings found</h3>
                <p className="text-sm text-foreground/60">
                  {search || statusFilter !== "all" 
                    ? "Try adjusting your filters" 
                    : "Create your first recording to get started"}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Card View */}
        {view === "cards" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {filtered.map( ( job ) => (
              <div 
                key={job.id} 
                className="group bg-background border border-border hover:border-foreground/20 rounded-2xl transition-all duration-300 hover:shadow-lg hover:shadow-foreground/5 hover:-translate-y-0.5 relative overflow-hidden"
              >
                {/* Thumbnail Section */}
                <div className="relative overflow-hidden">
                  <RecordingThumbnail
                    job={job}
                    onClick={() => {
                      // Only open preview if job has videoUrls (new recordings)
                      if ( job.status === "completed" && job.videoUrls ) {
                        setPreviewJobId( job.id );
                      }
                    }}
                    className={`w-full aspect-video object-cover transition-all duration-300 ${
                      job.videoUrls ? "cursor-pointer group-hover:scale-105" : "cursor-default"
                    }`}
                  />
                  
                  {/* Status Badge Overlay */}
                  <div className="absolute top-3 left-3">
                    <StatusBadge
                      status={job.status}
                      className="shadow-lg backdrop-blur-sm"
                    />
                  </div>

                  {/* Actions Menu Overlay */}
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <div className="bg-background/90 backdrop-blur-sm rounded-lg border border-border shadow-lg">
                      <ActionsMenu
                        job={job}
                        onCancel={handleCancel}
                        onDelete={handleDelete}
                        onRetry={handleRetry}
                        onStart={handleStart}
                        onForceCancel={handleCancel}
                        onPreviewModal={() => setPreviewJobId( job.id )}
                      />
                    </div>
                  </div>
                </div>

                {/* Content Section */}
                <div className="p-4 space-y-3">
                  {/* Template & ID */}
                  <div className="space-y-1.5">
                    <HardLink
                      href={`templates/${ job.template }`}
                      className="block text-sm font-semibold text-foreground hover:text-foreground/70 transition-colors truncate group/link"
                    >
                      {job.template}
                      <span className="inline-block ml-1 opacity-0 group-hover/link:opacity-100 transition-opacity">→</span>
                    </HardLink>

                    <HardLink
                      href={`templates/${ job.template }?id=${ job.id }`}
                      className="block text-xs font-mono text-foreground/60 hover:text-foreground/80 transition-colors truncate group/link"
                    >
                      #{job.id.slice( 0, 8 )}
                      <span className="inline-block ml-1 opacity-0 group-hover/link:opacity-100 transition-opacity">→</span>
                    </HardLink>
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center gap-2 text-xs text-foreground/50">
                    <span className="truncate">
                      {new Date( job.createdAt ).toLocaleDateString( undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      } )}
                    </span>
                    {job.recordingDuration && (
                      <>
                        <span className="text-border">•</span>
                        <span>{formatDuration( job.recordingDuration )}</span>
                      </>
                    )}
                  </div>

                  {/* Progress Bar */}
                  {( job.status === "active" || job.status === "queued" || job.progress < 100 ) && (
                    <div className="pt-1">
                      <ProgressBar progress={job.progress} status={job.status} />
                    </div>
                  )}
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
