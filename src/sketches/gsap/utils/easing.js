/**
 * Easing helpers for GSAP/HTML templates.
 *
 * The studio's `easing` form control stores keys in the p5-flavoured format
 * (`easeInOutCubic`, `easeOutBack`, `linear`, …). GSAP expects its own ease
 * ids (`power2.inOut`, `back.out`, `none`, …), so `toGsapEase` bridges the two
 * and lets a template feed an `ease` option straight into a tween.
 */

const FAMILY_TO_GSAP = {
  linear: "none",
  sine: "sine",
  quad: "power1",
  cubic: "power2",
  quart: "power3",
  quint: "power4",
  expo: "expo",
  circ: "circ",
  back: "back",
  elastic: "elastic",
  bounce: "bounce"
};

const DIRECTION_TO_GSAP = {
  In: "in",
  Out: "out",
  InOut: "inOut"
};

/**
 * Convert a studio easing key to a GSAP ease string.
 *
 *   toGsapEase( "easeInOutCubic" ) // "power2.inOut"
 *   toGsapEase( "easeOutBack" )    // "back.out"
 *   toGsapEase( "linear" )         // "none"
 */
export function toGsapEase(
  key, fallback = "power2.out"
) {
  if ( !key || key === "linear" ) {
    return key === "linear" ? "none" : fallback;
  }

  const match = String( key ).match( /^ease(InOut|In|Out)(.+)$/ );

  if ( !match ) {
    return fallback;
  }

  const [
    , direction,
    familyRaw
  ] = match;
  const family = familyRaw.charAt( 0 ).toLowerCase() + familyRaw.slice( 1 );
  const gsapFamily = FAMILY_TO_GSAP[ family ];

  if ( !gsapFamily ) {
    return fallback;
  }

  if ( gsapFamily === "none" ) {
    return "none";
  }

  return `${ gsapFamily }.${ DIRECTION_TO_GSAP[ direction ] ?? "out" }`;
}
