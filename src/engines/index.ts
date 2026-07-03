/**
 * Engine bootstrap — import this module once (e.g. in a layout or
 * server component) to make every registered engine available via
 * `getEngine()` / `listEngines()`.
 */
export {
  getEngine, listEngines, hasEngine, listEngineIds
} from "./registry";

import {
  registerEngine
} from "./registry";
import {
  p5Registration
} from "./p5/index";
import {
  gsapRegistration
} from "./gsap/index";
import {
  threejsRegistration
} from "./threejs/index";

/* ---- register built-in engines ----------------------------------- */
registerEngine( p5Registration );
registerEngine( gsapRegistration );
registerEngine( threejsRegistration );
