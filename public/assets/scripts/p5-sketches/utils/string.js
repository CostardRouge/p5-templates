import cache from "./cache.js";

const string = {
  fonts: {
    loaded: {
    },
    loadFont: (
      key, path
    ) => {
      return string.fonts.loaded[ key ] ?? ( string.fonts.loaded[ key ] = loadFont( path ) );
    },
    get serif() {
      return string.fonts.loadFont(
        "serif",
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
  },
  write: function(
    str,
    x,
    y,
    options = {
    }
  ) {
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
    }

    if ( textHeight !== -1 ) {
      textParams.push( textHeight );
    }

    graphics.text( ...textParams );

    if ( popPush ) {
      graphics.pop();
    }
  },
  getTextPoints: ( {
    text, size, font, position = createVector(
      0,
      0
    ), sampleFactor = 1, simplifyThreshold = 0
  } ) => {
    if ( !font?.font ) {
      return;
    }

    const fontFamily = font.font?.names?.fontFamily?.en;
    const textPointsCacheKey = cache.key(
      text,
      fontFamily,
      "text-points",
      sampleFactor,
      size
    );

    return cache.store(
      textPointsCacheKey,
      () => {
        const textPoints = font.textToPoints(
          text,
          position.x,
          position.y,
          size,
          {
            sampleFactor,
            simplifyThreshold
          }
        );

        const xMin = textPoints.reduce(
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
        const xMax = textPoints.reduce(
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
        const xCenter = ( xMax / 2 ) + ( xMin / 2 );

        const yMin = textPoints.reduce(
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
        const yMax = textPoints.reduce(
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
        const yCenter = ( yMax / 2 ) + ( yMin / 2 );

        return textPoints.map( ( {
          x, y
        } ) => {
          const testPointVector = createVector(
            x,
            y
          );

          testPointVector.add(
            ( position.x - xCenter ), (
              position.y - yCenter )
          );

          return testPointVector;
        } );
      }
    );
  }
};

export default string;
