function getCaptureOptions() {
  const urlParams = new URLSearchParams(window.location.search);
  const base64 = urlParams.get("captureOptions");

  if (!base64) {
    return {};
  }

  return JSON.parse(atob(base64))
}

const captureOptions = Object.assign( {
  "size": {
    "width": 1080,
    "height": 1920
  },
  "animation": {
    "framerate": 60,
    "duration": 6
  },
  "texts": {
    "top": "top",
    "bottom": "bottom"
  },
  "colors": {
    "text": [0,0,0],
    "accent": [128,128,255],
    "background": [230, 230, 230],
  },
  "assets": [
    "/assets/images/samples/_00001.jpeg",
    "/assets/images/samples/_00002.jpeg",
    "/assets/images/samples/_00003.jpeg",
    "/assets/images/samples/_00004.jpeg",
    "/assets/images/samples/_00005.jpeg",
  ],
  // "lines": true,
  "durationBar": true
}, getCaptureOptions());

console.log({
  captureOptions
});

export default captureOptions;
