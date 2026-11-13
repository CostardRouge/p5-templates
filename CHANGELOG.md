# Changelog

What each release of Sketchbook brings to the person using it. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html); `.github/workflows/release.yml` turns each section into a
tag and a GitHub Release once it reaches `main` (COMMON-PROJECT-SPEC C13 in `second-brain`). Written in English, like
the code. Codenames are mathematical curves, in alphabetical order. Versions 0.1.0 to 0.10.0 were given after the fact
to the history's turning points; until 0.8.0 the project was called p5 templates.

## [Unreleased]

### Added

- A fourth Materials sketch, Sand: a sea of dunes under a low sun, their crests cutting lit slopes from shaded
  faces, with veils of sand streaming over them, plumes spilling off the crests and ripples creeping in the wind.
  Dunes, wind, sun, sky, sand colour and camera are in the form.
- A fifth Materials sketch, Ice: a faceted block of clear ice turning in studio light, bending and breaking the
  lights through its facets, with a milky heart, bright fractures and white edges. One slider turns it into glass
  or diamond; its shape, flaws, lights and backdrop are in the form.
- A sixth Materials sketch, Lava: a lake of lava at night, dark plates of crust drifting on the melt, split by
  glowing cracks that widen and branch as waves of heat pass underneath, with sparks and heat shimmer. Plates,
  heat, melt and crust colours, air and camera are in the form; a yellower melt and a greyer crust make it metal.
- A seventh Materials sketch, Smoke: a thread of pale smoke rising from an ember in the dark, a twisting ribbon
  that breaks into soft billows, lit from the side so it has depth and shade. Plume, air, lamp and backdrop are in
  the form.
