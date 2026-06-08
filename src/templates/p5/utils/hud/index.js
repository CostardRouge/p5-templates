import events from "../events.js";
import {
  getP5
} from "../sketch.js";
import probes from "./probes.js";
import drawHud from "./drawHud.js";

/**
 * Public HUD / telemetry API.
 *
 * Sketches push named values from their draw() loop and the HUD draws the
 * enabled widgets automatically (via a post-draw handler registered in
 * sketch.start()). Drawing happens on the p5 canvas so it is captured by the
 * recording pipeline. Disabled by default — opt in per sketch via options.ts.
 *
 *   import hud from "@/p5/utils/hud/index.js";
 *   hud.push( "speed", velocity.mag(), { unit: "px/f" } );
 */
const hud = {
  // ---- probe surface (sketch-facing) ----------------------------------
  push: (
    name, value, meta
  ) => probes.push(
    name,
    value,
    meta
  ),
  register: (
    name, meta
  ) => probes.register(
    name,
    meta
  ),
  get: ( name ) => probes.get( name ),
  getMeta: ( name ) => probes.getMeta( name ),
  has: ( name ) => probes.has( name ),
  series: ( name ) => probes.series( name ),

  // Frame on which the HUD was last drawn manually (for de-duping auto-draw).
  _drawnFrame: -1,

  /**
   * Manual draw escape hatch — call inside draw() if you need explicit control
   * over ordering (e.g. before a full-screen post effect). The auto post-draw
   * handler then skips this frame to avoid drawing twice.
   */
  draw: () => {
    hud._drawnFrame = getP5()?.frameCount ?? -1;
    drawHud();
  },

  /**
   * Register the auto-draw post-draw handler. Called once from sketch.start().
   * sketch.reset() wipes all registered events, so this re-registers cleanly on
   * every sketch load.
   */
  registerEvents: () => {
    events.register(
      "post-draw",
      () => {
        if ( hud._drawnFrame === ( getP5()?.frameCount ?? -1 ) ) {
          return;
        }

        drawHud();
      }
    );
  },

  /**
   * Clear probe state between sketches. Wired into sketch.reset().
   */
  reset: () => {
    probes.reset();
    hud._drawnFrame = -1;
  }
};

export default hud;
