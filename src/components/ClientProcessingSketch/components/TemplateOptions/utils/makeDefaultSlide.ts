import {
  SlideOption, SlideSchema
} from "@/types/sketch.types";
import {
  indexToLetters
} from "@/utils/slideNaming";

export default function makeDefaultSlide( {
  indexForLabel,
  sketch,
  size,
  animation
}: {
  indexForLabel: number;
  sketch: any; // sschhhhh
  size?: { width: number;
    height: number };
  animation?: { framerate: number;
    duration: number };
} ): SlideOption {
  return SlideSchema.parse( {
    name: indexToLetters( indexForLabel ),
    sketch,
    size,
    animation
  } );
}
