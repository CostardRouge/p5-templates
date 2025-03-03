import { sketch } from './index.js';

const time = {
  elapsed: 0,
  lastUpdate: 0,
  seconds: function () {
    return time.milliSeconds() / 1000;
  },
  milliSeconds: function () {
    return time.elapsed;
  },
  every: function (second, callback) {
    return sketch?.engine?.getFrameCount() % second === 0 && callback();
  },
  reset() {
    time.elapsed = 0;
  },
  incrementElapsedTime() {
    const now = sketch?.engine?.getElapsedTime();

    if (typeof now === 'number') {
      const delta = now - time.lastUpdate;

      time.elapsed += delta;
      time.lastUpdate = now; // Update last frame time
    }
  },
};

export default time;
