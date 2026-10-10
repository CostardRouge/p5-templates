import {
  isFieldInactive,
  resolveRelativePath
} from "../resolveRelativePath";

describe(
  "resolveRelativePath",
  () => {
    it(
      "resolves a sibling",
      () => {
        expect( resolveRelativePath(
          "sketch.material.ramp.palette",
          "stops"
        ) ).toBe( "sketch.material.ramp.stops" );
      }
    );

    it(
      "climbs to the sketch scope, inside a slide too",
      () => {
        expect( resolveRelativePath(
          "sketch.material.ramp.palette",
          "../../background"
        ) ).toBe( "sketch.background" );
        expect( resolveRelativePath(
          "slides.2.sketch.material.ramp.palette",
          "../../background"
        ) ).toBe( "slides.2.sketch.background" );
      }
    );

    it(
      "reaches into a sibling object of the field without climbing",
      () => {
        expect( resolveRelativePath(
          "sketch.background",
          "material/ramp/palette"
        ) ).toBe( "sketch.material.ramp.palette" );
      }
    );

    it(
      "refuses to climb past the root",
      () => {
        expect( resolveRelativePath(
          "palette",
          "../stops"
        ) ).toBeNull();
      }
    );
  }
);

describe(
  "isFieldInactive",
  () => {
    const rule = {
      field: "palette",
      equals: "custom"
    };

    it(
      "is live while the deciding field holds the value",
      () => {
        expect( isFieldInactive(
          rule,
          "custom"
        ) ).toBe( false );
      }
    );

    it(
      "is off for any other value",
      () => {
        expect( isFieldInactive(
          rule,
          "riso-pink-blue"
        ) ).toBe( true );
      }
    );

    it(
      "stays live without a rule or without a deciding value",
      () => {
        expect( isFieldInactive(
          undefined,
          "riso-pink-blue"
        ) ).toBe( false );
        expect( isFieldInactive(
          rule,
          undefined
        ) ).toBe( false );
      }
    );
  }
);
