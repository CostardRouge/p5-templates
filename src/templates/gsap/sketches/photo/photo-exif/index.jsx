"use client";

/**
 * Photo EXIF — an editorial "spec sheet" for a single photograph.
 *
 * The photo is presented with the camera settings it was actually shot with —
 * ISO, shutter speed, aperture, focal length, lens and the friendly camera
 * name — read straight from the file's EXIF metadata (reusing the shared
 * reader + friendly-name maps from the p5 engine).
 *
 * Three editorial layouts arrange the same building blocks differently:
 *   • editorial — header + photo + a ruled spec strip on a paper margin,
 *   • overlay   — full-bleed photo with the type laid over scrims,
 *   • minimal   — full-bleed photo with one stacked block in the corner.
 *
 * Motion is a parametrable, staggered reveal of the metadata plus a slow Ken
 * Burns drift on the photo. Both are built as "in → hold → out" tweens that
 * fill the whole loop and end where they start, so playback wraps seamlessly
 * (the same model the other GSAP templates use).
 */
import {
  useTimeline,
  toCssColor,
  toGsapEase,
  resolveImages,
  imageAt,
  imageFilterCss,
  boxShadowCss
} from "@/gsap/utils";
import {
  exif, useExif
} from "@/gsap/utils/exif";

/** System font stacks — kept generic so they survive the DOM→canvas capture. */
const FONT_STACKS = {
  serif: "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif",
  sans: "'Helvetica Neue', Helvetica, Arial, system-ui, -apple-system, sans-serif",
  mono: "'SFMono-Regular', 'SF Mono', Menlo, Consolas, 'Liberation Mono', 'Courier New', monospace"
};

function fontFamily( key ) {
  return FONT_STACKS[ key ] ?? FONT_STACKS.sans;
}

/** Raw asset path for a slot (wrapping circularly), for the filename label. */
function imagePathAt(
  images, index
) {
  if ( !Array.isArray( images ) || images.length === 0 ) {
    return "";
  }

  const wrapped = ( ( index % images.length ) + images.length ) % images.length;
  const entry = images[ wrapped ];

  if ( !entry ) {
    return "";
  }

  return typeof entry === "string" ? entry : ( entry.path ?? "" );
}

/**
 * The hidden / shown GSAP vars for a reveal style. Each pair is symmetric — the
 * "hidden" state is used at both ends of the loop — so the reveal is seamless
 * whatever style is picked.
 */
function revealVars(
  style, distance
) {
  if ( style === "fall" ) {
    return {
      hidden: {
        opacity: 0,
        y: -distance
      },
      shown: {
        opacity: 1,
        y: 0
      }
    };
  }

  if ( style === "left" ) {
    return {
      hidden: {
        opacity: 0,
        x: distance
      },
      shown: {
        opacity: 1,
        x: 0
      }
    };
  }

  if ( style === "right" ) {
    return {
      hidden: {
        opacity: 0,
        x: -distance
      },
      shown: {
        opacity: 1,
        x: 0
      }
    };
  }

  if ( style === "fade" ) {
    return {
      hidden: {
        opacity: 0
      },
      shown: {
        opacity: 1
      }
    };
  }

  if ( style === "scale" ) {
    return {
      hidden: {
        opacity: 0,
        scale: 0.86
      },
      shown: {
        opacity: 1,
        scale: 1
      }
    };
  }

  if ( style === "wipe" ) {
    return {
      hidden: {
        clipPath: "inset(0 100% 0 0)"
      },
      shown: {
        clipPath: "inset(0 0% 0 0)"
      }
    };
  }

  if ( style === "blur" ) {
    return {
      hidden: {
        opacity: 0,
        filter: "blur(14px)"
      },
      shown: {
        opacity: 1,
        filter: "blur(0px)"
      }
    };
  }

  // "rise" (default)
  return {
    hidden: {
      opacity: 0,
      y: distance
    },
    shown: {
      opacity: 1,
      y: 0
    }
  };
}

/** Build the bottom-strip specs (everything but the camera/date header). */
function buildStripSpecs(
  data, show
) {
  const specs = [];

  if ( show?.focal ) {
    specs.push( {
      id: "focal",
      label: "Focal",
      value: exif.formatFocalLength( data?.focalLength ) || ""
    } );
  }

  if ( show?.aperture ) {
    specs.push( {
      id: "aperture",
      label: "Aperture",
      value: exif.formatAperture( data?.aperture ) || ""
    } );
  }

  if ( show?.shutter ) {
    specs.push( {
      id: "shutter",
      label: "Shutter",
      value: exif.formatShutterSpeed( data?.shutterSpeed ) || ""
    } );
  }

  if ( show?.iso ) {
    specs.push( {
      id: "iso",
      label: "ISO",
      value: data?.iso ? String( data.iso ) : ""
    } );
  }

  if ( show?.lens ) {
    specs.push( {
      id: "lens",
      label: "Lens",
      value: exif.formatLensModel( data?.lens ) || ""
    } );
  }

  if ( show?.gps ) {
    specs.push( {
      id: "gps",
      label: "Where",
      value: exif.formatGPSCoordinates(
        data?.gps?.latitude,
        data?.gps?.longitude
      ) || ""
    } );
  }

  return specs;
}

