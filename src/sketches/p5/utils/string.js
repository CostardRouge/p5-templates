import cache from "./cache.js";
import {
  getP5
} from "./sketch.js";
import {
  loadFontAsset
} from "./assetLoaders.js";

const string = {
  fonts: {
    loaded: {},
    // Per-key promises resolving with the font once it's actually parsed.
    ready: {},
    loadFont: (
      key, path
    ) => {
      if ( !string.fonts.loaded[ key ] ) {
        const {
          font,
          ready
        } = loadFontAsset(
          path,
          key
        );

        string.fonts.loaded[ key ] = font;
        string.fonts.ready[ key ] = ready;
      }

      return string.fonts.loaded[ key ];
    },
    /**
     * Resolves once every font requested so far has settled. Sketches can
     * `await string.fonts.whenLoaded()` in setup after touching the getters.
     */
    whenLoaded: () => {
      return Promise.allSettled( Object.values( string.fonts.ready ) );
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
    }
  },
  applyFontStyle: function( {
    graphics = getP5(),
    blendMode,
    size,
    font,
    fill,
    textWrap,
    stroke,
    strokeWeight,
    textAlign
  } ) {
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
    graphics.textWrap( textWrap );
  },
  write: function(
    str, x, y, options = {}
  ) {
    if ( !str ) {
      return;
    }

    const p = getP5();

    options.size ??= 18;
    options.strokeWeight ??= 2;
    options.stroke ??= 255;
    options.fill ??= 0;
    options.font ??= string.fonts.serif;
    options.graphics ??= p;
    options.textWidth ??= options.graphics.width;
    options.textHeight ??= -1;
    options.showBox ??= false;
    options.showLines ??= false;
    options.popPush ??= true;
    options.blendMode ??= undefined;
    options.textWrap ??= p.WORD;
    options.textAlign ??= [];

    const {
      size,
      font,
      graphics,
      textWidth,
      textHeight,
      showBox,
      showLines,
      popPush
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

    string.applyFontStyle( options );

    const box = font.textBounds(
      str,
      x,
      y,
      size
    );
    const asc = p.int( p.textAscent() * 0.8 );
    const desc = p.int( p.textDescent() * 0.8 );

    if ( showLines ) {
      graphics.push();
      // translate(position.x, position.y)
      graphics.line(
        -graphics.width / 2,
        position.y - asc,
        graphics.width / 2,
        position.y - asc
      );
      graphics.line(
        -graphics.width / 2,
        position.y + desc,
        graphics.width / 2,
        position.y + desc
      );
      graphics.line(
        -graphics.width / 2,
        position.y,
        graphics.width,
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
  // Stable signature for a set of text points, independent of `position`.
  // Mirrors the raw-points cache key used by getTextPoints so callers (e.g.
  // gridMask) can key their own caches on the same geometry without drift.
  textPointsSignature: ( {
    text,
    size,
    font,
    sampleFactor = 1,
    simplifyThreshold = 0
  } ) => {
    const fontFamily = font?.font?.names?.fontFamily?.en || "unknown";

    return cache.key(
      text,
      fontFamily,
      "text-points-raw",
      sampleFactor,
      size,
      simplifyThreshold
    );
  },
  getTextPoints: ( {
    text,
    size,
    font,
    position = getP5().createVector(
      0,
      0
    ),
    sampleFactor = 1,
    simplifyThreshold = 0
  } ) => {
    // Guard clause: Return an empty array to prevent downstream errors
    if ( !font?.font ) {
      return [];
    }

    // This cache key is for the RAW, (0,0)-based points.
    // It now correctly includes *all* parameters that define the geometry.
    // 'position' is intentionally EXCLUDED from this key.
    const rawPointsCacheKey = string.textPointsSignature( {
      text,
      size,
      font,
      sampleFactor,
      simplifyThreshold
    } );

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
            simplifyThreshold
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
            y: yCenter
          }
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
    // 2D only: textToPoints' alpha is a large value (~90); using it as z
    // poisons point.dist(cellVector) in the grid sketches, zeroing alpha.
    return data.rawPoints.map( ( {
      x, y
    } ) => getP5().createVector(
      x + offsetX,
      y + offsetY
    ) );
  }
};

export default string;
