# Studio UI — the sketch preview page layout

Read before touching the sketch page's panels, the docked/floating layouts, the mobile drawer, the filmstrip or the export surface.

## The layout model (2026-08-28)

One inspector, a content rail, a filmstrip, export in the top bar. Decided with the maintainer over an interactive mockup (conversation "sketch-preview-interface"); the data model was explicitly out of scope — only placement changed.

- **Inspector (left)** — `SketchSettings`: a "canvas & animation" section (`RootSettings`, editing `format`/`animation`) above the sketch's own form, one action bar pinned at the bottom (reset / randomize / apply-to-all-slides · dev: save-defaults / thumbnail / preview · ui-sound far right). The panel exists even when the sketch has no `formConfiguration` — canvas settings must never disappear — so `SketchPage.reserveLeft` is simply `dockedDesktop`.
- **Content rail (right)** — `OptionsPanel`: "slide N content" (`SlideEditor`: transition + content items) above "shared content" (root `content`, labelled just "content" when no slides). Nothing else: general settings and the slides list both moved out.
- **Filmstrip (bottom)** — `SlideFilmstrip`: horizontal thumbnails, dnd reorder, per-slide aspect ratio from `size` overrides. Docked: a band between the rails whose height travels through `--studio-filmstrip-height` (7rem with slides, 3rem empty, 0 otherwise) — SketchPage subtracts it from the viewport, the band sizes itself with it, the Interactive mixer offsets above it. Floating: an island bottom-center; the mixer takes a fixed offset above it.
- **Export (top bar, docked)** — `ExportMenu`: the only solid (ink-filled) button on screen, opening a panel with options import/export + `CaptureActions`. **The panel content stays mounted while closed** (visibility toggle): `captureActionsRef` is the autosave handle (`useFormState` calls `saveAsDraft` through it) and a running recording must survive the panel closing; it force-opens while recording so progress stays visible. Undo/redo sits beside it. Both portal from `SketchOptions` into a `DockedTopBar` slot (`actionsSlotRef`) because the bar belongs to SketchPage while these need the form context — same pattern as the zoom-controls slot.
- **Floating mode is kept**, reorganised not removed: same panels as islands, capture card stays in the bottom-right stack (no top bar to host Export there). The maintainer plans draggable floating panels later — panels must not hard-code their own anchoring; the wrapper/container owns position.
- **Mobile** — drawer tabs are Sketch (canvas & animation + sketch form) / Content / Export, with the filmstrip as a strip above the tab content, visible on every tab. Export appears **once** on mobile: the drawer tab (plus the red-circle engine-controls shortcut that opens it); no top Export button — the duplication was called out and resolved this way.

## "Document" is not a scope in the UI

2026-08-28 — With at least one slide, the selected slide is always what is edited; without slides, the root blocks are. This matches what the code already did (`effectiveActiveIndex` falls back to 0; `resolveEffectiveSketch` spreads `slide.sketch` over root `sketch`, so the root is never *read* once a slide covers it) and the maintainer's history: slides were added after the fact, root `sketch` is the defaults holder, and slides are expected to grow into a preset system (a slide ≈ a named variant). Consequences, all deliberate:
- **No Document/Slide scope switcher** and no "Doc" card in the filmstrip — both were mocked up and rejected as a third state nothing needs.
- **Rejected: blue override indicators / per-field link-to-document chains.** Mocked, then dropped: `ControlChrome`'s existing modified-state (label gains weight, per-field reset appears) is the only signal wanted. Do not reintroduce colour-coded override badges.
- **The 0 ↔ 1 slide boundary must be lossless** (`useSlideManagement`): deleting the last slide demotes everything (sketch, size, animation, content appended after root's, asset lists unioned, interactive merged slide-wins); adding a slide inherits the active slide's current settings, never `sketchFormValues` factory defaults; everything handed to `makeDefaultSlide` is deepCloned because `SlideSchema`'s `sketch: z.any()` passes references through (the first slide used to alias the root sketch object).
- Open: root `content` ("shared content") is editable in place in the rail; the maintainer may later want propagation via apply-to-all instead.

## Filmstrip ≠ timeline

2026-08-28 — Slides are a collection of variants, not a temporal sequence; a slide is on its way to being a preset. The filmstrip therefore stays a separate band from the `AnimationProgressionBar` scrubber. Rejected: merging them into one bar where each slide is a timeline segment — it would impose sequence semantics the model doesn't have.

## Visual language (from the validated mockup)

2026-08-28 — Monochrome stays the rule: the Export button is an ink-filled pill precisely because nothing else is filled; red is reserved for recording-in-progress (the mobile record shortcut already uses it). The sketch name appears once — the breadcrumb above the canvas — never in the top bar. The full zoom cluster (−, %, +, 100%, fit/fullscreen) survives in the docked bar; do not collapse it to a single fit control.
