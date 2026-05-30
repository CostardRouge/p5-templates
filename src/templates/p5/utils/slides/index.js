import options, {
  syncEffectivePrevious
} from "../options.js";
import events from "../events.js";
import {
  getContainer, getP5
} from "../sketch.js";

import {
  _layouts
} from "./layouts";

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
        }

        if ( canvas.dataset.slide !== slides.index ) {
          canvas.dataset.slide = slides.index;
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
    const effectiveSize = slide?.size ?? options?.size;
    const effectiveAnimation = slide?.animation ?? options?.animation;

    if ( effectiveSize?.width && effectiveSize?.height ) {
      events.handle(
        "engine-resize-canvas",
        effectiveSize.width,
        effectiveSize.height
      );
    }

    if ( effectiveAnimation?.framerate && effectiveAnimation.framerate > 0 ) {
      events.handle(
        "engine-framerate-change",
        effectiveAnimation.framerate
      );
    }

    // Keep previousOptions in options.js in sync so the next
    // handleOptionsChange comparison doesn't re-fire stale events.
    syncEffectivePrevious(
      effectiveSize,
      effectiveAnimation
    );
  },

  render( {
    layout, ...opts
  } ) {
    // ( _layouts[ layout ] ?? _layouts.auto )( opts );
    _layouts.free( opts );
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
