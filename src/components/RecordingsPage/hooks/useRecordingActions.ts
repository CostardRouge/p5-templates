import { useState } from "react";
import type { JobModel } from "@/types/recording.types";

export default function useRecordingActions() {
  const [
    isActionInProgress,
    setIsActionInProgress
  ] = useState( false );

  const handleClone = async( job: JobModel ): Promise<JobModel | null> => {
    setIsActionInProgress( true );
    try {
      const optionsResponse = await fetch( `/api/options/download/${ job.id }` );
      if ( !optionsResponse.ok ) throw new Error( "Failed to fetch options" );
      
      const options = await optionsResponse.json();

      const formData = new FormData();
      formData.append( "status", "draft" );
      formData.append( "template", job.template );
      formData.append( "options", JSON.stringify( options ) );

      const response = await fetch( "/api/recordings/enqueue", {
        method: "POST",
        body: formData
      } );

      if ( !response.ok ) throw new Error( "Failed to clone recording" );

      const result = await response.json();

      if ( result.success && result.jobId ) {
        const jobResponse = await fetch( `/api/recordings/${ result.jobId }` );
        if ( jobResponse.ok ) {
          const newJob: JobModel = await jobResponse.json();
          return newJob;
        }
      }
      
      alert( "Could not clone recording" );
      return null;
    } catch ( error ) {
      console.error( "Clone error:", error );
      alert( "Failed to clone recording. Please try again." );
      return null;
    } finally {
      setIsActionInProgress( false );
    }
  };

  return {
    handleClone,
    isActionInProgress
  };
}
