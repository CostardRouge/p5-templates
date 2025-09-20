// slides.js (p5 side)
import {
  captureOptions as options, events
} from "../index.js";
import {
  _layouts
} from "./layouts/_layouts.js";

// Safe modulo that wraps negatives too
const wrap = (
  i, n
) => ( ( i % n ) + n ) % n;

const slides = {
  index: 0,

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
  },

  render( {
    layout, ...opts
  } ) {
    // ( _layouts[ layout ] ?? _layouts.auto )( opts );
    ( _layouts.free )( opts );
  },

  renderCurrentSlide() {
    const slide = this.current;

    if ( !slide ) {
      return;
    }
    this.render( slide );
  },
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

window.slides = slides;

events.register(
  "pre-draw",
  () => {
    clear();
  }
);

events.register(
  "post-draw",
  () => {
    slides.renderCurrentSlide();
    slides.render( options );
  }
);

export default slides;
