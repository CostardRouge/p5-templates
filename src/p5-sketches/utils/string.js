import cache from "./cache.js";

const string = {
  fonts: {
    loaded: {
    },
    loadFont: (
      key, path
    ) => {
      return (
        string.fonts.loaded[ key ] ?? ( string.fonts.loaded[ key ] = loadFont( path ) )
      );
    },
    get loraItalic() {
      return string.fonts.loadFont(
        "lora-italic",
        "/assets/fonts/lora-italic.ttf"
      );
    },
    get loraRegular() {
      return string.fonts.loadFont(
        "lora-regular",
        "/assets/fonts/lora-regular.ttf"
      );
    },
    get spaceMonoItalic() {
      return string.fonts.loadFont(
        "spacemono-italic",
        "/assets/fonts/spacemono-italic.ttf"
      );
    },
    get spaceMonoRegular() {
      return string.fonts.loadFont(
        "spacemono-regular",
        "/assets/fonts/spacemono-regular.ttf"
      );
    },
    get serif() {
      return string.fonts.loadFont(
        "libre-baskerville",
        "/assets/fonts/libre-baskerville.ttf"
      );
    },
    get sans() {
      return string.fonts.loadFont(
        "sans",
        "/assets/fonts/passion-one.ttf"
      );
    },
    get openSans() {
      return string.fonts.loadFont(
        "openSans",
        "/assets/fonts/open-sans.ttf"
      );
    },
    get tilt() {
      return string.fonts.loadFont(
        "tilt",
        "/assets/fonts/tilt-prism.ttf"
      );
    },
    get stardom() {
      return string.fonts.loadFont(
        "stardom",
        "/assets/fonts/stardom.ttf"
      );
    },
    get multicoloure() {
      return string.fonts.loadFont(
        "multicoloure",
        "/assets/fonts/multicoloure.ttf"
      );
    },
    get martian() {
      return string.fonts.loadFont(
        "martian",
        "/assets/fonts/martian.ttf"
      );
    },
    get cloitre() {
      return string.fonts.loadFont(
        "cloitre",
        "/assets/fonts/cloitre.ttf"
      );
    },
    get agiro() {
      return string.fonts.loadFont(
        "agiro",
        "/assets/fonts/agiro.otf"
      );
    },
    get peix() {
      return string.fonts.loadFont(
        "peix",
        "/assets/fonts/peix.ttf"
      );
    },
    get onlysansVariable() {
      return string.fonts.loadFont(
        "onlysans-variable",
        "/assets/fonts/onlysans-variable.ttf"
      );
    },
    get waverseVariable() {
      return string.fonts.loadFont(
        "waverse-variable",
        "/assets/fonts/waverse-variable.ttf"
      );
    },
  },
  write: function(
    str, x, y, options = {
    }
  ) {
    if ( !str ) {
      return;
    }

    const {
      size = 18,
      fill = 0,
      stroke = 255,
      strokeWeight = 2,
      font = string.fonts.serif,
      graphics = window,
      textWidth = graphics.width,
      textHeight = -1,
      showBox = false,
      showLines = false,
      textAlign = [
      ],
      blendMode = undefined,
      popPush = true,
    } = options;

    if ( !font?.font ) {
      return;
    }

    const position = graphics.createVector(
      x,
      y
    );

    if ( popPush ) {
      graphics.push();
    }

    if ( blendMode ) {
      graphics.blendMode( blendMode );
    }

    if ( stroke ) {
      graphics.stroke( stroke );
    }

    if ( fill ) {
      graphics.fill( fill );
    }

    graphics.strokeWeight( strokeWeight );
    graphics.textSize( size );
    graphics.textFont?.( font );
    graphics.textAlign( ...textAlign );
    graphics.textWrap( WORD );

    const box = font.textBounds(
      str,
      x,
      y,
      size
    );
    const asc = int( textAscent() * 0.8 );
    const desc = int( textDescent() * 0.8 );

    if ( showLines ) {
      graphics.push();
      // translate(position.x, position.y)
      graphics.line(
        -width / 2,
        position.y - asc,
        width / 2,
        position.y - asc
      );
      graphics.line(
        -width / 2,
        position.y + desc,
        width / 2,
        position.y + desc
      );
      graphics.line(
        -width / 2,
        position.y,
        width,
        position.y
      ); // baseline
      graphics.pop();
    }

    if ( showBox ) {
      graphics.push();
      // translate(position.x, position.y)
      graphics.stroke( 255 );
      graphics.strokeWeight( 1 );
      graphics.noFill();
      // rect( 0, 0, box.w, -box.h )
      graphics.rect(
        box.x,
        box.y,
        box.w,
        box.h
      );

      graphics.pop();
    }

    const textParams = [
      str,
      position.x,
      position.y
    ];

    if ( textWidth !== -1 ) {
      textParams.push( textWidth );
    } else {
      textParams.push( undefined );
    }

    if ( textHeight !== -1 ) {
      textParams.push( textHeight );
    }

    graphics.text( ...textParams );

    if ( popPush ) {
      graphics.pop();

      graphics.blendMode( "source-over" );
    }

    return box;
  },
  getTextPoints: ( {
    text,
    size,
    font,
    position = createVector(
      0,
      0
    ),
    sampleFactor = 1,
    simplifyThreshold = 0,
  } ) => {
    // Guard clause: Return an empty array to prevent downstream errors
    if ( !font?.font ) {
      return [
      ];
    }

    const fontFamily = font.font?.names?.fontFamily?.en || "unknown";

    // This cache key is for the RAW, (0,0)-based points.
    // It now correctly includes *all* parameters that define the geometry.
    // 'position' is intentionally EXCLUDED from this key.
    const rawPointsCacheKey = cache.key(
      text,
      fontFamily,
      "text-points-raw", // More specific key name
      sampleFactor,
      size,
      simplifyThreshold // BUG FIX: Added missing parameter
    );

    // Get or create the raw points and their center.
    // This is the computationally expensive part, so we cache it.
    const data = cache.store(
      rawPointsCacheKey,
      () => {
        const rawPoints = font.textToPoints(
          text,
          0, // BUG FIX: Always get raw points at the (0, 0) origin
          0, // BUG FIX: Always get raw points at the (0, 0) origin
          size,
          {
            sampleFactor,
            simplifyThreshold,
          }
        );

        // Find the bounds of the raw points
        const xMin = rawPoints.reduce(
          (
            a, {
              x
            }
          ) => Math.min(
            a,
            x
          ),
          Infinity
        );
        const xMax = rawPoints.reduce(
          (
            a, {
              x
            }
          ) => Math.max(
            a,
            x
          ),
          -Infinity
        );
        const xCenter = ( xMax + xMin ) / 2; // Simpler calculation

        const yMin = rawPoints.reduce(
          (
            a, {
              y
            }
          ) => Math.min(
            a,
            y
          ),
          Infinity
        );
        const yMax = rawPoints.reduce(
          (
            a, {
              y
            }
          ) => Math.max(
            a,
            y
          ),
          -Infinity
        );
        const yCenter = ( yMax + yMin ) / 2; // Simpler calculation

        // Store the raw points AND their calculated center
        return {
          rawPoints,
          center: {
            x: xCenter,
            y: yCenter,
          },
        };
      }
    );

    // --- This part is now fast and runs every time ---

    // Calculate the offset needed to move the text's *true* center
    // to the *desired* position.
    const offsetX = position.x - data.center.x;
    const offsetY = position.y - data.center.y;

    // Map the raw points to their final, centered positions.
    // This is a simple, fast operation.
    return data.rawPoints.map( ( {
      x, y, alpha
    } ) => {
      // Create a new vector at the final position
      // Preserving the original's use of 'alpha' as the z-component
      return createVector(
        x + offsetX,
        y + offsetY,
        alpha
      );
    } );
  },
};

export default string;
