import { sketch, animation, easing, exif, mappers, string, events, captureOptions as options, cache, grid, colors, imageUtils } from '/assets/scripts/p5-sketches/utils/index.js';

const canvases = {};

sketch.setup(
    () => {
      canvases.background = createGraphics(
          sketch?.engine?.canvas?.width,
          sketch?.engine?.canvas?.height,
      );

      // canvases.background.pixelDensity(options.backgroundPixelDensity || 0.0175);

      background(...options.colors.background);
      options.noSmooth && noSmooth();
    },
    {
      size: {
        width: options.size.width,
        height: options.size.height,
      },
      animation: {
        framerate: options.animation.framerate,
        duration: options.animation.duration,
      }
    }
);

events.register("engine-window-preload", () => {
    cache.store("images", () => options.assets.map( imagePath => ({
          path: imagePath,
          exif: undefined,
          img: loadImage( imagePath ),
          filename: imagePath.split("/").pop(),
    }) ) );

    cache.get("images").forEach( async( imageObject ) => {
        const { path } = imageObject;

        imageObject.exif = await exif.load("http://localhost:3000/" + path);

        console.log(imageObject.exif)
    } );
});

sketch.draw( ( time, center, favoriteColor ) => {
    background(...options.colors.background);
    canvases.background.background(...options.colors.background);

    const images = cache.get("images");

    const borderSize = 0;
    const rows = options.rows || 4//columns*height/width;
    const columns = options.columns || 3//rows*width/height;
    const gridOptions = {
        topLeft: createVector( borderSize, borderSize ),
        topRight: createVector( width-borderSize, borderSize ),
        bottomLeft: createVector( borderSize, height-borderSize ),
        bottomRight: createVector( width-borderSize, height-borderSize ),
        rows,
        columns,
        centered: false
    }
    const { cells: gridCells } = grid.create( gridOptions );

    canvases.background.background(...options.colors.background);
    canvases.background.background(0, 0, 0, 92);

    // gridCells.forEach( ({ position, xIndex, yIndex, width: W, height: H }) => {
    //     const { x, y } = position;
    //     const imageObjectAtIndex = mappers.circularIndex(
    //         (
    //             +animation.progression*images.length
    //             +(
    //                 +xIndex/columns
    //                 +yIndex/rows
    //             )
    //         ),
    //         images
    //     );
    //     const imageAtIndex = imageObjectAtIndex.img;
    //
    //     imageUtils.marginImage({
    //         img: imageAtIndex,
    //         position: createVector(x+W/2, y+H/2),
    //         boundary: {
    //             height: H/2,
    //             width: W/2
    //         },
    //         graphics: canvases.background,
    //         center: true,
    //     });
    // });

    const imageObjectAtIndex = mappers.circularIndex(
        animation.progression*images.length,
        images
    );
    const imageAtIndex = imageObjectAtIndex.img;

    imageUtils.marginImage({
        img: imageAtIndex,
        position: createVector(width/2, height/2),
        graphics: canvases.background,
        center: true,
        fill: true,
    });

    image(canvases.background, 0, 0, width, height);
    filter(BLUR, options.blur || 9, true);
    // filter(POSTERIZE, options.blur || 9, true);

    gridCells.forEach( ({ position, xIndex, yIndex, width: W, height: H }, cellIndex ) => {
        const { x, y } = position;
        const imageObjectAtIndex = mappers.circularIndex(
          cellIndex,
          // (
          //     +animation.progression*images.length
          //     +(
          //         +xIndex/columns
          //         +yIndex/rows
          //     )
          // ),
          images
        );

        const imageAtIndex = imageObjectAtIndex.img;

        imageUtils.marginImage({
            img: imageAtIndex,
            position: createVector(x+W/2, y+H/2),
            boundary: {
                height: H,
                width: W
            },
            center: true,
            fill: true,
            scale: .9,
            clip: true,
            margin: 10,
        });
    })

    const defaultTitle = "photo-grip-dump".toUpperCase().replaceAll('-', "\n")

    // if (animation.progression < 0.2) {
    //     string.write(
    //         defaultTitle,
    //         // options.texts.title || defaultTitle,
    //         width/2,
    //         height/2,
    //         {
    //           size: 128,
    //           stroke: color(...options.colors.text),
    //           fill: color(...options.colors.background),
    //           font: string.fonts.martian,
    //           textAlign: [CENTER, CENTER],
    //           blendMode: EXCLUSION
    //         }
    //     )
    // }

    if ( document.querySelector("canvas#defaultCanvas0.loaded") === null && images.every(image => image.exif !== undefined)) {
        document.querySelector("canvas#defaultCanvas0").classList.add("loaded");
    }
});
