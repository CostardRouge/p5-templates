import options from "@/p5/utils/options.js";
import sketch from "@/p5/utils/sketch.js";
import string from "@/p5/utils/string.js";
import cache from "@/p5/utils/cache.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

sketch.draw( () => {
  const p = getP5();

  p.background( ...( options.sketch?.backgroundColor ?? [
    0
  ] ) );

  const horizontalMargin = 0.05;
  const verticalMargin = 0.01;

  const text = "Neque porro quisquam est qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit";
  const font = string.fonts.martian;

  if ( !font?.font ) {
    return;
  }

  const fontStyle = {
    size: 72,
    stroke: "blue",
    fill: "white",
    strokeWeight: 3,
    font,
    textWrap: p.WORD,
    textAlign: [
      "left",
      "top"
    ],
    blendMode: "source-over",
    textWidth: p.width - 2 * ( horizontalMargin * p.width ),
    textHeight: p.height - 2 * ( verticalMargin * p.height )
  };

  const decomposedText = cache.store(
    cache.key(
      horizontalMargin,
      verticalMargin,
      font?.font,
      text
    ),
    () => {
      const result = [];
      const textBlocks = text.split( " " );

      textBlocks.forEach( (
        block, blockIndex
      ) => {
        const currentBlock = textBlocks[ blockIndex ];

        const paddedBlock = (
          textBlocks
            .map( (
              block, index
            ) => {
              if ( index === blockIndex ) {
                return block;
              }

              return (
                Array
                  .from( {
                    length: block.length
                  } )
                  .fill( "-" )
                  .join( "" )
              );
            } )
            .join( " " )
        );

        console.log(
          currentBlock,
          paddedBlock
        );

        string.applyFontStyle( fontStyle );

        result.push( {
          text: currentBlock,
          box: font?.textBounds(
            paddedBlock,
            p.width * horizontalMargin,
            p.height * verticalMargin,
            fontStyle.size
          )
        } );
      } );

      // for ( let i = 0; i < textBlocks.length; i++ ) {
      //   const textBlock = textBlocks[ i ];
      //
      //   const paddedBlock = textBlock;
      //
      //   //   .padStart(
      //   //   i + 1,
      //   //   " "
      //   // );
      //
      //   console.log( {
      //     paddedBlock
      //   } );
      //
      //   string.applyFontStyle( fontStyle );
      //
      //   result.push( {
      //     text: textBlock,
      //     box: font?.textBounds(
      //       paddedBlock,
      //       p.width * horizontalMargin,
      //       p.height * verticalMargin,
      //       fontStyle.size
      //     )
      //   } );
      // }

      return result;
    }
  );

  // string.write(
  //   text,
  //   p.width * horizontalMargin,
  //   p.height * verticalMargin,
  //   fontStyle
  // );

  // return;

  decomposedText.forEach( ( {
    text, box
  } ) => {
    p.push();
    p.stroke( 255 );
    p.strokeWeight( 1 );
    p.noFill();
    p.rect(
      box.x,
      box.y,
      box.w,
      box.h
    );
    p.pop();

    string.write(
      text,
      p.width * horizontalMargin + box.x,
      p.height * verticalMargin + box.y,
      fontStyle
    );
  } );

  // string.write(
  //   text,
  //   p.width * horizontalMargin + p.width * 0,
  //   p.height * verticalMargin + p.height * 0,
  //   {
  //     size: 112,
  //     stroke: "blue",
  //     fill: "white",
  //     strokeWeight: 3,
  //     font: string.fonts.spaceMonoRegular,
  //     textAlign: [
  //       "left",
  //       "top",
  //     ],
  //     blendMode: "source-over",
  //     textWidth: p.width - 2 * horizontalMargin,
  //     textHeight: p.height - 2 * verticalMargin,
  //     popPush: true,
  //   }
  // );

  // renderTitle( options.sketch?.text ?? options.name );
} );
