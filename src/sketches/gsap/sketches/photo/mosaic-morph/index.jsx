"use client";

/**
 * Mosaic Morph — a single photo is split into a grid of tiles that scatter
 * (seeded offset / rotation / scale) and recompose into the whole image, on a
 * loop. Each tile is a window into the same background image; a yoyo tween
 * (assembled → scattered → assembled) guarantees the loop wraps seamlessly.
 *
 * Scatter targets are seeded so they never change between frames, keeping the
 * scrubbed, frame-stepped capture deterministic.
 */
import {
  useTimeline,
  toCssColor,
  toGsapEase,
  resolveImages,
  imageAt,
  imageFilterCss,
  boxShadowCss,
  makeRandom
} from "@/gsap/utils";

export default function MosaicMorph( {
  options
} ) {
  const sketch = options?.sketch ?? {};
  const size = options?.size ?? {
    width: 1080,
    height: 1350
  };

  const rows = Math.max(
    1,
    Math.round( sketch.grid?.rows ?? 5 )
  );
  const columns = Math.max(
    1,
    Math.round( sketch.grid?.columns ?? 5 )
  );
  const margin = sketch.margin ?? 64;
  const radius = sketch.cornerRadius ?? 0;
  const fit = sketch.imageFit ?? "cover";
  const background = toCssColor(
    sketch.backgroundColor,
    "#0a0a0c"
  );
  const filter = imageFilterCss( sketch.imageEffect );
  const shadow = boxShadowCss( sketch.shadow );

  const scatter = Math.max(
    0,
    Math.min(
      1,
      sketch.scatter ?? 0.35
    )
  );
  const rotate = sketch.rotate ?? 35;
  const scaleVar = Math.max(
    0,
    Math.min(
      0.9,
      sketch.scaleVar ?? 0.35
    )
  );
  const seed = Math.round( sketch.seed ?? 11 );

  const urls = resolveImages( options );
  const imageUrl = imageAt(
    urls,
    0
  );

  const areaWidth = size.width - margin * 2;
  const areaHeight = size.height - margin * 2;
  const tileWidth = areaWidth / columns;
  const tileHeight = areaHeight / rows;

  const tiles = Array.from(
    {
      length: rows * columns
    },
    (
      _, index
    ) => ( {
      row: Math.floor( index / columns ),
      col: index % columns
    } )
  );

  useTimeline(
    ( {
      tl, gsap, options: opts
    } ) => {
      const duration = opts?.animation?.duration ?? 12;
      const gsapEase = toGsapEase( opts?.sketch?.ease );
      const tileEls = gsap.utils.toArray( ".mm-tile" );
      const random = makeRandom( seed );

      tileEls.forEach( ( el ) => {
        const scattered = {
          x: ( random() * 2 - 1 ) * scatter * size.width,
          y: ( random() * 2 - 1 ) * scatter * size.height,
          rotation: ( random() * 2 - 1 ) * rotate,
          scale: 1 + ( random() * 2 - 1 ) * scaleVar
        };

        tl.fromTo(
          el,
          {
            x: 0,
            y: 0,
            rotation: 0,
            scale: 1
          },
          {
            ...scattered,
            duration: duration / 2,
            ease: gsapEase,
            yoyo: true,
            repeat: 1,
            immediateRender: true
          },
          0
        );
      } );
    },
    [
      rows,
      columns,
      scatter,
      rotate,
      scaleVar,
      seed,
      margin
    ]
  );

  return (
    <div
      className="mm-stage"
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
        className="mm-area"
        style={ {
          position: "relative",
          width: "100%",
          height: "100%"
        } }
      >
        { tiles.map( (
          tile, index
        ) => (
          <div
            key={ index }
            className="mm-tile"
            style={ {
              position: "absolute",
              left: tile.col * tileWidth,
              top: tile.row * tileHeight,
              width: tileWidth,
              height: tileHeight,
              borderRadius: radius,
              overflow: "hidden",
              background: "#15151a",
              boxShadow: shadow,
              backgroundImage: imageUrl ? `url("${ imageUrl }")` : undefined,
              backgroundRepeat: "no-repeat",
              backgroundSize: fit === "contain"
                ? "contain"
                : `${ areaWidth }px ${ areaHeight }px`,
              backgroundPosition: `${ -tile.col * tileWidth }px ${ -tile.row * tileHeight }px`,
              filter,
              willChange: "transform"
            } }
          />
        ) ) }
      </div>
    </div>
  );
}
