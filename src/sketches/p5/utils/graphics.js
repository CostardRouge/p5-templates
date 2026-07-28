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
        // p5 v2: width/height are getters backed by the renderer, which
        // resizeCanvas already updates — assigning them now throws.
        _graphics.resizeCanvas(
          nw,
          nh
        );

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
