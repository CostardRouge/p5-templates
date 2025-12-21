import string from "../string.js";
import animation from "../animation.js";
import options from "@/p5/utils/options.js";

/**
 * Get font from string.fonts
 */
const getFont = ( fontKey ) => {
  return ( string.fonts && string.fonts[ fontKey ] ) || string.fonts.martian;
};

const parseFloatDefault = (
  value, _default = 0.015
) => {
  const float = Number.parseFloat( value );

  if ( Number.isFinite( float ) ) {
    return float;
  }

  return _default;
};

/**
 * Render title with standard configuration
 * @param {object} titleConfig
 * @param {string} fallbackName - Fallback name if no custom title provided
 */
export default function renderTitle(
  titleConfig = {
  },
  fallbackName = options.name
) {
  // Check if title should be shown
  const show = titleConfig.show ?? false;

  if ( !show ) {
    return;
  }

  // Check if within display window
  const displayFrom = titleConfig.displayFrom ?? 0.0;
  const displayTo = titleConfig.displayTo ?? 0.2;
  const withinWindow =
    animation.progression >= displayFrom && animation.progression <= displayTo;

  if ( !withinWindow ) {
    return;
  }

  // Get title content
  const customText = titleConfig.content?.trim?.() || "";
  const defaultText = ( fallbackName || "" ).toUpperCase().replaceAll(
    "-",
    "\n"
  );
  const text = customText !== "" ? customText : defaultText;

  if ( !text ) {
    return;
  }

  // Get font
  const font = getFont( titleConfig.font || "martian" );

  // Get colors
  const fillColor = titleConfig.fill || [
    0,
    0,
    0
  ];
  const strokeColor = titleConfig.stroke || [
    255,
    255,
    255
  ];

  const horizontalMargin = parseFloatDefault( titleConfig.margin.horizontal );
  const verticalMargin = parseFloatDefault( titleConfig.margin.vertical );

  string.write(
    text,
    width * horizontalMargin + width * titleConfig.position.x,
    height * verticalMargin + height * titleConfig.position.y,
    {
      size: titleConfig.size ?? 128,
      stroke: color( ...strokeColor ),
      fill: color( ...fillColor ),
      strokeWeight: titleConfig.strokeWeight ?? 0,
      font: font,
      textAlign: [
        titleConfig.alignment?.horizontal ?? "center",
        titleConfig.alignment?.vertical ?? "center",
      ],
      blendMode: titleConfig.blend || "exclusion",
      textWidth: width - 2 * horizontalMargin,
      textHeight: height - 2 * verticalMargin,
    }
  );
}
