/**
 * Check if browser supports MediaRecorder for browser recording
 */
export function checkBrowserRecordingSupport(): boolean {
  // Check if MediaRecorder is available, canvas.captureStream is supported, and WebM/VP8/VP9 is supported
  const hasMediaRecorder = typeof MediaRecorder !== "undefined";
  const hasCaptureStream =
    typeof HTMLCanvasElement !== "undefined" &&
    "captureStream" in HTMLCanvasElement.prototype;

  // Check if any WebM codec is supported (VP8, VP9, or H264 in WebM container)
  const webmCodecs = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm;codecs=h264",
    "video/webm",
  ];

  const hasWebMSupport =
    hasMediaRecorder &&
    webmCodecs.some((codec) => {
      try {
        return MediaRecorder.isTypeSupported(codec);
      } catch {
        return false;
      }
    });

  // Check if device is iOS (iPhone, iPad, iPod)
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Mac") && navigator.maxTouchPoints > 1);

  return hasMediaRecorder && hasCaptureStream && hasWebMSupport && !isIOS;
}
