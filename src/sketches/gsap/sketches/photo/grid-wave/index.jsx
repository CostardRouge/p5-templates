"use client";

/**
 * Grid Wave — a photo grid where a sine wave ripples across the cells,
 * modulating each cell's scale, depth (translateZ) and brightness. Each cell's
 * phase is a function of its row and column, so the wave can travel
 * horizontally, vertically or diagonally and combine both axes.
 *
 * Every cell is a single `fromTo` driven by a custom sine ease whose value at
 * progress 0 equals its value at progress 1 (for whole-number frequencies), so
 * the wave loops seamlessly and stays deterministic under frame scrubbing.
 */
import {
  useTimeline,
  toCssColor,
  resolveImages,
  imageAt,
  imageFilterCss,
  boxShadowCss,
  sineEase
} from "@/gsap/utils";

export default function GridWave( {
  options
} ) {
  const sketch = options?.sketch ?? {};

  const rows = Math.max(
    1,
    Math.round( sketch.grid?.rows ?? 4 )
  );
  const columns = Math.max(
    1,
    Math.round( sketch.grid?.columns ?? 4 )
  );
  const margin = sketch.margin ?? 64;
  const gap = sketch.gap ?? 16;
  const radius = sketch.cornerRadius ?? 16;
  const fit = sketch.imageFit ?? "cover";
  const background = toCssColor(
    sketch.backgroundColor,
    "#0a0a0c"
  );
  const filter = imageFilterCss( sketch.imageEffect );
  const shadow = boxShadowCss( sketch.shadow );

  const amplitude = sketch.amplitude ?? 0.08;
  const depth = sketch.depth ?? 80;
  const shadeMax = Math.max(
    0,
    Math.min(
      0.8,
      sketch.shade ?? 0.35
    )
  );
  const cycles = Math.max(
    1,
    Math.round( sketch.cycles ?? 1 )
  );
  const freqRow = sketch.freqRow ?? 0.5;
  const freqCol = sketch.freqCol ?? 0.5;
  const perspective = sketch.perspective ?? 1400;

  const urls = resolveImages( options );
  const cellCount = rows * columns;
  const cells = Array.from(
    {
      length: cellCount
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
      const cellEls = gsap.utils.toArray( ".gw-cell" );
      const shadeEls = gsap.utils.toArray( ".gw-shade" );

      cellEls.forEach( (
        el, index
      ) => {
        const row = Math.floor( index / columns );
        const col = index % columns;
        const phase = row * freqRow + col * freqCol;
        const ease = sineEase(
          cycles,
          phase
        );

        tl.fromTo(
          el,
          {
            scale: 1 - amplitude,
            z: -depth
          },
          {
            scale: 1 + amplitude,
            z: depth,
            duration,
            ease,
            immediateRender: true
          },
          0
        );

        if ( shadeEls[ index ] ) {
          tl.fromTo(
            shadeEls[ index ],
            {
              opacity: shadeMax
            },
            {
              opacity: 0,
              duration,
              ease,
              immediateRender: true
            },
            0
          );
        }
      } );
    },
    [
      rows,
      columns,
      amplitude,
      depth,
      shadeMax,
      cycles,
      freqRow,
      freqCol,
      perspective
    ]
  );

  return (
    <div
      className="gw-stage"
      style={ {
        position: "relative",
        width: "100%",
        height: "100%",
        background,
        boxSizing: "border-box",
        padding: margin,
        overflow: "hidden"
      } }
    >
      <div
        className="gw-grid"
        style={ {
          width: "100%",
          height: "100%",
          display: "grid",
          gridTemplateColumns: `repeat(${ columns }, 1fr)`,
          gridTemplateRows: `repeat(${ rows }, 1fr)`,
          gap,
          perspective: `${ perspective }px`
        } }
      >
        { cells.map( (
          url, index
        ) => (
          <div
            key={ index }
            className="gw-cell"
            style={ {
              position: "relative",
              overflow: "hidden",
              borderRadius: radius,
              boxShadow: shadow,
              background: "#15151a",
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
              className="gw-shade"
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
