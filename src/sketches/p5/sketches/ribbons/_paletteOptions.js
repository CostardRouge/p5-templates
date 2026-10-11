// ─────────────────────────────────────────────────────────────────────────────
// The ribbons palette list as FORM data — the names a `palette` select
// offers. This module imports nothing on purpose: the option files are loaded
// server-side (`@/engines/sketchOptionLoaders`), and `_shared.js`, which
// holds the palettes themselves, reaches the p5 runtime (`mappers.js` →
// `sketch.js`, which touches `window` at import). Importing it from an
// `options.ts` threw there, the loader swallowed the error, and every ribbons
// sketch showed up in the studio with an empty form.
// `src/sketches/__tests__/sketchOptionsLoad.test.ts` guards the chain now.
// ─────────────────────────────────────────────────────────────────────────────

export const PALETTE_OPTIONS = [
  {
    value: "rainbow",
    label: "Rainbow"
  },
  {
    value: "rainbow-trip",
    label: "Rainbow trip"
  },
  {
    value: "purple",
    label: "Purple"
  },
  {
    value: "pink",
    label: "Pink"
  },
  {
    value: "red",
    label: "Red"
  },
  {
    value: "gold",
    label: "Gold"
  },
  {
    value: "ember",
    label: "Ember"
  },
  {
    value: "ocean",
    label: "Ocean"
  }
];

export function getPaletteSelectField() {
  return {
    component: "select",
    label: "Palette",
    options: PALETTE_OPTIONS
  };
}
