import {
  captureOptions as options,
  events
} from "./index.js";

function registerEvents() {
  if ( !options?.slides || options?.slides?.length === 0 ) {
    return;
  }

  events.register(
    "pre-setup",
    () => {
      const slideNames = options?.slides?.map( (
        {
          template, title
        }, index
      ) => `${ index + 1 } · ${ title ?? template }` );

      console.log( {
        slideNames,
        options
      } );

      slides.select = createSelect();

      slideNames.forEach( (
        slideName, slideIndex
      ) => slides.select.option(
        slideName,
        slideIndex
      ) );
      slides.select.selected( slideNames[ slides.index ] );
      slides.select.parent( document.querySelector( "main" ) );
    }
  );

  events.register(
    "pre-draw",
    () => {
      const selectedSlideIndex = Number( slides.select.value() );

      if ( slides.index === selectedSlideIndex ) {
        return;
      }

      slides.setSlide( selectedSlideIndex );
    }
  );
}

const slides = {
  index: 0,
  select: undefined,

  get count() {
    return options?.slides?.length;
  },
  get previous() {
    return slides.getSlide( slides.index - 1 );
  },
  get current() {
    return slides.getSlide( slides.index );
  },
  get next() {
    return slides.getSlide( slides.index + 1 );
  },
  getSlide( index = slides.index ) {
    return options?.slides?.[ index % slides.count ];
  },
  setSlide( index ) {
    slides.index = index;
  }
};

registerEvents();

window.setSlide = index => slides.select.selected( index );

export default slides;
