// ─── Site Identity ────────────────────────────────────────────────────────────
export const SITE_NAME = "Sketchbook";
export const SITE_SHORT_NAME = "Sketchbook";
export const SITE_TAGLINE = "a studio for creative-coding visuals.";
export const SITE_DESCRIPTION =
  "Customizable creative-coding sketches built on p5.js, GSAP, and Three.js. Tweak parameters in a live editor, then export images or record full animations to video — never leaving the browser.";

// The home page documents the editor surface by surface (see
// `components/StudioFeatures`), so it carries its own description naming what
// that tour actually shows.
export const HOME_DESCRIPTION =
  "A browser studio for creative-coding visuals: a generated parameter form for every sketch, layers and live telemetry overlays, parameters bound to audio, camera, hands or face, slides that morph into one another, and an export queue that renders mp4, webm, gif and png at several sizes at once.";

// ─── Author / Publisher ───────────────────────────────────────────────────────
export const SITE_AUTHOR = "Steeve Pommier";

// ─── Locale & Category ───────────────────────────────────────────────────────
export const SITE_LOCALE = "en_US";
export const SITE_CATEGORY = "technology";

// ─── SEO Keywords ─────────────────────────────────────────────────────────────
export const SITE_KEYWORDS: string[] = [
  "creative coding",
  "creative coding sketches",
  "sketchbook",
  "video generator",
  "p5.js",
  "GSAP animation",
  "Three.js",
  "generative art",
  "motion graphics",
  "video recording",
  "video export",
  "animation editor",
  "social media visuals",
  "content creation tool",
  "audio reactive visuals",
  "face tracking visuals",
  "hand tracking visuals",
  "parameter modulation",
  "batch video export",
  "browser video recorder"
];

// ─── Default Open Graph Image ─────────────────────────────────────────────────
export const OG_IMAGE = {
  path: "/assets/images/icon-512x512.png",
  width: 512,
  height: 512,
  alt: `${ SITE_NAME } — ${ SITE_TAGLINE }`
};

// ─── Theme Colors ─────────────────────────────────────────────────────────────
export const THEME_COLOR_LIGHT = "#ffffff";
export const THEME_COLOR_DARK = "#000000";

// ─── App Feature List (for JSON-LD WebApplication) ───────────────────────────
// Kept in step with the studio tour on the home page
// (`components/StudioFeatures/features.ts`): if a feature is worth showing
// there, it belongs here too.
export const APP_FEATURE_LIST = [
  "p5.js sketch rendering",
  "GSAP animation sequences",
  "Three.js 3D scene rendering",
  "Parameter form generated from each sketch",
  "Image, video and audio drop-zones",
  "Parameters bound to audio, camera, hands, face, MIDI and gamepad input",
  "Oscillator, ramp, sequence, noise and random modulation generators",
  "Layered modulation with per-layer weight, blend, mute and solo",
  "Text, image, QR code, specs and breakdown overlays",
  "Live telemetry overlays: badge, gauge, sparkline, counter, crosshairs, swatch, bounding box",
  "Slides — per-sketch variants with their own size and layers",
  "Montage slides that morph the other slides into one another",
  "Batch export of several sizes at once",
  "Video recording and export to mp4, webm and gif",
  "PNG stills and png frame sequences",
  "Headless server-side rendering queue",
  "Settings import and export as JSON",
  "Shareable links and embeddable iframes",
  "Presentation and fullscreen modes"
];
