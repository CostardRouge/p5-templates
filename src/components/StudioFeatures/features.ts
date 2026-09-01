/**
 * The home page's studio tour — one entry per surface of the sketch page.
 *
 * Kept as data rather than JSX so the same list feeds the rendered sections,
 * the in-page jump navigation and the `ItemList` JSON-LD without any of the
 * three drifting from the others.
 *
 * Every capture is a real screenshot of the running studio, taken headlessly
 * against the production build (see `docs/memory/studio-ui.md` for what each
 * panel is). `width` / `height` are the asset's own pixel dimensions — the
 * assets are 2× so they stay sharp on dense displays, and the markup renders
 * them at half that with `max-width: 100%`.
 */

export type FeatureCapture = {
  /** Path under `/public`. */
  src: string;
  /** Intrinsic pixel size of the asset — always set, so nothing reflows. */
  width: number;
  height: number;
  /** What the picture shows, for anyone who cannot see it. */
  alt: string;
  /** Visible caption under the picture. */
  caption: string;
  /**
   * Keep the picture at its natural size on a narrow screen and let its frame
   * scroll sideways, instead of shrinking it to fit. For text-dense captures
   * only — a table of 11px mono values at a third of its size is a picture of
   * a table, not a table.
   */
  scrollOnNarrow?: boolean;
};

export type StudioFeature = {
  /** Anchor id — also the jump-nav target. */
  id: string;
  /** Short label for the jump navigation. */
  eyebrow: string;
  title: string;
  summary: string;
  points: string[];
  capture: FeatureCapture;
  /**
   * `side` puts the capture beside the prose (portrait panels), `wide` puts it
   * underneath at full width (tables, strips and bars).
   */
  layout: "side" | "wide";
};

