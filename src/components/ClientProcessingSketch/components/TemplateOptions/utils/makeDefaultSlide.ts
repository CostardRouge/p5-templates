import {
  SlideOption, SlideSchema
} from "@/types/sketch.types";

export default function makeDefaultSlide( {
  indexForLabel
}: {
  indexForLabel: number
} ): SlideOption {
  return SlideSchema.parse( {
    name: `Slide ${ indexForLabel + 1 }`
  } );
}