- The gallery shows what each piece became on the networks through your Postiz, in one of three views: Month (a
  calendar with each day's posts, published, planned ringed blue, failed ringed red; dots and a day list on a
  phone), Week (seven days with the times, the networks and your rhythm's free slots, then Open Postiz) and Grid
  (your pieces, each wearing the networks it went to, with filters for planned, published, failed and not
  posted). The page opens on the view you chose last. A click on a piece opens its sketch's sheet: every send,
  each account with its link to the live post or what went wrong, Take back, Open in Postiz and the pieces kept.
  Without a Postiz, Month and Week lay out the pieces you kept by day.
- The gallery also shows what Sketchbook posted from your other devices, recognised by the sketch's link in the
  caption, with the sketch's catalogue picture and «from another device».

### Changed

- Every post Sketchbook sends to your Postiz is tagged "Sketchbook", and what Sketchbook lists of your planned
  posts shows only its own; posts from your other apps on the same Postiz are hidden there but still take their
  slots of your rhythm. Create the tag once in Postiz (Create Post › Tags › Add New Tag) so it sticks.

### Fixed

- After publishing, the screen now shows what really happened on each account — published (with a link to the
  post), queued or failed — instead of saying "publishing" for all of them. A failed account shows what Postiz said
  and what to do about it, and can be sent the same files again, or taken back to the variants to pick another one.
- Threads, X and Bluesky now get a picture variant by default when the export has one, even when a video was the
  sketch's chosen variant; before, the first send handed them the video. A Bluesky "missing jobId" failure is
  explained: Bluesky refused the video (usually an unverified email in Bluesky).
- Browsing from one shader sketch to another no longer runs the browser out of WebGL contexts: each sketch now
  gives its graphics context back when you leave it, where before every visited sketch kept one until the page
  failed with an empty canvas. When a browser still refuses WebGL (no hardware acceleration, too many 3D tabs), the
  sketch says so on the page instead of staying blank and retrying every frame.

## [1.3.0] - 2026-11-11 — Parabola

### Added

- A new iridescent sketch, Spiral bloom: a flower whose flat, curled petals are packed on a golden-angle spiral, closing
  and reopening in a wave from the heart to the rim while its spiral arms wind and unwind. The divergence angle, the
  petals' shape and lean, the bloom and the palette are all in the form.
- A new category, Materials, opening with Flame: a realistic fire — a white-hot core in orange tongues that tear off at the tip, a blue foot,
  a halo and rising sparks — turning like a small fire whirl in a seamless loop. Its shape, turbulence, heat and
  sparks are in the form, a mirror option makes it symmetric, and any iridescent palette recolours it.
- A new iridescent sketch, Peaks knot: a trefoil knot bristling with fine needles that travel along it and roll
  around it as it turns. The knot's two winding numbers are in the form, from a plain ring to tighter knots.
- A new iridescent sketch, Peaks shell: a spiny seashell whose spiral widens turn after turn, its needles gathered
  into combs and swaying in a wave. Turns, growth, ridges and the spines' lean are in the form.
- A second Materials sketch, Water: open sea at golden hour, a choppy swell rolling to a warm horizon with the low
  sun's path of glitter across it, in a seamless loop. Waves, camera, sun, sky and water colours are in the form.
- A third Materials sketch, Caustics: a tiled swimming pool seen from above, its floor wobbling under the ripples
  and crossed by the bright, shifting net of light the water casts, with faint colour fringes and the odd sparkle.
  Ripples, light, tiles and water colour are in the form.
- Connect your own Postiz from Menu › Publishing: paste its address and an API key, tick the Instagram, TikTok
  or YouTube accounts to propose, a collaborator and your weekly rhythm. The key stays in your browser; Sketchbook's
  server never sees it.
- Publish or schedule from the Export dialog: once Postiz is connected, switch the footer to Publish, pick the
  variant that goes, the accounts, Instagram's kind (Reel, post, carousel or story), when — the next free slot of
  your rhythm, another slot, a time of yours, now or a draft — and a caption filled with the sketch's title,
  description, tags and link. One press renders it and sends it; Publish now shows the file first. Pictures go out as
  JPEG, and a post scheduled by mistake can be taken back.
- With two Instagram accounts, each post goes to the one you tick, to both (a post on each), or to one with the
  other invited as collaborator — one post signed by both. Type your accounts' usernames once in Publishing.
- Each account takes its own variant: the 9:16 Reel (and a story beside it) to Instagram, a square or 4:5 picture to
  Threads, X and Bluesky — rendered once each, sent in one go. Export remembers which format each account usually
  takes, so your next sketch routes itself. Threads, X and Bluesky get a short caption of their own.
- Claude can publish for you too: with your Postiz connected, it can set up the post, write a caption for you to
  read, and schedule it once you say it suits you — never a caption you did not approve.

### Changed

- On wider screens, paragraphs now keep the same relaxed line spacing as on a phone, and the home page's headline
  sits as tightly as designed.
- On touch screens, a tapped button or link no longer stays highlighted as if the pointer were still over it.

### Fixed

- On a phone, the menu button no longer covers the Export screen's title.
- On a sketch, the engine, category and name links above the canvas open in the same tab instead of a new one,
  so the browser's Back returns to the sketches and the home page instead of closing the site.

## [1.2.0] - 2026-10-22 — Ophiuride

### Added

- `/llms.txt`: the site described for language models — what Sketchbook is, its pages, the sections of the studio
  tour and every sketch, each with its link.

## [1.1.0] - 2026-10-21 — Nephroid

### Added

- A Sequence layer: whole sketches, splash cards, loading screens and colour plates cut together into one reel,
  each scene entering through one of twenty GL transitions (wipe, iris, push, zoom, dissolve, glitch, blinds,
  tiles, clock wipe, ripple, swirl, cube, melt, film burn, luma, slices…) with an edge light drawn from a palette,
  a camera move (push-in, pan, drift, orbit, handheld) and a film grade (letterbox, vignette, grain, chromatic
  aberration, tint, scanlines), optionally with a sound at each cut. Deterministic, so an export cuts like the preview.
- A scene cut on every slide and on the document: the loop opens out of a colour plate and closes back into it
  through the same transitions, so slides joined in one video cut like a film. The exit is set once: by default it
  plays the entrance backwards, or plays it again, or takes its own settings, and it can keep its own length.
- A legal notice at `/legal`: who publishes and hosts Sketchbook, what stays in your browser, what a recording handed
  to the server sends, and what the audience measurement counts — linked from the home page's footer and the site map.
- Raster favicons (16 and 32 px) beside the icon, and a home-screen icon that shows the mark on white on an iPhone
  instead of on black.

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
