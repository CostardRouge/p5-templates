import parseImportedOptions from "@/utils/parseImportedOptions";
import initOptions from "@/utils/initOptions";

describe(
  "parseImportedOptions",
  () => {
    it(
      "accepts a saved options file and returns exactly what initOptions would",
      () => {
        const saved = {
          ...initOptions( {} ),
          content: [
            {
              type: "text",
              content: "hello"
            }
          ]
        };

        const parsed = parseImportedOptions( saved );

        expect( parsed.ok ).toBe( true );
        expect( parsed.ok && parsed.options ).toEqual( initOptions( saved ) );
      }
    );

    it(
      "migrates a legacy hud item instead of refusing it",
      () => {
        const parsed = parseImportedOptions( {
          content: [
            {
              type: "hud"
            }
          ]
        } );

        expect( parsed.ok ).toBe( true );
        expect( parsed.ok && parsed.options.content?.map( ( item: {
          type: string;
        } ) => item.type ) ).toEqual( [
          "hud-sparkline",
          "hud-gauge"
        ] );
      }
    );

    it(
      "refuses a file initOptions would silently replace with blank defaults, naming the path",
      () => {
        const retired = {
          content: [
            {
              type: "visual"
            }
          ]
        };

        // What the studio used to apply: the whole document reset.
        expect( initOptions( retired ) ).toEqual( initOptions( {} ) );

        const parsed = parseImportedOptions( retired );

        expect( parsed.ok ).toBe( false );
        expect( !parsed.ok && parsed.reason ).toMatch( /^content\.0/ );
      }
    );

    it.each( [
      [
        "a string",
        "options"
      ],
      [
        "an array",
        []
      ],
      [
        "null",
        null
      ]
    ] )(
      "refuses %s",
      (
        _label, value
      ) => {
        expect( parseImportedOptions( value ).ok ).toBe( false );
      }
    );
  }
);
