import React, {
  useState
} from "react";
import {
  checkBrowserRecordingSupport
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/CaptureActions/utils/checkBrowserRecordingSupport";

export default function useBrowserRecordingSupported() {
  const [
    isBrowserRecordingSupported,
    setIsBrowserRecordingSupported
  ] =
    useState<boolean>( false );

  React.useEffect(
    () => {
      setIsBrowserRecordingSupported( checkBrowserRecordingSupport() );
    },
    []
  );

  return isBrowserRecordingSupported;
}
