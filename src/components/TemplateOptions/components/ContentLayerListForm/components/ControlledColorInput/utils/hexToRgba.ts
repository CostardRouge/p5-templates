/**
 * Converts a #RRGGBB hex string to an [r, g, b, a] array.
 * Alpha is always set to 255 (fully opaque).
 */
export default function hexToRgba( hex: string ): [number, number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec( hex );

  if ( !result ) {
    return [
      0,
      0,
      0,
      255
    ];
  }

  return [
    parseInt(
      result[ 1 ],
      16
    ),
    parseInt(
      result[ 2 ],
      16
    ),
    parseInt(
      result[ 3 ],
      16
    ),
    255, // Default alpha
  ];
}