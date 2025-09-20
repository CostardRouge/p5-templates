"use client";

import {
  useState, useEffect
} from "react";
import {
  useRecordingQueue
} from "@/hooks/useRecordingQueue";
import {
  QueueHealthResponse
} from "@/types/recording.types";

export function RecordingDashboard() {
  const {
    getQueueHealth, controlQueue, isLoading, error
  } = useRecordingQueue();
  const [
    health,
    setHealth
  ] = useState<QueueHealthResponse | null>( null );
  const [
    refreshInterval,
    setRefreshInterval
  ] = useState<NodeJS.Timeout | null>( null );

  useEffect(
    () => {
      const fetchHealth = async() => {
        const healthData = await getQueueHealth();

        if ( healthData ) {
          setHealth( healthData );
        }
      };

      fetchHealth();

      // Set up auto-refresh every 5 seconds
      const interval = setInterval(
        fetchHealth,
        5000
      );

      setRefreshInterval( interval );

      return () => {
        if ( interval ) {
          clearInterval( interval );
        }
      };
    },
    [
      getQueueHealth
    ]
  );

  const handlePauseQueue = async() => {
    await controlQueue( "pause" );
  };

  const handleResumeQueue = async() => {
    await controlQueue( "resume" );
  };

  if ( error ) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-red-800 font-semibold">Error</h3>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 p-6 rounded-lg shadow">

        {health && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-500 p-4 rounded">
              <h3 className="text-sm font-medium text-blue-100">Waiting</h3>
              <p className="text-2xl font-bold text-blue-600">{health.waiting}</p>
            </div>

            <div className="bg-yellow-500 p-4 rounded">
              <h3 className="text-sm font-medium text-yellow-100">Active</h3>
              <p className="text-2xl font-bold text-yellow-600">{health.active}</p>
            </div>

            <div className="p-4 rounded bg-green-700">
              <h3 className="text-sm font-medium text-green-100">Completed</h3>
              <p className="text-2xl font-bold text-green-900">{health.completed}</p>
            </div>

            <div className="bg-red-700 p-4 rounded">
              <h3 className="text-sm font-medium text-red-100">Failed</h3>
              <p className="text-2xl font-bold text-red-900">{health.failed}</p>
            </div>
          </div>
        )}

        <div className="mt-6 flex gap-4">
          <button
            onClick={handlePauseQueue}
            disabled={isLoading}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50"
          >
            Pause
          </button>
          <button
            onClick={handleResumeQueue}
            disabled={isLoading}
            className="px-4 py-2 bg-green-700 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            Resume
          </button>
        </div>
      </div>
    </div>
  );
}