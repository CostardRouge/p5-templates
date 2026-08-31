import events from "./events.js";
import {
  getP5, getSurfaceOverride
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

    // An embedded sketch (a "sketch" content item) draws into a buffer of its
    // own, sized by the layer and not by the page. "Auto-resizable" would then
    // mean the wrong thing twice over: the handler below would resize this
    // buffer to the HOST canvas on the next page resize, and it would outlive
    // the embedded run — `events.registeredEvents` is only cleared between
    // sketches, so one would pile up per re-setup. There is nothing to
    // subscribe to either: any change to a layer's buffer size tears the
    // embedded instance down and re-runs its setup, which recreates this.
    if ( getSurfaceOverride() ) {
      return _graphics;
    }

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
