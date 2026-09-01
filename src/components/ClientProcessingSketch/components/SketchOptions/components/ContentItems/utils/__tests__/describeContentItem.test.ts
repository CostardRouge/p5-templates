import describeContentItem from "../describeContentItem";

describe(
  "describeContentItem",
  () => {
    it(
      "names a layer by its type's label",
      () => {
        expect( describeContentItem( {
          type: "qrcode"
        } ).label ).toBe( "QR code" );
        expect( describeContentItem( {
          type: "images-stack"
        } ).label ).toBe( "Image stack" );
      }
    );

    it(
      "previews the text a text or title layer prints",
      () => {
        expect( describeContentItem( {
          type: "text",
          content: "Bonjour"
        } ).preview ).toBe( "Bonjour" );
        expect( describeContentItem( {
          type: "title",
          content: "Hello"
        } ).preview ).toBe( "Hello" );
      }
    );

    it(
      "collapses whitespace and cuts a long preview",
      () => {
        const description = describeContentItem( {
          type: "text",
          content: "  a  line\nand another that runs well past the limit  "
        } );

        expect( description.preview ).toBe( "a line and another that runs…" );
        expect( description.preview!.length ).toBeLessThanOrEqual( 32 );
      }
    );

    it(
      "previews an image by file name, not by its full path",
      () => {
        expect( describeContentItem( {
          type: "image",
          source: "/api/s3/uploads/sunset.png?v=2"
        } ).preview ).toBe( "sunset.png" );
      }
    );

    it(
      "counts a stack, but names it when it holds a single image",
      () => {
        expect( describeContentItem( {
          type: "images-stack",
          sources: [
            "a/one.png",
            "b/two.png"
          ]
        } ).preview ).toBe( "2 images" );
        expect( describeContentItem( {
          type: "images-stack",
          sources: [
            "a/only.png"
          ]
        } ).preview ).toBe( "only.png" );
      }
    );

    it(
      "reads the first filled corner of a meta block",
      () => {
        expect( describeContentItem( {
          type: "meta",
          topLeft: "",
          topRight: "  ",
          bottomLeft: "@costardrouge"
        } ).preview ).toBe( "@costardrouge" );
      }
    );

    it(
      "previews a HUD badge by its override, else its segments",
      () => {
        expect( describeContentItem( {
          type: "hud-badge",
          override: "custom line",
          segments: [
            "engine",
            "name"
          ]
        } ).preview ).toBe( "custom line" );
        expect( describeContentItem( {
          type: "hud-badge",
          override: "",
          segments: [
            "engine",
            "name"
          ]
        } ).preview ).toBe( "engine · name" );
      }
    );

    it(
      "previews the other HUD elements by label, else bound source",
      () => {
        expect( describeContentItem( {
          type: "hud-counter",
          label: "",
          source: "magnitude.start"
        } ).preview ).toBe( "magnitude.start" );
        expect( describeContentItem( {
          type: "hud-gauge",
          label: "SPEED",
          source: "progress%"
        } ).preview ).toBe( "SPEED" );
      }
    );

    it(
      "leaves the preview out when the layer carries nothing readable",
      () => {
        expect( describeContentItem( {
          type: "hud-badge",
          override: "",
          segments: []
        } ).preview ).toBeUndefined();
        expect( describeContentItem( {
          type: "text",
          content: ""
        } ).preview ).toBeUndefined();
      }
    );

    it(
      "survives an unknown or missing type rather than throwing",
      () => {
        expect( describeContentItem( undefined ).label ).toBe( "Layer" );
        expect( describeContentItem( {
          type: "not-a-kind"
        } ).label ).toBe( "not-a-kind" );
      }
    );
  }
);
