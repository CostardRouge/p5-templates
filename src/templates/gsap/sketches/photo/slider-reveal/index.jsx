"use client";

/**
 * Slider Reveal — a full-frame slideshow. Each photo takes its turn with a
 * configurable transition (fade / slide / wipe / zoom), and the whole frame
 * breathes with a slow zoom. The last slide crossfades back to the first, so
 * the loop wraps seamlessly.
 *
 * Transitions are explicit `fromTo` tweens (deferred with immediateRender:false
 * so the initial state governs frame 0); the breathing uses a custom sine ease
 * whose value at progress 0 equals progress 1. All deterministic under scrub.
 */
import {
  useTimeline,
  toCssColor,
  toGsapEase,
  resolveImages,
  imageAt,
  imageFilterCss,
  sineEase
} from "@/gsap/utils";

/** Enter / neutral GSAP prop pairs for each transition style. */
function transitionStates(
  style, direction, radius
) {
  const round = `round ${ radius }px`;

  switch ( style ) {
    case "slide": {
      const axis = direction === "up" || direction === "down"
        ? "yPercent"
        : "xPercent";
      const sign = direction === "down" || direction === "right" ? -1 : 1;

      return {
        enter: {
          [ axis ]: 100 * sign
        },
        neutral: {
          xPercent: 0,
          yPercent: 0
        }
      };
    }
    case "zoom":
      return {
        enter: {
          scale: 1.18
        },
        neutral: {
          scale: 1
        }
      };
    case "wipe": {
      const hidden = {
        up: `inset(100% 0% 0% 0% ${ round })`,
        down: `inset(0% 0% 100% 0% ${ round })`,
        left: `inset(0% 0% 0% 100% ${ round })`,
        right: `inset(0% 100% 0% 0% ${ round })`
      };

      return {
        enter: {
          clipPath: hidden[ direction ] ?? hidden.left
        },
        neutral: {
          clipPath: `inset(0% 0% 0% 0% ${ round })`
        }
      };
    }
    case "fade":
    default:
      return {
        enter: {},
        neutral: {}
      };
  }
}

export default function SliderReveal( {
  options
} ) {
  const sketch = options?.sketch ?? {};

  const urls = resolveImages( options );
  const maxSlides = Math.max(
    1,
    Math.min(
      24,
      Math.round( sketch.maxSlides ?? 8 )
    )
  );
  const count = urls.length
    ? Math.max(
      1,
      Math.min(
        maxSlides,
        urls.length
      )
    )
    : 1;

  const margin = sketch.margin ?? 0;
  const radius = sketch.cornerRadius ?? 0;
  const fit = sketch.imageFit ?? "cover";
  const background = toCssColor(
    sketch.backgroundColor,
    "#0a0a0c"
  );
  const filter = imageFilterCss( sketch.imageEffect );

  const transition = sketch.transition ?? "fade";
  const direction = sketch.direction ?? "left";
  const transitionPortion = Math.max(
    0.1,
    Math.min(
      0.9,
      sketch.transitionPortion ?? 0.4
    )
  );
  const breathing = Math.max(
    0,
    Math.min(
      0.3,
      sketch.breathing ?? 0.05
    )
  );

  const slides = Array.from(
    {
      length: count
    },
    (
      _, index
    ) => imageAt(
      urls,
      index
    )
  );

  useTimeline(
    ( {
      tl, gsap, options: opts
    } ) => {
      const duration = opts?.animation?.duration ?? 12;
      const ease = toGsapEase( opts?.sketch?.ease );
      const slideEls = gsap.utils.toArray( ".sr-slide" );
      const n = slideEls.length;

      const {
        enter, neutral
      } = transitionStates(
        transition,
        direction,
        radius
      );

      // Frame-0 state: first slide visible, the rest hidden, all neutral.
      slideEls.forEach( (
        el, index
      ) => {
        tl.set(
          el,
          {
            ...neutral,
            opacity: index === 0 ? 1 : 0
          },
          0
        );
      } );

      if ( n > 1 ) {
        const slotDuration = duration / n;
        const transitionDuration = slotDuration * transitionPortion;

        for ( let k = 0; k < n; k++ ) {
          const from = slideEls[ k ];
          const to = slideEls[ ( k + 1 ) % n ];
          const at = k * slotDuration + ( slotDuration - transitionDuration );

          tl.to(
            from,
            {
              opacity: 0,
              duration: transitionDuration,
              ease,
              immediateRender: false
            },
            at
          );
          tl.fromTo(
            to,
            {
              ...enter,
              opacity: 0
            },
            {
              ...neutral,
              opacity: 1,
              duration: transitionDuration,
              ease,
              immediateRender: false
            },
            at
          );
        }
      }

      if ( breathing > 0 ) {
        tl.fromTo(
          ".sr-frame",
          {
            scale: 1
          },
          {
            scale: 1 + breathing,
            duration,
            ease: sineEase(
              1,
              0
            ),
            immediateRender: true
          },
          0
        );
      }
    },
    [
      count,
      transition,
      direction,
      transitionPortion,
      breathing,
      radius,
      margin
    ]
  );

  return (
    <div
      className="sr-stage"
      style={ {
        position: "relative",
        width: "100%",
        height: "100%",
        background,
        overflow: "hidden",
        boxSizing: "border-box",
        padding: margin
      } }
    >
      <div
        className="sr-frame"
        style={ {
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: radius,
          overflow: "hidden",
          willChange: "transform"
        } }
      >
        { slides.map( (
          url, index
        ) => (
          <div
            // eslint-disable-next-line react/no-array-index-key
            key={ index }
            className="sr-slide"
            style={ {
              position: "absolute",
              inset: 0,
              borderRadius: radius,
              overflow: "hidden",
              background: "#15151a",
              willChange: "transform, opacity, clip-path"
            } }
          >
            { url
              ? (
                <img
                  src={ url }
                  alt=""
                  style={ {
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: fit,
                    filter
                  } }
                />
              )
              : null }
          </div>
        ) ) }
      </div>
    </div>
  );
}
