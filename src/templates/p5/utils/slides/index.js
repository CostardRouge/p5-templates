import options, {
  syncEffectivePrevious
} from "../options.js";
import events from "../events.js";
import sketch, {
  getContainer, getP5
} from "../sketch.js";

import {
  _layouts
} from "./layouts";

import getMontageSketch from "./morph/index.js";

import {
  coerceFramerate
} from "../framerate.js";

import {
  mergeSlideOverride
} from "@/lib/effectiveSlideSettings";

// Safe modulo that wraps negatives too
const wrap = (
  i, n
) => ( ( i % n ) + n ) % n;

const slides = {
  index: 0,

  registerEvents() {
    events.register(
      "pre-draw",
      () => {
        if ( options?.slides && options?.slides.length ) {
          getP5()?.clear();
        }
      }
    );

    events.register(
      "post-draw",
      () => {
        slides.renderCurrentSlide();
        slides.render( options );
      }
    );

    events.register(
      "post-draw",
      () => {
        const container = getContainer();
        const canvas = container?.querySelector( "canvas" ) ?? document.querySelector( "canvas.p5Canvas" );

        if ( !canvas ) {
          return;
        }

        if ( !slides.hasSlides ) {
          slides.index = null;
        } else if ( slides.index == null ) {
          // Recover from the add-first-slide race: React calls setSlide(0)
          // before the new slide reaches the option store, so the very next
          // post-draw (store still slide-less) nulled the index. Rendering
          // coerces null→0 so it looks fine, but the effective-settings
          // resolution (per-slide animation/size overrides) stays stuck on
          // the globals until the index is restored.
          slides.setSlide( 0 );
        }

        // dataset values are strings — compare like-for-like or the guard
        // never matches and the attribute is rewritten every frame.
        const datasetIndex = String( slides.index );

        if ( canvas.dataset.slide !== datasetIndex ) {
          canvas.dataset.slide = datasetIndex;
        }
      }
    );
  },

  get count() {
    return Array.isArray( options?.slides ) ? options.slides.length : 0;
  },

  get hasSlides() {
    return this.count > 0;
  },

  get previous() {
    if ( !this.hasSlides ) {
      return undefined;
    }

    return this.getSlide( this.index - 1 );
  },

  get current() {
    if ( !this.hasSlides ) {
      return undefined;
    }

    return this.getSlide( this.index );
  },

  get next() {
    if ( !this.hasSlides ) {
      return undefined;
    }

    return this.getSlide( this.index + 1 );
  },

  getSlide( index = this.index ) {
    const n = this.count;

    if ( !n ) {
      return undefined;
    }

    const idx = wrap(
      Number( index ) || 0,
      n
    ); // ensure number + wrap

    return options.slides[ idx ];
  },

  setSlide( index ) {
    this.index = index;
    this.applyEffectiveSettings();
  },

  /**
   * Apply the effective size/animation for the current slide.
   * Called after switching slides so the engine updates immediately.
   */
  applyEffectiveSettings() {
    const slide = this.current;
    const effectiveSize = mergeSlideOverride(
      options?.size,
      slide?.size
    );
    const effectiveAnimation = mergeSlideOverride(
      options?.animation,
      slide?.animation
    );

    if ( effectiveSize?.width && effectiveSize?.height ) {
      events.handle(
        "engine-resize-canvas",
        effectiveSize.width,
        effectiveSize.height
      );
    }

    // Coerced: a string framerate would pass a bare `> 0` check and then be
    // silently ignored by p5's frameRate(), leaving the loop on the old rate.
    const framerate = coerceFramerate( effectiveAnimation?.framerate );

    if ( framerate !== null ) {
      events.handle(
        "engine-framerate-change",
        framerate
      );
    }

    // The engine clock (animation.progression, the animation bridge,
    // window.get/setAnimationProgression) reads duration from
    // sketch.sketchOptions.animation — not from the option store. Without
    // this write a per-slide duration override would never reach the
    // running sketch: syncEffectivePrevious below updates the comparison
    // baseline, so the next handleOptionsChange wouldn't apply it either.
    if ( effectiveAnimation && sketch.sketchOptions ) {
      sketch.sketchOptions.animation = {
        ...sketch.sketchOptions.animation,
        ...effectiveAnimation
      };
    }

    // Keep previousOptions in options.js in sync so the next
    // handleOptionsChange comparison doesn't re-fire stale events.
    syncEffectivePrevious(
      effectiveSize,
      effectiveAnimation
    );
  },

  render( source ) {
    // Pass the source straight through. For global content `source` is the
    // live options proxy; destructuring/spreading it would drop every key
    // (its target is empty and it has only a get trap), silently discarding
    // global `content`. freeLayout reads `.content` via the get trap instead.
    // ( _layouts[ source?.layout ] ?? _layouts.auto )( source );
    _layouts.free( source );
  },

  renderCurrentSlide() {
    const slide = this.current;

    if ( !slide ) {
      return;
    }
    this.render( slide );
  },

  /**
   * Get merged sketch settings for the current slide
   * Merges global sketch settings with slide-specific settings
   * Slide settings override global settings
   * @param {object} optionsTarget - The raw options object (to avoid proxy recursion)
   */
  getSketchSettings( optionsTarget ) {
    const globalSketch = optionsTarget?.sketch || {};
    const currentSlide = this.current;

    // Montage slide: morph the OTHER slides' params instead of using this
    // slide's own. Single injection point — the running sketch and any
    // specs/HUD overlay that reads options.sketch both see interpolated values.
    if ( currentSlide?.transition?.enabled ) {
      const montage = getMontageSketch(
        globalSketch,
        currentSlide,
        optionsTarget?.slides || []
      );

      if ( montage ) {
        return montage;
      }
    }

    const slideSketch = currentSlide?.sketch || {};

    return {
      ...globalSketch,
      ...slideSketch
    };
  }
};

// Public helpers used by React
window.setSlide = ( index ) => {
  slides.setSlide( index );
};
window.getSlide = ( index ) => slides.getSlide( index );
window.getCurrentSlide = () => ( {
  slide: slides.current,
  index: slides.index
} );
window.getSketchSettings = ( optionsTarget ) =>
  slides.getSketchSettings( optionsTarget );

window.slides = slides;

export default slides;
