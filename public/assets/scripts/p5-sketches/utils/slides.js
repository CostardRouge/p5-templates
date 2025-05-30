import {
  captureOptions as options
} from "./index.js";

const slides = {
  currentIndex: 6,
  get maxIndex() {
    return options?.slides?.length;
  },
  get previous() {
    return slides.getSlide( slides.currentIndex - 1 );
  },
  get current() {
    return slides.getSlide( slides.currentIndex );
  },
  get next() {
    return slides.getSlide( slides.currentIndex + 1 );
  },
  getSlide( index ) {
    return options?.slides?.[ index % options?.slides?.length ];
  }
};

export default slides;
