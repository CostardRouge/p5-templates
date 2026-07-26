"use client";

/**
 * Stack Shuffle — a deck of photo cards. Each loop the front card lifts, is
 * thrown aside, and drops to the back while the rest shift forward one slot.
 * After every card has cycled once the deck is back to its original order, so
 * the loop wraps seamlessly.
 *
 * The deck is a pure rotation: at step `k`, card `i` sits in slot
 * `(i - k) mod N`. The whole cycle is built from explicit tweens (no
 * `onUpdate`), keeping the scrubbed, frame-stepped capture deterministic.
 * Per-slot rotation jitter is seeded so it never changes between frames.
 */
import {
  useTimeline,
  toCssColor,
  toGsapEase,
  resolveImages,
  imageAt,
  imageFilterCss,
  boxShadowCss,
  jitterArray
} from "@/gsap/utils";

export default function StackShuffle( {
  options
} ) {
  const sketch = options?.sketch ?? {};
  const size = options?.size ?? {
    width: 1080,
    height: 1350
  };

  const urls = resolveImages( options );
  const maxCards = Math.max(
    2,
    Math.min(
      12,
      Math.round( sketch.maxCards ?? 6 )
    )
  );
  const count = urls.length
    ? Math.max(
      2,
      Math.min(
        maxCards,
        urls.length
      )
    )
    : maxCards;

  const cardWidthRatio = sketch.cardWidthRatio ?? 0.62;
  const cardAspect = sketch.cardAspect ?? 1.3;
  const offsetX = sketch.offsetX ?? 18;
  const offsetY = sketch.offsetY ?? 24;
  const rotationJitter = sketch.rotationJitter ?? 4;
  const scaleStep = sketch.scaleStep ?? 0.05;
  const depthStep = sketch.depthStep ?? 60;
  const dimStep = sketch.dimStep ?? 0.08;
  const perspective = sketch.perspective ?? 1600;
  const seed = Math.round( sketch.seed ?? 7 );
  const direction = sketch.direction ?? "left";

  const radius = sketch.cornerRadius ?? 16;
  const fit = sketch.imageFit ?? "cover";
  const background = toCssColor(
    sketch.backgroundColor,
    "#0a0a0c"
  );
  const filter = imageFilterCss( sketch.imageEffect );
  const shadow = boxShadowCss( sketch.shadow );

  const throwX = sketch.throw?.x ?? 0.7;
  const throwY = sketch.throw?.y ?? 0.4;
  const throwRotate = sketch.throw?.rotate ?? 18;
  const throwScale = sketch.throw?.scale ?? 0.08;

  const minDim = Math.min(
    size.width,
    size.height
  );
  const cardWidth = minDim * cardWidthRatio;
  const cardHeight = cardWidth * cardAspect;

  const cards = Array.from(
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
      tl, gsap, root, options: opts
    } ) => {
      const duration = opts?.animation?.duration ?? 12;
      const ease = toGsapEase( opts?.sketch?.ease );
      const sign = direction === "right" ? 1 : -1;
      const jitter = jitterArray(
        count,
        rotationJitter,
        seed
      );

      const slot = ( s ) => ( {
        x: s * offsetX,
        y: s * offsetY,
        rotation: jitter[ s ] ?? 0,
        scale: 1 - s * scaleStep,
        z: -s * depthStep
      } );
      const shade = ( s ) => Math.min(
        0.65,
        s * dimStep
      );

      const cardEls = gsap.utils.toArray( ".ss-card" );
      const shadeEls = gsap.utils.toArray( ".ss-shade" );

      if ( !cardEls.length ) {
        return;
      }

      // Initial deck order: card i in slot i.
      cardEls.forEach( (
        el, i
      ) => {
        tl.set(
          el,
          {
            ...slot( i ),
            transformOrigin: "50% 60%"
          },
          0
        );
        tl.set(
          shadeEls[ i ],
          {
            opacity: shade( i )
          },
          0
        );
      } );

      const n = cardEls.length;
      const stepDuration = duration / n;

      for ( let k = 0; k < n; k++ ) {
        const start = k * stepDuration;

        for ( let i = 0; i < n; i++ ) {
          const startSlot = ( ( i - k ) % n + n ) % n;
          const card = cardEls[ i ];
          const sh = shadeEls[ i ];

          if ( startSlot === 0 ) {
            // Front card: throw out (stays in front), then drop to the back.
            tl.to(
              card,
              {
                x: sign * throwX * cardWidth,
                y: -throwY * cardHeight,
                rotation: sign * throwRotate,
                scale: 1 + throwScale,
                duration: stepDuration * 0.5,
                ease
              },
              start
            );
            tl.to(
              sh,
              {
                opacity: 0,
                duration: stepDuration * 0.5,
                ease
              },
              start
            );
            tl.to(
              card,
              {
                ...slot( n - 1 ),
                duration: stepDuration * 0.5,
                ease
              },
              start + stepDuration * 0.5
            );
            tl.to(
              sh,
              {
                opacity: shade( n - 1 ),
                duration: stepDuration * 0.5,
                ease
              },
              start + stepDuration * 0.5
            );
          } else {
            const endSlot = startSlot - 1;

            tl.to(
              card,
              {
                ...slot( endSlot ),
                duration: stepDuration,
                ease
              },
              start
            );
            tl.to(
              sh,
              {
                opacity: shade( endSlot ),
                duration: stepDuration,
                ease
              },
              start
            );
          }
        }
      }
    },
    [
      count,
      cardWidthRatio,
      cardAspect,
      offsetX,
      offsetY,
      rotationJitter,
      scaleStep,
      depthStep,
      dimStep,
      perspective,
      seed,
      direction,
      throwX,
      throwY,
      throwRotate,
      throwScale
    ]
  );

  return (
    <div
      className="ss-stage"
      style={ {
        position: "relative",
        width: "100%",
        height: "100%",
        background,
        overflow: "hidden",
        perspective: `${ perspective }px`,
        perspectiveOrigin: "50% 50%"
      } }
    >
      <div
        className="ss-deck"
        style={ {
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 0,
          height: 0,
          transformStyle: "preserve-3d"
        } }
      >
        { cards.map( (
          url, index
        ) => (
          <div
            key={ index }
            className="ss-card"
            data-index={ index }
            style={ {
              position: "absolute",
              width: cardWidth,
              height: cardHeight,
              left: -cardWidth / 2,
              top: -cardHeight / 2,
              borderRadius: radius,
              overflow: "hidden",
              background: "#15151a",
              boxShadow: shadow,
              willChange: "transform"
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
            <div
              className="ss-shade"
              style={ {
                position: "absolute",
                inset: 0,
                background: "#000",
                opacity: 0,
                pointerEvents: "none"
              } }
            />
          </div>
        ) ) }
      </div>
    </div>
  );
}
