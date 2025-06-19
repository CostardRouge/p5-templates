"use client";

import {
  useState, useEffect
} from "react";
import {
  useRecordingQueue
} from "@/lib/hooks/useRecordingQueue";
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
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Recording Queue Dashboard</h2>

        {health && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded">
              <h3 className="text-sm font-medium text-blue-800">Waiting</h3>
              <p className="text-2xl font-bold text-blue-900">{health.waiting}</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded">
              <h3 className="text-sm font-medium text-yellow-800">Active</h3>
              <p className="text-2xl font-bold text-yellow-900">{health.active}</p>
            </div>
            <div className="bg-green-50 p-4 rounded">
              <h3 className="text-sm font-medium text-green-800">Completed</h3>
              <p className="text-2xl font-bold text-green-900">{health.completed}</p>
            </div>
            <div className="bg-red-50 p-4 rounded">
              <h3 className="text-sm font-medium text-red-800">Failed</h3>
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
            Pause Queue
          </button>
          <button
            onClick={handleResumeQueue}
            disabled={isLoading}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            Resume Queue
          </button>
        </div>
      </div>
    </div>
  );
}