"use client";

/**
 * Photo EXIF — an editorial "spec sheet" slideshow.
 *
 * Every photo is shown in turn with the camera settings it was actually shot
 * with — ISO, shutter speed, aperture, focal length, lens and the friendly
 * camera name — read straight from each file's EXIF metadata (reusing the
 * shared reader + friendly-name maps from the p5 engine).
 *
 * All images are laid out as stacked slides and given an equal share of the
 * loop: 6 photos over a 12s sketch ⇒ 2s each. Within its slot a slide's photo
 * transitions in, its metadata reveals (staggered), both hold, then they exit
 * again before the next photo enters — so the EXIF on screen always belongs to
 * the photo on screen, and the reveal replays for every image.
 *
 * Three editorial layouts arrange the same building blocks (editorial /
 * overlay / minimal). Everything ends where it starts, so playback wraps
 * seamlessly like the other GSAP templates.
 */
import {
  useTimeline,
  toCssColor,
  toGsapEase,
  resolveImages,
  imageFilterCss,
  boxShadowCss
} from "@/gsap/utils";
import {
  exif, useExifList
} from "@/gsap/utils/exif";

/** System font stacks — kept generic so they survive the DOM→canvas capture. */
const FONT_STACKS = {
  serif: "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif",
  sans: "'Helvetica Neue', Helvetica, Arial, system-ui, -apple-system, sans-serif",
  mono: "'SFMono-Regular', 'SF Mono', Menlo, Consolas, 'Liberation Mono', 'Courier New', monospace"
};

/**
 * Constant scale the photo is held at so it always slightly overflows its
 * frame — its edge never lands on the frame border (no gap / no shimmer). The
 * Ken Burns zoom is added on top of this.
 */
const PHOTO_OVERSCAN = 1.08;

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
 * Hidden / shown GSAP vars for a metadata reveal style. Each pair is symmetric
 * — the "hidden" state is used at both ends of a slot — so the reveal is
 * seamless whatever style is picked.
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

/**
 * Hidden / shown GSAP vars for the photo transition flourish. These are pure
 * transform / clip — NO opacity. Visibility is owned by the slide's own opacity
 * (the crossfade), so a flourish like a zoom or a slide layers on top of the
 * fade without two opacities fighting, and the wrapper never fights the Ken
 * Burns transform on the image itself. "fade" returns empty (no flourish).
 */
