export const EVENT = 'sketch-options';

let current = globalThis.sketchOptions ?? {};

/* shallow‑object deep‑merge (1 level) */
function merge(a, b) {
  for (const k in b) {
    const v = b[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      a[k] = merge({ ...(a[k] || {}) }, v);
    } else {
      a[k] = v;
    }
  }
  return a;
}

export function setSketchOptions(update, origin = 'react') {
  current = merge({ ...current }, update);
  globalThis.sketchOptions = current; // keep legacy global
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { opts: current, origin } }));
}

export function subscribeSketchOptions(cb) {
  const handler = e => cb(e.detail.opts);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

export const getSketchOptions = () => current;