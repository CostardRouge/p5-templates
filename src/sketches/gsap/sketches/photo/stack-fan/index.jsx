"use client";

/**
 * Stack Fan — a pile of cards that fans open like a hand of cards, holds, then
 * closes again, on a loop. Each card shares a bottom-centre pivot, so rotating
 * them spreads the tops while the bottoms stay together.
 *
 * The cycle (closed → fanned → hold → closed) fills the loop duration and ends
 * where it starts, so playback wraps seamlessly. All motion is explicit tweens.
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

export default function StackFan( {
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
      Math.round( sketch.maxCards ?? 7 )
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

  const cardWidthRatio = sketch.cardWidthRatio ?? 0.46;
  const cardAspect = sketch.cardAspect ?? 1.4;
  const spread = sketch.spread ?? 70;
  const lift = sketch.lift ?? 0.08;
  const holdFraction = Math.max(
    0,
    Math.min(
      0.8,
      sketch.holdFraction ?? 0.25
    )
  );

  const radius = sketch.cornerRadius ?? 16;
  const fit = sketch.imageFit ?? "cover";
  const background = toCssColor(
    sketch.backgroundColor,
    "#0a0a0c"
  );
  const filter = imageFilterCss( sketch.imageEffect );
  const shadow = boxShadowCss( sketch.shadow );

  const minDim = Math.min(
    size.width,
    size.height
  );
  const cardWidth = minDim * cardWidthRatio;
  const cardHeight = cardWidth * cardAspect;
  const perCard = count > 1 ? spread / ( count - 1 ) : 0;

  const cards = Array.from(
    {
      length: count
    },
    (
      _, index
    ) => ( {
      url: imageAt(
        urls,
        index
      ),
      angle: ( index - ( count - 1 ) / 2 ) * perCard
    } )
  );

  useTimeline(
    ( {
      tl, gsap, options: opts
    } ) => {
      const duration = opts?.animation?.duration ?? 12;
      const ease = toGsapEase( opts?.sketch?.ease );
      const openSpan = ( duration * ( 1 - holdFraction ) ) / 2;
      const closeStart = duration - openSpan;
      const cardEls = gsap.utils.toArray( ".sf-card" );

      cardEls.forEach( (
        el, index
      ) => {
        const angle = cards[ index ]?.angle ?? 0;

        tl.set(
          el,
          {
            rotation: 0,
            y: 0
          },
          0
        );
        tl.to(
          el,
          {
            rotation: angle,
            y: -lift * cardHeight,
            duration: openSpan,
            ease
          },
          0
        );
        tl.to(
          el,
          {
            rotation: 0,
            y: 0,
            duration: openSpan,
            ease
          },
          closeStart
        );
      } );
    },
    [
      count,
      cardWidthRatio,
      cardAspect,
      spread,
      lift,
      holdFraction
    ]
  );

  return (
    <div
      className="sf-stage"
      style={ {
        position: "relative",
        width: "100%",
        height: "100%",
        background,
        overflow: "hidden"
      } }
    >
      <div
        className="sf-deck"
        style={ {
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 0,
          height: 0
        } }
      >
        { cards.map( (
          card, index
        ) => (
          <div
            key={ index }
            className="sf-card"
            style={ {
              position: "absolute",
              width: cardWidth,
              height: cardHeight,
              left: -cardWidth / 2,
              top: -cardHeight / 2,
              transformOrigin: "50% 100%",
              borderRadius: radius,
              overflow: "hidden",
              background: "#15151a",
              boxShadow: shadow,
              willChange: "transform"
            } }
          >
            { card.url
              ? (
                <img
                  src={ card.url }
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
