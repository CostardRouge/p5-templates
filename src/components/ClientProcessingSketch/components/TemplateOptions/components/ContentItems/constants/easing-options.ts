export const EASING_FAMILIES = [
  "linear",
  "sine",
  "quad",
  "cubic",
  "quart",
  "quint",
  "expo",
  "circ",
  "back",
  "elastic",
  "bounce",
] as const;

export type EasingFamily = ( typeof EASING_FAMILIES )[number];

export const EASING_DIRECTIONS = [
  {
    label: "In",
    value: "In"
  },
  {
    label: "Out",
    value: "Out"
  },
  {
    label: "In-Out",
    value: "InOut"
  },
] as const;

export type EasingDirection = ( typeof EASING_DIRECTIONS )[number]["value"];

function capitalize( s: string ): string {
  return s.charAt( 0 ).toUpperCase() + s.slice( 1 );
}

export function buildEasingKey(
  direction: string, family: string
): string {
  if ( family === "linear" ) return "linear";
  return `ease${ direction }${ capitalize( family ) }`;
}

export function parseEasingKey( key: string ): {
  direction: EasingDirection;
  family: EasingFamily;
} {
  if ( !key || key === "linear" ) {
    return {
      direction: "In",
      family: "linear"
    };
  }

  // Match pattern: ease(In|Out|InOut)(Family)
  const match = key.match( /^ease(InOut|In|Out)(.+)$/ );

  if ( !match ) {
    return {
      direction: "In",
      family: "linear"
    };
  }

  const direction = match[ 1 ] as EasingDirection;
  const family = match[ 2 ].toLowerCase() as EasingFamily;

  return {
    direction,
    family
  };
}