export const STUDIO_FEATURES: StudioFeature[] = [
  {
    id: "controls",
    eyebrow: "Controls",
    title: "A form built from the sketch itself",
    summary:
      "A sketch declares its parameters; the studio renders the matching form. There is no per-sketch interface to write, and no value that only exists in the code — everything a sketch reads is on screen, and every change redraws the canvas as you drag.",
    points: [
      "Sliders you can drag or type into, number fields, switches, single-line and multi-line text.",
      "Colour pickers with their own alpha track, selects and multi-selects, easing-curve pickers, font pickers.",
      "2D pads for vector parameters, canvas-size presets or your own width × height, duration and frame rate.",
      "Drop-zones for images, video and audio: a video carries its own repeat, speed, offset, loop mode and fit, plotted as a playback curve; an audio file auditions in place.",
      "Device pickers for the webcam, the audio input, a MIDI controller and a gamepad.",
      "Groups fold into bands so a forty-parameter sketch still fits in one column.",
      "Reset to defaults, randomize one group or the whole sketch, apply the current settings to every slide."
    ],
    capture: {
      src: "/assets/images/features/controls.webp",
      width: 688,
      height: 1888,
      alt: "The studio's Controls inspector: canvas size, duration and frame rate above the sketch's ten parameter groups, with the Iridescent group unfolded into eight labelled sliders.",
      caption:
        "The inspector — canvas and animation on top, the sketch's own parameters below, reset and randomize pinned to the bottom."
    },
    layout: "side"
  },
  {
    id: "modulation",
    eyebrow: "Modulation",
    title: "Bind any parameter to something live",
    summary:
      "A number does not have to be typed. Point a parameter at a source, map its range, and the sketch starts moving on its own — or on the room's.",
    points: [
      "Pointer sources: mouse, touch, an orbit control, device orientation, a MIDI controller, both sticks of a gamepad.",
      "Camera sources: hand and finger tracking, face and face mesh, full body pose.",
      "Audio from the microphone in seven bands — level, sub, bass, mid-low, mid, mid-high, treble and presence.",
      "Gesture channels derived from what the camera sees: hand openness, fingers up, pinch, spread, nearness, face count and depth.",
      "Face-mesh expressions as plain 0–1 values: smile, mouth open, blink left, blink right, brow raise.",
      "Generators that ask for no permission at all — oscillator, ramp, sequence, noise and stepped random — computed from the loop clock, so a recording of them is deterministic.",
      "Per binding: a mapping range, an easing curve, invert, and smoothing."
    ],
    capture: {
      src: "/assets/images/features/binding.webp",
      width: 608,
      height: 1020,
      alt: "The modulation popover for one parameter, its source set to Audio · Bass, with controls for weight, minimum, maximum, easing, invert and smoothing.",
      caption: "One parameter, bound to the microphone's bass band."
    },
    layout: "side"
  },
  {
    id: "mixer",
    eyebrow: "Mixer",
    title: "Several drivers on one parameter",
    summary:
      "Bindings stack. Each one is a layer with its own weight and blend mode, and the Interactive panel is the desk for all of them at once.",
    points: [
      "Layer a generator under a live input and blend them: replace, add, multiply, min, max or average.",
      "Mute and solo per layer, following the rule every mixer follows — solo anything and only the soloed layers play.",
      "A live meter on each channel, so you can see a signal before you trust it.",
      "Weight is a fader, not a switch: dial a source down to a hint rather than removing it.",
      "Bindings sit beside the sketch settings, never inside them — they travel with the document and leave the sketch's own parameters clean."
    ],
    capture: {
      src: "/assets/images/features/mixer.webp",
      width: 680,
      height: 600,
      alt: "The Interactive mixer listing three bound parameters driven by Audio, Hands and Face, each row carrying a level meter, mute, solo, a weight fader and a remove button.",
      caption: "Three parameters, three sources: audio bass, a hand pinch, a smile."
    },
    layout: "side"
  },
  {
    id: "elements",
    eyebrow: "Elements",
    title: "Seventeen things you can lay over a sketch",
    summary:
      "The add-layer palette splits in two: content you compose with, and telemetry that reads the sketch while it runs.",
    points: [
      "Content — a visual, a text block, a timed title, a meta block, a specs overlay, a breakdown, an image, an image stack, a background, and a QR code pointing at the current link.",
      "Telemetry — badge, gauge, sparkline, counter, crosshairs, colour swatch and a labelled bounding box, each bound to a live value.",
      "Specs prints the sketch's own settings over the artwork, in the same language a technical readout uses.",
      "Breakdown narrates the diff: only the parameters you changed become steps, shown one at a time while the sketch visibly settles into its final state.",
      "Every element carries its own type, size, colour and blend mode, and can be dragged into place directly on the canvas.",
      "Add one straight from the control it should watch: right-click a slider and add a gauge, a counter or a sparkline for it, already bound."
    ],
    capture: {
      src: "/assets/images/features/palette.webp",
      width: 544,
      height: 970,
      alt: "The add-layer palette: a Content group of ten tiles — visual, text, title, image, image stack, meta, specs, breakdown, background, QR code — above a HUD and telemetry group of seven.",
      caption: "The palette — ten content kinds, seven telemetry widgets."
    },
    layout: "side"
  },
  {
    id: "layers",
    eyebrow: "Layers",
    title: "One list, this slide first",
    summary:
      "Everything drawn over the sketch is a row in one list, grouped by what it applies to. Pressing a row replaces the list with that layer's inspector; the back arrow returns.",
    points: [
      "Rows name themselves from what they carry — the text they print, an image's file name, the value a gauge is watching.",
      "Drag to reorder. The order is the stacking order.",
      "An eye toggle hides a layer without deleting it.",
      "Two groups: what belongs to the slide you are on, and what every slide shares.",
      "Press an object on the canvas and its inspector opens; press its row and the same inspector opens. One selection, two ways in."
    ],
    capture: {
      src: "/assets/images/features/layers.webp",
      width: 640,
      height: 660,
      alt: "The content rail listing five layers — Text, Gauge, Sparkline, Badge and Specs — each with a drag handle, an icon and a preview of what it carries.",
      caption: "The content rail, with the add-layer button in the band header."
    },
    layout: "side"
  },
  {
    id: "slides",
    eyebrow: "Slides",
    title: "A deck of variants, not a timeline",
    summary:
      "The first slide promotes whatever is already on screen. Every slide after it is a variant with its own parameters, its own canvas size and its own layers.",
    points: [
      "Thumbnails render from the real canvas and follow your edits.",
      "Drag to reorder, duplicate, rename in place, delete.",
      "A slide can carry its own resolution — a reel beside a square beside a still.",
      "Adding a slide inherits the settings you are looking at; deleting the last one hands everything back to the single view. Neither direction loses anything."
    ],
    capture: {
      src: "/assets/images/features/filmstrip.webp",
      width: 1716,
      height: 256,
      alt: "The slide filmstrip: five thumbnails labelled A to E, each a different coloured variant of the same sketch, followed by a dashed add-slide tile.",
      caption:
        "The filmstrip. The add slot is a slide-shaped tile, sized like the slide it would create."
    },
    layout: "wide"
  },
  {
    id: "transitions",
    eyebrow: "Transitions",
    title: "A slide that morphs the others",
    summary:
      "Turn a slide into a montage and it stops being a variant: it interpolates the other slides' parameters into one another, over its own duration, in a loop.",
    points: [
      "Morph interpolates numbers and colours; dip fades through a colour and switches the parameters behind it.",
      "Pick the sources: every other slide, or a hand-chosen list in your own order.",
      "Hold, easing and loop mode — cyclic, ping-pong, or once and hold the last.",
      "Stagger spreads the changing parameters apart so they land one after another instead of all together.",
      "Snap keys stay discrete: a random seed should jump, not slide through every value in between.",
      "An optional title names the variant on screen, and an optional transition sound clicks at each change — heard live and baked into the recording."
    ],
    capture: {
      src: "/assets/images/features/transition.webp",
      width: 640,
      height: 1520,
      alt: "The transition band with the montage switch on, showing controls for sources, style, easing, hold, loop, stagger, snap keys, a slide title and a transition sound.",
      caption: "Montage settings, per slide."
    },
    layout: "side"
  },
  {
    id: "export",
    eyebrow: "Export",
    title: "Export is a list, and the list is the queue",
    summary:
      "One row per output. Every setting is editable in place, and the one filled button runs every row.",
    points: [
      "mp4, webm, gif, a single png, or a png sequence of 10, 20 or every frame, zipped.",
      "Per row: resolution — a preset or your own — frame rate, which slides it covers, and whether a multi-slide run comes back as one continuous file or a zip of them.",
      "Leave a cell on the sketch's own value and it keeps following the sketch. Pin it and it stays pinned.",
      "A column that does not apply shows a dash instead of a control that would be ignored: no frame rate on a still, no delivery choice for a single file.",
      "Recording runs in the browser. With the server queue enabled, a long render is handed off and you keep working.",
      "A finished row previews in place and hands the file to the system share sheet — on a phone, that is the route from a browser export into the photo library."
    ],
    capture: {
      src: "/assets/images/features/export.webp",
      width: 1536,
      height: 630,
      alt: "The export dialog: a table with four variant rows — the sketch's own size, an Instagram Reel, a square and a still — each showing its size, output format, frame rate, slide scope and delivery, above an Export all 4 button.",
      caption: "Four outputs from one sketch, queued in a single press.",
      scrollOnNarrow: true
    },
    layout: "wide"
  },
  {
    id: "transport",
    eyebrow: "Transport",
    title: "One scrubber, one clock",
    summary:
      "A single bar along the bottom edge of every layout — docked, floating and on a phone alike. There is exactly one scrubber in the page, and this is it.",
    points: [
      "Frame and total, elapsed and duration, and how far through the loop you are.",
      "Scrub anywhere in the animation and the sketch renders that exact frame — the loop clock is the only time a sketch is allowed to read, which is what makes a headless capture match what you saw.",
      "The camera saves the current frame as a png; the red dot opens the export dialog.",
      "Space plays and pauses, E opens export, S opens share — and every shortcut stands down while you are typing or inside a dialog."
    ],
    capture: {
      src: "/assets/images/features/transport.webp",
      width: 2000,
      height: 69,
      alt: "The transport bar: a play button, a scrubber filled to sixteen percent, the readout 122 of 720 frames and 2.03 seconds of 12, a camera button and a red record dot.",
      caption: "The transport bar — the same bar on desktop, in the floating layout and on a phone.",
      scrollOnNarrow: true
    },
    layout: "wide"
  },
  {
    id: "presentation",
    eyebrow: "Presentation",
    title: "Three axes, five presets",
    summary:
      "Fullscreen, hiding the interface and stretching the canvas are three independent switches, not one button that silently does all three.",
    points: [
      "Present, Present (sketch ratio), Focus, Fill the page and Clean preview are the named combinations; the toggles underneath reach the rest.",
      "Stretch makes the canvas resolution follow the surface, live — and gives the sketch its own size back when you leave.",
      "Escape gets you out, including in the two presets the browser does not own.",
      "Zoom in, zoom out, 100%, fit: the canvas is a viewport you can pan and zoom, not a fixed frame."
    ],
    capture: {
      src: "/assets/images/features/presentation.webp",
      width: 918,
      height: 816,
      alt: "The presentation menu under the zoom controls, listing Present, Present (sketch ratio), Focus, Fill the page and Clean preview, above separate Fullscreen, Hide interface and Stretch canvas toggles with their keyboard shortcuts.",
      caption: "Presentation modes, from the zoom cluster in the top bar."
    },
    layout: "side"
  },
  {
    id: "document",
    eyebrow: "Document",
    title: "Undo, import, export, share",
    summary:
      "What you build is a document, not a session. It has a history, it survives a reload, and it fits in a file you can send someone.",
    points: [
      "Undo and redo the whole document; edits are grouped as you make them, so a slider drag is one step, not two hundred.",
      "Export the settings as JSON and import them back — parameters, layers, slides and bindings in one file.",
      "Share a link that carries your settings in the URL, or an iframe you can paste anywhere.",
      "An embed can be display-only, expose every option, or expose exactly the ones you choose."
    ],
    capture: {
      src: "/assets/images/features/document.webp",
      width: 552,
      height: 290,
      alt: "The top of the content rail: undo and redo arrows beside Export and Import buttons, above the layers band listing a Text and a Specs layer.",
      caption: "Undo, redo and the settings file, at the head of the content rail."
    },
    layout: "side"
  },
  {
    id: "sound",
    eyebrow: "Sound",
    title: "The panel clicks back",
    summary:
      "A small synthesised click on every value change, with its own voice, volume and pitch — and a pitch that varies by field, so each slider has its own note.",
    points: [
      "Off by default, and never routed through the sketch's audio engine: panel feedback cannot leak into a recording.",
      "A minimum gap between clicks turns a slider drag into a rhythm rather than a buzz.",
      "Humanize detunes each click a little, so a long drag does not sound mechanical.",
      "The same synth voices a montage's transition sound, where it is baked into the exported file."
    ],
    capture: {
      src: "/assets/images/features/sound.webp",
      width: 544,
      height: 744,
      alt: "The UI sound settings popover: switches for sound on value change and on action buttons, a click-sound voice picker, and sliders for volume, pitch, humanize, minimum gap and clicks per change.",
      caption: "Sound feedback settings, from the inspector's action bar."
    },
    layout: "side"
  }
];

/** The studio overview shown above the tour. */
export const STUDIO_OVERVIEW_CAPTURE: FeatureCapture = {
  src: "/assets/images/features/studio.webp",
  width: 2200,
  height: 1293,
  alt: "The whole sketch page: a top bar with zoom, undo and Export; the Controls inspector on the left; the sketch rendering in the middle with a badge and a sparkline drawn over it; the layers rail on the right; the slide strip and the transport bar along the bottom.",
  caption:
    "One page: controls on the left, layers on the right, the deck and the transport along the bottom, and the sketch in the middle at whatever zoom you like."
};
