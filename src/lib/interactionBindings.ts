/**
 * Interaction-bindings plugin flag — the single source of truth.
 *
 * The per-field modulation/binding UI (the Activity pastilles) AND the
 * "Interaction settings on every sketch" behavior are an opt-in bonus. When on,
 * every sketch seeds an `interaction` block, boots the interaction handler at
 * setup, and the engine samples + publishes channels every frame — real
 * overhead that most sketches don't need. So it ships OFF and is enabled with
 * `INTERACTION_BINDINGS=true` (exposed to the client/engine bundle as
 * `NEXT_PUBLIC_INTERACTION_BINDINGS` via next.config.ts).
 *
 * Read as a function so the value is honored at runtime in tests; the Next build
 * inlines `process.env.NEXT_PUBLIC_INTERACTION_BINDINGS` at each call site.
 */
export function interactionBindingsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_INTERACTION_BINDINGS === "true";
}
