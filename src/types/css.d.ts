// TypeScript 6+ reports TS2882 for side-effect imports it cannot resolve to a
// module or type declaration (e.g. `import "./globals.css"` in app/layout.tsx).
// Next.js handles the bundling; these declarations just tell the checker the
// imports are legitimate.
declare module "*.css";
declare module "*.scss";
declare module "*.sass";
declare module "*.less";
