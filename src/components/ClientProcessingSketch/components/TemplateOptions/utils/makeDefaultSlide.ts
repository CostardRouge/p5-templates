import {
  SlideOption, SlideSchema
} from "@/types/sketch.types";

export default function makeDefaultSlide( {
  name,
  sketch,
  size,
  animation
}: {
  name: string;
  sketch: any; // sschhhhh
  size?: { width: number;
    height: number };
  animation?: { framerate: number;
    duration: number };
} ): SlideOption {
  return SlideSchema.parse( {
    name,
    sketch,
    size,
    animation
  } );
}
