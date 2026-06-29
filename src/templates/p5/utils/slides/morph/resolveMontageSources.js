/**
 * Resolve a montage slide's `transition` config to the ordered list of source
 * slides it morphs between.
 *
 *   - "all":      every OTHER slide that is not itself a montage, in deck order.
 *   - "selected": the slides named in `slideIds`, in that order.
 *
 * The montage slide is always excluded (no self-reference), and unknown /
 * deleted ids are dropped. Pure: array operations only, unit-testable in node.
 */
export default function resolveMontageSources(
  montageSlide, allSlides
) {
  const transition = montageSlide?.transition;
  const slides = Array.isArray( allSlides ) ? allSlides : [];

  if ( !transition ) {
    return [];
  }

  if ( transition.sources === "selected" ) {
    const ids = Array.isArray( transition.slideIds ) ? transition.slideIds : [];

    return ids
      .map( ( id ) => slides.find( ( slide ) => slide && slide.id === id ) )
      .filter( ( slide ) => slide && slide.id !== montageSlide.id );
  }

  // "all" (default): other, non-montage slides in deck order.
  return slides.filter( ( slide ) =>
    slide &&
      slide.id !== montageSlide.id &&
      !slide.transition?.enabled );
}