function photoTransitionVars(
  style, direction, radius
) {
  if ( style === "zoom" ) {
    return {
      hidden: {
        scale: 1.12
      },
      shown: {
        scale: 1
      }
    };
  }

  if ( style === "slide" ) {
    const axis = direction === "up" || direction === "down"
      ? "yPercent"
      : "xPercent";
    const sign = direction === "down" || direction === "right" ? -1 : 1;

    return {
      hidden: {
        [ axis ]: 100 * sign
      },
      shown: {
        xPercent: 0,
        yPercent: 0
      }
    };
  }

  if ( style === "wipe" ) {
    const round = `round ${ radius }px`;
    const hidden = {
      up: `inset(100% 0% 0% 0% ${ round })`,
      down: `inset(0% 0% 100% 0% ${ round })`,
      left: `inset(0% 0% 0% 100% ${ round })`,
      right: `inset(0% 100% 0% 0% ${ round })`
    };

    return {
      hidden: {
        clipPath: hidden[ direction ] ?? hidden.left
      },
      shown: {
        clipPath: `inset(0% 0% 0% 0% ${ round })`
      }
    };
  }

  // "fade" (default) — no flourish; the slide opacity does all the work.
  return {
    hidden: {},
    shown: {}
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

/**
 * Resolve the value shown in the camera-name slot. The manual override always
 * wins (handled by the caller); otherwise the chosen EXIF field is used so the
 * headline can read e.g. the lens or focal length instead of the body name.
 */
function resolveCameraSource(
  source, data, filename
) {
  if ( source === "focal" ) {
    return exif.formatFocalLength( data?.focalLength ) || "";
  }

  if ( source === "aperture" ) {
    return exif.formatAperture( data?.aperture ) || "";
  }

  if ( source === "shutter" ) {
    return exif.formatShutterSpeed( data?.shutterSpeed ) || "";
  }

  if ( source === "iso" ) {
    return data?.iso ? String( data.iso ) : "";
  }

  if ( source === "lens" ) {
    return exif.formatLensModel( data?.lens ) || "";
  }

  if ( source === "date" ) {
    return exif.formatPhotoDate( data?.date ) || "";
  }

  if ( source === "gps" ) {
    return exif.formatGPSCoordinates(
      data?.gps?.latitude,
      data?.gps?.longitude
    ) || "";
  }

  if ( source === "filename" ) {
    return filename || "";
  }

  // "camera" (default)
  return exif.formatCameraModel( data?.camera ) || "";
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
  const maxImages = Math.max(
    1,
    Math.min(
      60,
      Math.round( sketch.maxImages ?? 24 )
    )
  );
  const count = urls.length
    ? Math.min(
      maxImages,
      urls.length
    )
    : 1;
  const cycledUrls = urls.slice(
    0,
    count
  );

  const exifMap = useExifList( cycledUrls );

  const layout = sketch.layout ?? "editorial";

  // Horizontal / vertical margins are independent so the safe area can dodge
  // social-media dead zones (e.g. extra vertical room for the caption/profile
  // overlays on Reels & TikTok). The legacy single `margin` is still honoured
  // as the fallback for both axes, so older presets keep their even inset.
  const marginX = sketch.marginX ?? sketch.margin ?? 80;
  const marginY = sketch.marginY ?? sketch.margin ?? 80;
  const framePadding = `${ marginY }px ${ marginX }px`;
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
  const showLabels = typography.showLabels ?? true;
  const showLabelLine = typography.showLabelLine ?? true;
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
  const cameraSource = sketch.cameraSource ?? "camera";

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

  const transition = sketch.transition ?? {};
  const transitionEnabled = transition.enabled ?? true;
  const transitionStyle = transition.style ?? "fade";
  const transitionDirection = transition.direction ?? "left";
  const transitionPortion = Math.max(
    0.1,
    Math.min(
      0.6,
      transition.portion ?? 0.3
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

  const slides = Array.from(
    {
      length: count
    },
    (
      _, i
    ) => {
      const url = cycledUrls[ i ];
      const data = url ? exifMap[ url ] : null;
      const path = imagePathAt(
        sketch.images,
        i
      );
      const filename = path
        ? decodeURIComponent( String( path ).split( "/" ).pop() )
        : "";

      return {
        url,
        cameraValue: cameraOverride
          || resolveCameraSource(
            cameraSource,
            data,
            filename
          ),
        dateValue: exif.formatPhotoDate( data?.date ) || "",
        stripSpecs: buildStripSpecs(
          data,
          show
        ),
        filename
      };
    }
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
  const stripKey = [
    show.focal,
    show.aperture,
    show.shutter,
    show.iso,
    show.lens,
    show.gps
  ].join( "," );

  /* ---- shared styles --------------------------------------------- */

  const titleStyle = {
    margin: 0,
    minWidth: 0,
    fontFamily: displayFamily,
    fontSize: titleSize,
    fontWeight: 600,
    lineHeight: 1.02,
    letterSpacing: "-0.01em",
    color: text,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  };

  const dateStyle = {
    margin: 0,
    flexShrink: 0,
    fontFamily: valueFamily,
    fontSize: dateSize,
    fontWeight: 500,
    letterSpacing: `${ tracking * 0.5 }em`,
    textTransform: uppercaseLabels ? "uppercase" : "none",
    whiteSpace: "nowrap",
    color: label
  };

  const labelStyle = {
    margin: 0,
    fontFamily: sansFamily,
    fontSize: labelSize,
    fontWeight: 600,
    letterSpacing: `${ tracking }em`,
    textTransform: uppercaseLabels ? "uppercase" : "none",
    whiteSpace: "nowrap",
    color: label
  };

  const valueStyle = {
    margin: 0,
    fontFamily: valueFamily,
    fontSize: valueSize,
    fontWeight: 500,
    lineHeight: 1.1,
    whiteSpace: "nowrap",
    color: text
  };

  const captionStyle = {
    margin: 0,
    minWidth: 0,
    fontFamily: displayFamily,
    fontSize: captionSize,
    fontStyle: "italic",
    lineHeight: 1.2,
    color: text,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
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
    flexShrink: 0,
    flexDirection: "column",
    gap: cellGap,
    paddingTop: showLabelLine ? cellPadTop : 0,
    borderTop: showLabelLine ? `2px solid ${ accent }` : "none",
    minWidth: 78 * unit
  };

  // The image fills its frame exactly; the overscan that keeps its edge off
  // the frame border (no gap, no subpixel shimmer) is applied as a transform
  // scale in the timeline below — NOT via width/offset, which Tailwind's base
  // `img { max-width: 100% }` would clamp (leaving a gap on the right).
  const imageStyle = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: fit,
    filter,
    transformOrigin: "center",
    backfaceVisibility: "hidden",
    willChange: "transform"
  };

  const photoFxStyle = {
    position: "absolute",
    inset: 0,
    backfaceVisibility: "hidden",
    willChange: "transform, opacity, clip-path"
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

  const placeholderStyle = {
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
  };

  /* ---- timeline: per-slot transition + reveal + Ken Burns -------- */

  const motion = revealVars(
    revealStyle,
    revealDistance
  );
  const photoTx = photoTransitionVars(
    transitionStyle,
    transitionDirection,
    radius
  );
  const hasFlair = Object.keys( photoTx.hidden ).length > 0;

  useTimeline(
    ( {
      tl, gsap, options: opts
    } ) => {
      const duration = opts?.animation?.duration ?? 12;
      const ease = toGsapEase( opts?.sketch?.ease );
      const slideEls = gsap.utils.toArray( ".px-slide" );
      const n = slideEls.length;

      if ( n === 0 ) {
        tl.to(
          {},
          {
            duration
          },
          0
        );

        return;
      }

      const slot = duration / n;
      const edge = ( slot * ( 1 - holdFraction ) ) / 2;
      const half = slot / 2;
      const tDur = slot * transitionPortion;

      slideEls.forEach( (
        slide, k
      ) => {
        const winStart = k * slot;
        const winEnd = winStart + slot;
        const closeBase = winEnd - edge;
        const fx = slide.querySelector( ".px-photo-fx" );
        const img = slide.querySelector( ".px-photo" );
        const lines = gsap.utils.toArray( slide.querySelectorAll( ".px-line" ) );

        // Slide visibility frame-0: only the first slide starts visible. The
        // crossfades after this loop fade whole slides over one another, so an
        // inactive slide is fully transparent and never covers the active one
        // with its opaque frame background.
        tl.set(
          slide,
          {
            opacity: k === 0 ? 1 : 0
          },
          0
        );

        // Photo flourish baseline (transform / clip only — opacity is the
        // slide's job). Skipped for the plain "fade" transition.
        if ( fx && hasFlair ) {
          tl.set(
            fx,
            photoTx.shown,
            0
          );
        }

        // The image is held a touch larger than its frame (a constant scale
        // overscan) so its edge never coincides with the frame border — that is
        // what causes the gap / subpixel shimmer. The Ken Burns drift is a yoyo
        // within the slot on top of that base, returning to its start (seamless
        // even with hard cuts). The base is set even when motion is off, so the
        // overscan always holds.
        if ( img ) {
          tl.set(
            img,
            {
              scale: PHOTO_OVERSCAN,
              x: 0,
              y: 0
            },
            0
          );

          if ( photoEnabled ) {
            tl.to(
              img,
              {
                scale: PHOTO_OVERSCAN + zoom,
                x: panX * size.width,
                y: panY * size.height,
                duration: half,
                ease
              },
              winStart
            );
            tl.to(
              img,
              {
                scale: PHOTO_OVERSCAN,
                x: 0,
                y: 0,
                duration: half,
                ease
              },
              winStart + half
            );
          }
        }

        // Metadata lines — staggered reveal in / out within the slot.
        const lineCount = lines.length;

        if ( lineCount > 0 ) {
          const ramp = edge * ( 1 - staggerFraction );
          const stride = lineCount > 1
            ? ( edge * staggerFraction ) / ( lineCount - 1 )
            : 0;

          lines.forEach( (
            el, j
          ) => {
            const openAt = winStart + j * stride;
            const closeAt = closeBase + j * stride;

            tl.set(
              el,
              motion.hidden,
              0
            );

            if ( revealEnabled ) {
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
            } else {
              tl.set(
                el,
                motion.shown,
                winStart
              );
              tl.set(
                el,
                motion.hidden,
                winEnd
              );
            }
          } );
        }
      } );

      // Crossfade whole slides: the next fades in as the current fades out
      // (over the last `tDur` of the slot), so the frame is never blank and an
      // inactive slide's opaque background never covers the active one. The
      // last slide hands back to the first, so the loop wraps seamlessly. The
      // chosen flourish (zoom / slide / wipe) rides in on the incoming photo.
      if ( n > 1 ) {
        for ( let i = 0; i < n; i++ ) {
          const fromSlide = slideEls[ i ];
          const toSlide = slideEls[ ( i + 1 ) % n ];
          const toFx = toSlide.querySelector( ".px-photo-fx" );
          const at = i * slot + ( slot - tDur );

          if ( transitionEnabled ) {
            tl.to(
              fromSlide,
              {
                opacity: 0,
                duration: tDur,
                ease,
                immediateRender: false
              },
              at
            );
            tl.fromTo(
              toSlide,
              {
                opacity: 0
              },
              {
                opacity: 1,
                duration: tDur,
                ease,
                immediateRender: false
              },
              at
            );

            if ( hasFlair && toFx ) {
              tl.fromTo(
                toFx,
                {
                  ...photoTx.hidden
                },
                {
                  ...photoTx.shown,
                  duration: tDur,
                  ease,
                  immediateRender: false
                },
                at
              );
            }
          } else {
            tl.set(
              fromSlide,
              {
                opacity: 0
              },
              at + tDur
            );
            tl.set(
              toSlide,
              {
                opacity: 1
              },
              at + tDur
            );
          }
        }
      }
    },
    [
      count,
      layout,
      marginX,
      marginY,
      size.width,
      size.height,
      radius,
      revealEnabled,
      revealStyle,
      revealDistance,
      holdFraction,
      staggerFraction,
      transitionEnabled,
      transitionStyle,
      transitionDirection,
      transitionPortion,
      photoEnabled,
      zoom,
      panX,
      panY,
      show.camera,
      show.date,
      show.filename,
      stripKey,
      Boolean( caption ),
      Boolean( credit )
    ]
  );

  /* ---- render helpers -------------------------------------------- */

  const renderImage = (
    url, full
  ) => (
    <div
      className="px-frame"
      style={ full ? fullFrameStyle : frameStyle }
    >
      <div
        className="px-photo-fx"
        style={ photoFxStyle }
      >
        { url
          ? (
            <img
              className="px-photo"
              src={ url }
              alt=""
              style={ imageStyle }
            />
          )
          : (
            <div style={ placeholderStyle }>add a photo</div>
          ) }
      </div>
    </div>
  );

  const renderSlide = (
    slide, index
  ) => {
    const titleEl = show.camera
      ? (
        <h1
          className="px-line"
          style={ titleStyle }
        >
          { slide.cameraValue || "—" }
        </h1>
      )
      : null;
    const dateEl = show.date
      ? (
        <span
          className="px-line"
          style={ dateStyle }
        >
          { slide.dateValue || "—" }
        </span>
      )
      : null;
    const cells = slide.stripSpecs.map( ( spec ) => (
      <div
        key={ spec.id }
        className="px-line"
        style={ cellStyle }
      >
        { showLabels
          ? <span style={ labelStyle }>{ spec.label }</span>
          : null }
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
    const filenameEl = ( show.filename && slide.filename )
      ? (
        <span
          className="px-line"
          style={ footStyle }
        >
          { slide.filename }
        </span>
      )
      : null;
    const hasCaptionRow = Boolean( captionEl || creditEl || filenameEl );

    if ( layout === "overlay" || layout === "minimal" ) {
      const bottom = (
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
          { cells.length
            ? (
              <div
                className="px-strip"
                style={ {
                  display: "flex",
                  flexWrap: "wrap",
                  gap: `${ stripGapRow }px ${ stripGapCol }px`
                } }
              >
                { cells }
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
          // eslint-disable-next-line react/no-array-index-key
          key={ index }
          className="px-slide"
          style={ {
            position: "absolute",
            inset: 0
          } }
        >
          { renderImage(
            slide.url,
            true
          ) }
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
              padding: framePadding,
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
            { bottom }
          </div>
        </div>
      );
    }

    return (
      <div
        // eslint-disable-next-line react/no-array-index-key
        key={ index }
        className="px-slide"
        style={ {
          position: "absolute",
          inset: 0,
          boxSizing: "border-box",
          padding: framePadding,
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
                flexShrink: 0,
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
          { renderImage(
            slide.url,
            false
          ) }
        </div>

        { ( cells.length > 0 || hasCaptionRow )
          ? (
            <div
              style={ {
                display: "flex",
                flexShrink: 0,
                flexDirection: "column",
                gap: 20 * unit
              } }
            >
              { cells.length
                ? (
                  <div
                    className="px-strip"
                    style={ {
                      display: "flex",
                      flexWrap: "nowrap",
                      overflow: "hidden",
                      gap: `${ stripGapRow }px ${ stripGapCol }px`
                    } }
                  >
                    { cells }
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
  };

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
      { slides.map( (
        slide, index
      ) => renderSlide(
        slide,
        index
      ) ) }
    </div>
  );
}
