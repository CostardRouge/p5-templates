export const EASING_FAMILIES = [
  "linear",
  "smoothstep",
  "sine",
  "quad",
  "cubic",
  "quart",
  "quint",
  "expo",
  "circ",
  "back",
  "elastic",
  "bounce"
] as const;

export type EasingFamily = ( typeof EASING_FAMILIES )[ number ];

// Families with no In/Out/InOut variants — their key is just the family name and
// the direction picker is hidden for them.
const DIRECTIONLESS_FAMILIES = new Set( [
  "linear",
  "smoothstep"
] );

export function isDirectionlessFamily( family: string ): boolean {
  return DIRECTIONLESS_FAMILIES.has( family );
}

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
  }
] as const;

export type EasingDirection = ( typeof EASING_DIRECTIONS )[ number ][ "value" ];

function capitalize( s: string ): string {
  return s.charAt( 0 ).toUpperCase() + s.slice( 1 );
}

export function buildEasingKey(
  direction: string, family: string
): string {
  if ( isDirectionlessFamily( family ) ) {
    return family;
  }
  return `ease${ direction }${ capitalize( family ) }`;
}

export function parseEasingKey( key: string ): {
  direction: EasingDirection;
  family: EasingFamily;
} {
  if ( !key || isDirectionlessFamily( key ) ) {
    return {
      direction: "In",
      family: ( key || "linear" ) as EasingFamily
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
