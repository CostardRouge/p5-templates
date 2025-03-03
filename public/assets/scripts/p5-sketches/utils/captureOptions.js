function getCaptureOptions() {
  const urlParams = new URLSearchParams(window.location.search);
  const base64 = urlParams.get("captureOptions");

  if (!base64) {
    return {};
  }

  return JSON.parse(atob(base64))
}

export default getCaptureOptions();
