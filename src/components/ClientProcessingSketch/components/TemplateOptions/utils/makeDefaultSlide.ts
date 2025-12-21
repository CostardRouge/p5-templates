import {
  SlideOption, SlideSchema
} from "@/types/sketch.types";

export default function makeDefaultSlide( {
  indexForLabel,
  sketch,
}: {
  indexForLabel: number;
  sketch: any; // sschhhhh
} ): SlideOption {
  return SlideSchema.parse( {
    name: `Slide ${ indexForLabel + 1 }`,
    sketch,
  } );
}
