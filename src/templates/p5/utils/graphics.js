import events from "./events.js";
import {
  getP5
} from "./sketch.js";

const graphics = {
  createAutoResizableGraphics(
    width, height, type, callback
  ) {
    const p = getP5();

    const _graphics = p.createGraphics(
      width,
      height,
      type
    );

    _graphics.canvas.remove();

    events.register(
      "engine-resized-canvas",
      (
        nw, nh
      ) => {
        _graphics.resizeCanvas(
          nw,
          nh
        );

        _graphics.width = nw;
        _graphics.height = nh;

        callback?.(
          nw,
          nh
        );
      }
    );

    return _graphics;
  }
};

export default graphics;
