/**
 * Generic Cavalry player template.
 *
 * Unlike p5 / GSAP templates, a Cavalry animation is a `.cv` scene file rather
 * than code. This module is the minimal contract `CavalryEngine` reads:
 *
 *   • `scene` set to an asset path → a committed scene shipped with the repo.
 *   • `scene` null → the generic uploader; the engine renders whatever `.cv`
 *     the user uploads through the `cavalryFile` option (see options.ts).
 *
 * The actual playback is handled by the vendored Cavalry Web Player runtime
 * (see public/assets/libraries/cavalry/README.md).
 */
const cavalryPlayerTemplate = {
  scene: null
};

export default cavalryPlayerTemplate;
