// ─── Site Identity ────────────────────────────────────────────────────────────
export const SITE_NAME = "Sketchbook";
export const SITE_SHORT_NAME = "Sketchbook";
export const SITE_TAGLINE = "a studio for creative-coding visuals.";
export const SITE_DESCRIPTION =
  "Customizable creative-coding sketches built on p5.js, GSAP, and Three.js. Tweak parameters in a live editor, then export images or record full animations to video — never leaving the browser.";

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
  "content creation tool"
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
export const APP_FEATURE_LIST = [
  "p5.js sketch rendering",
  "GSAP animation sequences",
  "Three.js 3D scene rendering",
  "Video recording and export",
  "Customizable sketch options",
  "EXIF data overlay",
  "Multiple export formats"
];
