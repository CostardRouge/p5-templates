import {
  useEffect, useState, useRef
} from "react";
import useMultiRecordingStatusStream from "@/hooks/useMultiRecordingStatusStream";
import type {
  JobModel, JobStatusEnum
} from "@/types/recording.types";

export default function useRecordings() {
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
    isLoading,
    setIsLoading
  ] = useState<boolean>( true );

  const recordingStartTimesRef = useRef<Record<string, number>>( {
  } );

  // Track start times for active jobs
  inFlightJobs.forEach( job => {
    if ( job.status === "active" && !recordingStartTimesRef.current[ job.id ] ) {
      recordingStartTimesRef.current[ job.id ] = Date.now();
    }
  } );

  // Initial fetch
  useEffect(
    () => {
      setIsLoading( true );
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
        .catch( console.error )
        .finally( () => setIsLoading( false ) );
    },
    [
    ]
  );

  const {
    subscribe, unsubscribe
  } = useMultiRecordingStatusStream();

  // Subscribe to in-flight job updates
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
              status: data.status as JobStatusEnum,
              recordingDuration: data.recordingDuration ?? j.recordingDuration
            } : j ) );

          if ( [
            "completed",
            "failed",
            "cancelled"
          ].includes( data.status ) ) {
            setInFlightJobs( prev => prev.filter( j => j.id !== jobId ) );
            delete recordingStartTimesRef.current[ jobId ];

            fetch( `/api/recordings/${ jobId }` )
              .then( res => res.ok ? res.json() : Promise.reject( "Fetch error" ) )
              .then( ( updatedJob: JobModel ) => {
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
                const completedJob = inFlightJobs.find( j => j.id === jobId );

                if ( completedJob ) {
                  setStaticJobs( prev => [
                    {
                      ...completedJob,
                      progress: 100,
                      status: data.status as JobStatusEnum,
                      recordingDuration: data.recordingDuration ?? completedJob.recordingDuration
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

  // Poll for new in-flight jobs
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
      );

      return () => clearInterval( interval );
    },
    [
    ]
  );

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

  const addJob = ( job: JobModel ) => {
    if ( [
      "queued",
      "active"
    ].includes( job.status ) ) {
      setInFlightJobs( prev => [
        job,
        ...prev
      ] );
    } else {
      setStaticJobs( prev => [
        job,
        ...prev
      ] );
    }
  };

  return {
    staticJobs,
    inFlightJobs,
    allJobs: [
      ...inFlightJobs,
      ...staticJobs
    ],
    isLoading,
    recordingStartTimesRef,
    handleCancel,
    handleDelete,
    handleStart,
    handleRetry,
    addJob
  };
}
