import type {
  SVGProps
} from "react";

/**
 * The GitHub mark. lucide-react 1.x removed every brand icon (including
 * `Github`), so it lives here instead. Props and default sizing mirror a
 * lucide icon so it drops into the same call sites — note lucide strokes its
 * icons while a brand mark is a filled path, hence `fill="currentColor"` and
 * no stroke attributes.
 */
export default function GithubIcon( {
  size = 24, ...props
}: SVGProps<SVGSVGElement> & { size?: number | string } ) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={ size }
      height={ size }
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      { ...props }
    >
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5 1-.11-.78-.42-1.31-.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.31-.54-1.52.12-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.24 2.87.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.63-5.48 5.92.42.36.81 1.1.81 2.22v3.29c0 .32.21.7.82.58C20.57 22.29 24 17.8 24 12.5 24 5.87 18.63.5 12 .5Z" />
    </svg>
  );
}
