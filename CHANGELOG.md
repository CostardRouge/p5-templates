# Changelog

What each release of Sketchbook brings to the person using it. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html); `.github/workflows/release.yml` turns each section into a
tag and a GitHub Release once it reaches `main` (COMMON-PROJECT-SPEC C13 in `second-brain`). Written in English, like
the code. Codenames are mathematical curves, in alphabetical order. Versions 0.1.0 to 0.10.0 were given after the fact
to the history's turning points; until 0.8.0 the project was called p5 templates.

## [Unreleased]

### Added

- A Sequence layer: whole sketches, splash cards, loading screens and colour plates cut together into one reel,
  each scene entering through one of twenty GL transitions (wipe, iris, push, zoom, dissolve, glitch, blinds,
  tiles, clock wipe, ripple, swirl, cube, melt, film burn, luma, slices…) with an edge light drawn from a palette,
  a camera move (push-in, pan, drift, orbit, handheld) and a film grade (letterbox, vignette, grain, chromatic
  aberration, tint, scanlines), optionally with a sound at each cut. Deterministic, so an export cuts like the preview.
- A scene cut on every slide and on the document: the loop opens out of a colour plate and closes back into it
  through the same transitions, so slides joined in one video cut like a film.

## [1.0.0] - 2026-10-17 — Lemniscate

The first numbered release: Sketchbook as it is deployed today.

### Added

- An agent can make Sketchbook media end to end through an MCP server, and drive an open studio tab: the sketch, the
  canvas, slides, content, HUD, media, playback, snapshots and export.
- A gallery kept in the browser: every finished export, or a press on Keep, files the whole piece with a thumbnail,
  to reopen later or back up as one file.
- The iridescent category: one colour-ramp material across four sketches, with fifteen named palettes.
- Palettes everywhere, picked by their swatch, and a background that can be a colour or a gradient.
- A 3D vector can be bound, shown as a HUD element with five views, and randomized on the unit sphere.
- The home page shows the version.

### Changed

- A mouse wheel zooms the viewport again; a trackpad still pans.

### Security

- Closed an unauthenticated file read and a bucket wipe found by a codebase audit, among other fixes.

## [0.10.0] - 2026-10-03 — Kappa
<!-- commit: a975d42e170128fc7b40118a455e6ecb9612ceae -->

### Added

- Play a sketch from a MIDI controller: controls a sketch declares, a map by port, and learn in two clicks.
- A vector3d control, one `{ x, y, z }` field edited in an orbitable box.
- The gyroscope pointer is calibrated and drives one of four signals.
- A readout and a vector map among the telemetry layers.
- The flip and sculpt categories.
- A field driven by a binding shows its live value on its own control, colours and 2D pads included.

### Changed

- Export progress is rebuilt, and the export dialog takes the whole screen on a phone.
- Exports no longer lose files to stacked save prompts on a phone.

## [0.9.0] - 2026-09-04 — Kampyle
<!-- commit: 6e34269c1cfc95a798d3b364340118800548913f -->

### Added

- A new sketch page: one inspector, a content rail, a filmstrip of slides, and Export in the top bar.
- Export as a list of variants, each at its own resolution and frame rate, run as a batch.
- A studio that works on a phone: one transport bar, one capture surface.
- Keyboard shortcuts for playback, export, share and fullscreen.
- A sketch can run inside another as a layer, frozen or offset in its loop.
- Booleans, selects and colours can be bound, and the HUD splits into standalone telemetry elements.
- HEIC, HIF and DNG uploads, and a site map.
- The home page tours the studio with real screenshots.

### Changed

- Navigation stays inside the page instead of reloading it, and visits are counted by a self-hosted, cookie-free
  Umami instead of Google Analytics.
- A trackpad scroll pans the viewport and a pinch zooms.

## [0.8.0] - 2026-08-01 — Involute
<!-- commit: 41a17bf5ea8fb90950cef8441569dabe5ce974a0 -->

### Added

- Content items are dragged on the canvas, by mouse or by touch, and clicking one opens its panel.
- A Three.js engine beside p5 and GSAP.
- A docked workspace for the desktop editor, with undo and redo.
- Share a sketch by link, with its options in the address, as an embeddable page.
- Still-frame sequence export, 4K presets, 25 and 50 fps, and a fullscreen mode.
- Face tracking as an interaction source, and both joypad sticks.
- Apply a block of parameters to every slide, and sequence parameters through montage transitions.
- A step-by-step breakdown of a sketch as a content item.

### Changed

- The project is renamed Sketchbook: templates are sketches, under `/sketches`.

## [0.7.0] - 2026-06-30 — Hippopede
<!-- commit: 5a88e020d95a2bbbb592a74c7a811f8187ea69cb -->

### Added

- Interactive parameter bindings: any setting can follow a mouse, a camera, a hand, a face, audio, a joypad, MIDI or
  the gyroscope.
- Code-generated sound, captured in recordings.
- A telemetry HUD overlay.
- Montage slides that morph between variants, with staggering, dips and a title.
- Video sketches, a QR code content item and a 2D vector pad.
- A sketch settings panel made for touch on a phone.

### Changed

- A push to `main` deploys within seconds through Watchtower's API.

## [0.6.0] - 2026-06-02 — Folium
<!-- commit: 2b3fa4bff301ac1f533743c44cb605eb87f7f8ea -->

### Added

- One studio for every render engine: p5 and GSAP sketches behind the same controls and the same capture.
- Recording in the browser, with its own encoders.
- A new home page, maskable icons and a refreshed social card.
- Collapsible option sections that remember their state, and video assets.

## [0.5.0] - 2026-04-23 — Epicycloid
<!-- commit: 625f0acf2c311573f81a84839270670b28be0156 -->

### Added

- GSAP HTML templates.
- Import and export a template's options as a file, and randomize them.
- A JSON field, and options that are fixed or vary along the loop.
- Fuzzy search in the library, and pages described for search engines.
- Save a template's current settings as its defaults.

## [0.4.0] - 2025-11-29 — Deltoid
<!-- commit: c45a09dcae626d926f9a559fe97dc37dcc0f3744 -->

### Added

- An installable app with push notifications when a recording finishes.
- WebM recording, and a light, dark or system theme.
- Recordings can be cloned, force-cancelled and downloaded slide by slide, with their file sizes.
- Search in the templates list, and a view mode it remembers.
- Animated zoom and fit in the viewport.

### Changed

- The menu bar moves to the bottom, and the recordings and template pages are redesigned.

## [0.3.0] - 2025-10-03 — Cardioid
<!-- commit: 708377844ddbc9cce4647be170bee14119c4650c -->

### Added

- Images in a template, reordered by drag and drop.
- Content items on slides: text, colours, patterns, images, image stacks and visuals, with scale and rotation.
- A zoomable viewport.
- Drafts: a recording saved before it is rendered.
- Slide management, size presets, and undo and redo in the options form.
- A capturing mode that hides the interface while recording.

## [0.2.0] - 2025-06-25 — Bicorn
<!-- commit: 86baadfaff12f63dee57219aa4b5b0c4db3d0628 -->

### Added

- Recording on the server, as a queue of jobs with their progress.
- Slides: a template made of several scenes, recorded together.
- Hand and motion capture sketches.
- A recordings dashboard.
- A Docker image with its database, queue and storage.

## [0.1.0] - 2025-04-30 — Astroid
<!-- commit: a7ef16d8d9da1cd0c2176e58a5834f467acdd6a2 -->

### Added

- p5.js photo and text templates, each with an options form, and a download of the canvas.
- Photo EXIF details, zoom to fit, and a first set of photo grids, stacks and masks.