export default function PhotoExif( {
  options
} ) {
  const sketch = options?.sketch ?? {};
  const size = options?.size ?? {
    width: 1080,
    height: 1350
  };

  const urls = resolveImages( options );
  const imageIndex = Math.round( sketch.imageIndex ?? 0 );
  const imageUrl = imageAt(
    urls,
    imageIndex
  );

  const data = useExif( imageUrl );

  const layout = sketch.layout ?? "editorial";
  const margin = sketch.margin ?? 80;
  const radius = sketch.cornerRadius ?? 16;
  const fit = sketch.imageFit ?? "cover";

  const background = toCssColor(
    sketch.backgroundColor,
    "#101012"
  );
  const text = toCssColor(
    sketch.textColor,
    "#edeae2"
  );
  const label = toCssColor(
    sketch.labelColor,
    "#929298"
  );
  const accent = toCssColor(
    sketch.accentColor,
    "#d85c3a"
  );

  const filter = imageFilterCss( sketch.imageEffect );
  const shadow = boxShadowCss( sketch.shadow );

  const typography = sketch.typography ?? {};
  const displayFamily = fontFamily( typography.displayFamily ?? "serif" );
  const valueFamily = fontFamily( typography.valueFamily ?? "mono" );
  const sansFamily = fontFamily( "sans" );
  const uppercaseLabels = typography.uppercaseLabels ?? true;
  const tracking = typography.letterSpacing ?? 0.14;
  const textScale = typography.sizeScale ?? 1;

  const frame = sketch.frame ?? {};
  const showBorder = frame.showBorder ?? true;
  const borderColor = toCssColor(
    frame.borderColor,
    "#48484e"
  );
  const borderWidth = frame.borderWidth ?? 1;

  const show = sketch.show ?? {};
  const caption = sketch.caption ?? "";
  const credit = sketch.credit ?? "";
  const cameraOverride = sketch.cameraOverride ?? "";

  const reveal = sketch.reveal ?? {};
  const revealEnabled = reveal.enabled ?? true;
  const revealStyle = reveal.style ?? "rise";
  const revealDistance = reveal.distance ?? 40;
  const holdFraction = Math.max(
    0,
    Math.min(
      0.9,
      reveal.hold ?? 0.34
    )
  );
  const staggerFraction = Math.max(
    0,
    Math.min(
      0.6,
      reveal.stagger ?? 0.12
    )
  );

  const photoMotion = sketch.photoMotion ?? {};
  const photoEnabled = photoMotion.enabled ?? true;
  const zoom = Math.max(
    0,
    photoMotion.zoom ?? 0.1
  );
  const panX = photoMotion.panX ?? 0.03;
  const panY = photoMotion.panY ?? -0.02;

  const imagePath = imagePathAt(
    sketch.images,
    imageIndex
  );
  const filename = imagePath
    ? decodeURIComponent( String( imagePath ).split( "/" ).pop() )
    : "";

  const cameraValue = cameraOverride
    || exif.formatCameraModel( data?.camera )
    || "";
  const dateValue = exif.formatPhotoDate( data?.date ) || "";
  const stripSpecs = buildStripSpecs(
    data,
    show
  );

  /* ---- derived geometry + type scale ----------------------------- */

  const unit = Math.min(
    size.width,
    size.height
  ) / 1000;
  const titleSize = 46 * textScale * unit;
  const dateSize = 17 * textScale * unit;
  const labelSize = 11.5 * textScale * unit;
  const valueSize = 22 * textScale * unit;
  const captionSize = 21 * textScale * unit;
  const footSize = 13 * textScale * unit;

  const stageGap = 28 * unit;
  const headerGap = 24 * unit;
  const stripGapRow = 22 * unit;
  const stripGapCol = 40 * unit;
  const cellGap = 8 * unit;
  const cellPadTop = 10 * unit;

  const headerJustify = show.camera ? "space-between" : "flex-end";
  const hasHeader = Boolean( show.camera || show.date );
  const hasCaptionRow = Boolean( caption || credit || ( show.filename && filename ) );
  const hasFooterBlock = stripSpecs.length > 0 || hasCaptionRow;

  /* ---- shared styles --------------------------------------------- */

  const titleStyle = {
    margin: 0,
    fontFamily: displayFamily,
    fontSize: titleSize,
    fontWeight: 600,
    lineHeight: 1.02,
    letterSpacing: "-0.01em",
    color: text
  };

  const dateStyle = {
    margin: 0,
    fontFamily: valueFamily,
    fontSize: dateSize,
    fontWeight: 500,
    letterSpacing: `${ tracking * 0.5 }em`,
    textTransform: uppercaseLabels ? "uppercase" : "none",
    color: label
  };

  const labelStyle = {
    margin: 0,
    fontFamily: sansFamily,
    fontSize: labelSize,
    fontWeight: 600,
    letterSpacing: `${ tracking }em`,
    textTransform: uppercaseLabels ? "uppercase" : "none",
    color: label
  };

  const valueStyle = {
    margin: 0,
    fontFamily: valueFamily,
    fontSize: valueSize,
    fontWeight: 500,
    lineHeight: 1.1,
    color: text
  };

  const captionStyle = {
    margin: 0,
    fontFamily: displayFamily,
    fontSize: captionSize,
    fontStyle: "italic",
    lineHeight: 1.2,
    color: text
  };

  const footStyle = {
    margin: 0,
    fontFamily: sansFamily,
    fontSize: footSize,
    fontWeight: 500,
    letterSpacing: `${ tracking * 0.6 }em`,
    textTransform: uppercaseLabels ? "uppercase" : "none",
    color: label
  };

  const cellStyle = {
    display: "flex",
    flexDirection: "column",
    gap: cellGap,
    paddingTop: cellPadTop,
    borderTop: `2px solid ${ accent }`,
    minWidth: 78 * unit
  };

  const imageStyle = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: fit,
    filter,
    transformOrigin: "center",
    willChange: "transform"
  };

  const frameStyle = {
    position: "relative",
    width: "100%",
    height: "100%",
    borderRadius: radius,
    overflow: "hidden",
    background: "#15151a",
    boxShadow: shadow,
    border: showBorder ? `${ borderWidth }px solid ${ borderColor }` : "none",
    boxSizing: "border-box"
  };

  const fullFrameStyle = {
    position: "absolute",
    inset: 0,
    overflow: "hidden",
    background: "#15151a"
  };

  /* ---- timeline (reveal + Ken Burns), seamless by construction ---- */

  const motion = revealVars(
    revealStyle,
    revealDistance
  );

  useTimeline(
    ( {
      tl, gsap, options: opts
    } ) => {
      const duration = opts?.animation?.duration ?? 12;
      const ease = toGsapEase( opts?.sketch?.ease );

      if ( photoEnabled ) {
        const half = duration / 2;

        tl.set(
          ".px-photo",
          {
            scale: 1,
            x: 0,
            y: 0
          },
          0
        );
        tl.to(
          ".px-photo",
          {
            scale: 1 + zoom,
            x: panX * size.width,
            y: panY * size.height,
            duration: half,
            ease
          },
          0
        );
        tl.to(
          ".px-photo",
          {
            scale: 1,
            x: 0,
            y: 0,
            duration: half,
            ease
          },
          half
        );
      }

      if ( revealEnabled ) {
        const lineEls = gsap.utils.toArray( ".px-line" );
        const count = lineEls.length;

        if ( count > 0 ) {
          const span = ( duration * ( 1 - holdFraction ) ) / 2;
          const ramp = span * ( 1 - staggerFraction );
          const stride = count > 1 ? ( span * staggerFraction ) / ( count - 1 ) : 0;
          const closeBase = duration - span;

          lineEls.forEach( (
            el, index
          ) => {
            const openAt = index * stride;
            const closeAt = closeBase + index * stride;

            tl.set(
              el,
              motion.hidden,
              0
            );
            tl.to(
              el,
              {
                ...motion.shown,
                duration: ramp,
                ease
              },
              openAt
            );
            tl.to(
              el,
              {
                ...motion.hidden,
                duration: ramp,
                ease
              },
              closeAt
            );
          } );
        }
      }

      if ( tl.getChildren().length === 0 ) {
        tl.to(
          {},
          {
            duration
          },
          0
        );
      }
    },
    [
      layout,
      imageUrl,
      revealEnabled,
      revealStyle,
      revealDistance,
      holdFraction,
      staggerFraction,
      photoEnabled,
      zoom,
      panX,
      panY,
      stripSpecs.length,
      show.camera,
      show.date,
      show.filename,
      Boolean( caption ),
      Boolean( credit )
    ]
  );

  /* ---- render helpers -------------------------------------------- */

  const renderImage = () => {
    if ( !imageUrl ) {
      return (
        <div
          style={ {
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: sansFamily,
            fontSize: 18 * unit,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: label
          } }
        >
          add a photo
        </div>
      );
    }

    return (
      <img
        className="px-photo"
        src={ imageUrl }
        alt=""
        style={ imageStyle }
      />
    );
  };

  const stripCells = stripSpecs.map( ( spec ) => (
    <div
      key={ spec.id }
      className="px-line"
      style={ cellStyle }
    >
      <span style={ labelStyle }>{ spec.label }</span>
      <span style={ valueStyle }>{ spec.value || "—" }</span>
    </div>
  ) );

  const captionEl = caption
    ? (
      <span
        className="px-line"
        style={ captionStyle }
      >
        { caption }
      </span>
    )
    : null;

  const creditEl = credit
    ? (
      <span
        className="px-line"
        style={ footStyle }
      >
        { credit }
      </span>
    )
    : null;

  const filenameEl = ( show.filename && filename )
    ? (
      <span
        className="px-line"
        style={ footStyle }
      >
        { filename }
      </span>
    )
    : null;

  const titleEl = show.camera
    ? (
      <h1
        className="px-line"
        style={ titleStyle }
      >
        { cameraValue || "—" }
      </h1>
    )
    : null;

  const dateEl = show.date
    ? (
      <span
        className="px-line"
        style={ dateStyle }
      >
        { dateValue || "—" }
      </span>
    )
    : null;

  /* ---- editorial layout ------------------------------------------ */

  if ( layout === "overlay" || layout === "minimal" ) {
    const overlayBottom = (
      <div
        style={ {
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 14 * unit,
          textShadow: "0 2px 22px rgba(0, 0, 0, 0.55)"
        } }
      >
        { ( layout === "minimal" && dateEl ) ? dateEl : null }
        { titleEl }
        { stripCells.length
          ? (
            <div
              className="px-strip"
              style={ {
                display: "flex",
                flexWrap: "wrap",
                gap: `${ stripGapRow }px ${ stripGapCol }px`
              } }
            >
              { stripCells }
            </div>
          )
          : null }
        { captionEl }
        { ( creditEl || filenameEl )
          ? (
            <div
              style={ {
                display: "flex",
                gap: headerGap
              } }
            >
              { filenameEl }
              { creditEl }
            </div>
          )
          : null }
      </div>
    );

    return (
      <div
        className="px-stage"
        style={ {
          position: "relative",
          width: "100%",
          height: "100%",
          background,
          overflow: "hidden"
        } }
      >
        <div
          className="px-frame"
          style={ fullFrameStyle }
        >
          { renderImage() }
        </div>

        <div
          style={ {
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "linear-gradient(to bottom, rgba(0, 0, 0, 0.55) 0%, rgba(0, 0, 0, 0) 26%, rgba(0, 0, 0, 0) 52%, rgba(0, 0, 0, 0.78) 100%)"
          } }
        />

        <div
          style={ {
            position: "absolute",
            inset: 0,
            padding: margin,
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            justifyContent: layout === "minimal" ? "flex-end" : "space-between"
          } }
        >
          { layout === "overlay"
            ? (
              <div
                style={ {
                  display: "flex",
                  justifyContent: headerJustify,
                  alignItems: "flex-end",
                  gap: headerGap,
                  textShadow: "0 2px 22px rgba(0, 0, 0, 0.55)"
                } }
              >
                { titleEl }
                { dateEl }
              </div>
            )
            : null }
          { overlayBottom }
        </div>
      </div>
    );
  }

  return (
    <div
      className="px-stage"
      style={ {
        position: "relative",
        width: "100%",
        height: "100%",
        background,
        boxSizing: "border-box",
        padding: margin,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        gap: stageGap
      } }
    >
      { hasHeader
        ? (
          <div
            className="px-header"
            style={ {
              display: "flex",
              justifyContent: headerJustify,
              alignItems: "flex-end",
              gap: headerGap
            } }
          >
            { titleEl }
            { dateEl }
          </div>
        )
        : null }

      <div
        style={ {
          position: "relative",
          flex: "1 1 auto",
          minHeight: 0
        } }
      >
        <div
          className="px-frame"
          style={ frameStyle }
        >
          { renderImage() }
        </div>
      </div>

      { hasFooterBlock
        ? (
          <div
            style={ {
              display: "flex",
              flexDirection: "column",
              gap: 20 * unit
            } }
          >
            { stripCells.length
              ? (
                <div
                  className="px-strip"
                  style={ {
                    display: "flex",
                    flexWrap: "wrap",
                    gap: `${ stripGapRow }px ${ stripGapCol }px`
                  } }
                >
                  { stripCells }
                </div>
              )
              : null }
            { hasCaptionRow
              ? (
                <div
                  style={ {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: headerGap
                  } }
                >
                  { captionEl || <span /> }
                  <div
                    style={ {
                      display: "flex",
                      gap: headerGap
                    } }
                  >
                    { filenameEl }
                    { creditEl }
                  </div>
                </div>
              )
              : null }
          </div>
        )
        : null }
    </div>
  );
}
