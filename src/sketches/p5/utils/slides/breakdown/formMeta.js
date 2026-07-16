// Guarded reader for the sketch's form metadata (stock defaults + per-field
// config), published by the React SketchContext provider as
// window.getSketchFormMeta. Returns {} in a bare runtime harness so the diff
// selection and start-value ranges degrade to their heuristics instead of
// throwing — same pattern as the HUD's sketchInfo() reader.

export default function getFormMeta() {
  if (
    typeof window !== "undefined" &&
    typeof window.getSketchFormMeta === "function"
  ) {
    try {
      return window.getSketchFormMeta() ?? {};
    } catch {
      return {};
    }
  }

  return {};
}
