import {
  PALETTES,
  PALETTE_FORMULAS,
  PALETTE_RAMP_WIDTH,
  SHADER_PALETTE_OPTIONS,
  HOUSE_PALETTE_IDS,
  bakePaletteRamp,
  housePaletteOptions,
  paletteColorAt,
  paletteSampler,
  shaderPalette,
  shaderPaletteBackground
} from "../palettes.js";

describe(
  "formula palettes",
  () => {
    it.each( [
      "rainbow",
      "oil-slick"
    ] )(
      "%s bakes its formula exactly at every texel",
      ( formula ) => {
        const {
          bytes, width
        } = bakePaletteRamp( {
          formula
        } );

        expect( width ).toBe( PALETTE_RAMP_WIDTH );

        let worst = 0;

        for ( let i = 0; i < width; i++ ) {
          const expected = PALETTE_FORMULAS[ formula ]( ( i + 0.5 ) / width );

          for ( let ch = 0; ch < 3; ch++ ) {
            worst = Math.max(
              worst,
              Math.abs( bytes[ i * 4 + ch ] - expected[ ch ] )
            );
          }
        }

        // Rounding only.
        expect( worst ).toBeLessThanOrEqual( 0.5 );
      }
    );

    it(
      "keeps the peaks rainbow's colors.rainbow arithmetic",
      () => {
        // hueIndex 0: sin 0 = 0, cos 0 = 1 → (180, 0, 180).
        expect( PALETTE_FORMULAS.rainbow( 0 ) ).toEqual( [
          180,
          0,
          180
        ] );
        // A quarter turn: sin = 1 → red clipped at 255, blue 0.
        const quarter = PALETTE_FORMULAS.rainbow( 0.25 );

        expect( quarter[ 0 ] ).toBe( 255 );
        expect( quarter[ 1 ] ).toBeCloseTo( 180 );
        expect( quarter[ 2 ] ).toBeCloseTo( 0 );
      }
    );

    it(
      "bakes from the formula, not from its swatch stops",
      () => {
        expect( bakePaletteRamp( PALETTES.rainbow ).key ).toBe( "formula:rainbow" );
        expect( PALETTES.rainbow.stops ).toHaveLength( 24 );
      }
    );
  }
);

describe(
  "shader palettes",
  () => {
    it(
      "offers Original first and does not list the oil slick twice",
      () => {
        expect( SHADER_PALETTE_OPTIONS[ 0 ].value ).toBe( "original" );
        expect( SHADER_PALETTE_OPTIONS.some( ( option ) => option.value === "oil-slick" ) ).toBe( false );
      }
    );

    it(
      "switches the ramp off for Original, an absent value or an unknown id",
      () => {
        expect( shaderPalette( {
          palette: "original"
        } ).uniforms.uPaletteOn ).toBe( 0 );
        expect( shaderPalette( undefined ).uniforms.uPaletteOn ).toBe( 0 );
        expect( shaderPalette( {
          palette: "nope"
        } ).uniforms.uPaletteOn ).toBe( 0 );
      }
    );

    it(
      "hands a 256-texel ramp for a preset, baked once per id",
      () => {
        const first = shaderPalette( {
          palette: "riso-pink-blue"
        } );
        const second = shaderPalette( {
          palette: "riso-pink-blue"
        } );

        expect( first.uniforms.uPaletteOn ).toBe( 1 );
        expect( first.textures.uPaletteRamp.width ).toBe( 256 );
        expect( second.textures.uPaletteRamp ).toBe( first.textures.uPaletteRamp );
      }
    );

    it(
      "keeps the sketch's background unless the palette's is asked for",
      () => {
        const own = [
          10,
          20,
          30,
          255
        ];

        expect( shaderPaletteBackground(
          {
            palette: "riso-pink-blue"
          },
          own
        ) ).toBe( own );
        expect( shaderPaletteBackground(
          {
            palette: "original",
            paletteBackground: true
          },
          own
        ) ).toBe( own );
        // Riso paper: (245,240,230) over (234,227,212), averaged, own alpha kept.
        expect( shaderPaletteBackground(
          {
            palette: "riso-pink-blue",
            paletteBackground: true
          },
          own
        ) ).toEqual( [
          240,
          234,
          221,
          255
        ] );
      }
    );

    it(
      "samples the CPU ramp at texel centres and loops past the ends",
      () => {
        const colors = {
          palette: "riso-pink-blue"
        };
        const bytes = shaderPalette( colors ).textures.uPaletteRamp.data;
        const texel = ( i: number ) => [
          bytes[ i * 4 ],
          bytes[ i * 4 + 1 ],
          bytes[ i * 4 + 2 ]
        ];

        expect( paletteColorAt(
          {
            palette: "original"
          },
          0.3
        ) ).toBeNull();
        expect( paletteColorAt(
          colors,
          10.5 / PALETTE_RAMP_WIDTH
        ) ).toEqual( texel( 10 ) );
        expect( paletteColorAt(
          colors,
          1 + 10.5 / PALETTE_RAMP_WIDTH
        ) ).toEqual( texel( 10 ) );
        // Halfway between the last texel and the first: the ramp wraps.
        const seam = paletteColorAt(
          colors,
          0
        ) as number[];

        seam.forEach( (
          channel, i
        ) => {
          expect( channel ).toBeCloseTo( ( texel( 255 )[ i ] + texel( 0 )[ i ] ) / 2 );
        } );
      }
    );
  }
);

describe(
  "2D house palettes",
  () => {
    it(
      "lists the sketch's own functions first, then the shared presets minus the house rainbow",
      () => {
        const options = housePaletteOptions( [
          "purple",
          "rainbow"
        ] );

        expect( options.slice(
          0,
          2
        ).map( ( option ) => option.value ) ).toEqual( [
          "purple",
          "rainbow"
        ] );
        expect( options.filter( ( option ) => option.value === "rainbow" ) ).toHaveLength( 1 );
        expect( options.some( ( option ) => option.value === "riso-pink-blue" ) ).toBe( true );
        options.forEach( ( option ) => expect( option.stops.length ).toBeGreaterThan( 1 ) );
      }
    );

    it(
      "samples a shared preset exactly as the CPU ramp read, and never a house id",
      () => {
        HOUSE_PALETTE_IDS.forEach( ( id ) => expect( paletteSampler( id ) ).toBeNull() );
        expect( paletteSampler( "original" ) ).toBeNull();
        expect( paletteSampler( "nope" ) ).toBeNull();

        const sample = paletteSampler( "riso-pink-blue" ) as ( x: number ) => number[];

        [
          0,
          0.1234,
          0.5,
          0.999
        ].forEach( ( x ) => {
          expect( sample( x ) ).toEqual( paletteColorAt(
            {
              palette: "riso-pink-blue"
            },
            x
          ) );
        } );
      }
    );
  }
);
