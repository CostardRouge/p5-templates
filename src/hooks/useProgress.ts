import {
  useState, useCallback
} from "react";
import {
  ProgressStep
} from "@/components/ProgressBar";

export function useProgress( initialSteps: Omit<ProgressStep, "status">[] ) {
  const [
    steps,
    setSteps
  ] = useState<ProgressStep[]>( initialSteps.map( ( step ) => ( {
    ...step,
    status: "pending" as const,
  } ) ) );
  const [
    currentStepIndex,
    setCurrentStepIndex
  ] = useState( 0 );
  const [
    startTime
  ] = useState( Date.now() );

  const startStep = useCallback(
    ( stepId: string ) => {
      setSteps( ( prev ) =>
        prev.map( ( step ) =>
          step.id === stepId
            ? {
              ...step,
              status: "active" as const,
            }
            : step ) );
      const index = steps.findIndex( ( s ) => s.id === stepId );

      if ( index !== -1 ) setCurrentStepIndex( index );
    },
    [
      steps
    ]
  );

  const completeStep = useCallback(
    ( stepId: string ) => {
      setSteps( ( prev ) =>
        prev.map( ( step ) =>
          step.id === stepId
            ? {
              ...step,
              status: "completed" as const,
              percentage: 100,
            }
            : step ) );
    },
    [
    ]
  );

  const updateStepProgress = useCallback(
    (
      stepId: string, percentage: number
    ) => {
      setSteps( ( prev ) =>
        prev.map( ( step ) =>
          step.id === stepId
            ? {
              ...step,
              percentage,
            }
            : step ) );
    },
    [
    ]
  );

  const errorStep = useCallback(
    ( stepId: string ) => {
      setSteps( ( prev ) =>
        prev.map( ( step ) =>
          step.id === stepId
            ? {
              ...step,
              status: "error" as const,
            }
            : step ) );
    },
    [
    ]
  );

  const calculateOverallPercentage = useCallback(
    () => {
      const totalSteps = steps.length;

      if ( totalSteps === 0 ) return 0;

      const completedWeight = steps.filter( ( s ) => s.status === "completed" ).length;
      const activeStep = steps.find( ( s ) => s.status === "active" );
      const activeWeight = activeStep?.percentage
        ? activeStep.percentage / 100
        : 0;

      return Math.round( ( ( completedWeight + activeWeight ) / totalSteps ) * 100 );
    },
    [
      steps
    ]
  );

  const reset = useCallback(
    () => {
      setSteps( ( prev ) =>
        prev.map( ( step ) => ( {
          ...step,
          status: "pending" as const,
          percentage: 0,
        } ) ) );
      setCurrentStepIndex( 0 );
    },
    [
    ]
  );

  return {
    steps,
    currentStepIndex,
    startTime,
    overallPercentage: calculateOverallPercentage(),
    startStep,
    completeStep,
    updateStepProgress,
    errorStep,
    reset,
  };
}
