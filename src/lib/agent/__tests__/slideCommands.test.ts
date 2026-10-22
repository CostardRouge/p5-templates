import {
  createCommandRegistry
} from "../../../../scripts/mcp/registry.ts";
import {
  activeAfterRemoval, slideCommands
} from "../commands/slideCommands";
import {
  fakeHandles
} from "./fakeHandles";

function setup( document: Record<string, any> ) {
  const fake = fakeHandles( document );
  const registry = createCommandRegistry();

  registry.register( slideCommands( fake.handles ) );

  return {
    ...fake,
    registry
  };
}

describe(
  "slide commands",
  () => {
    it(
      "build a deck through the filmstrip's own handlers",
      async() => {
        const {
          registry, document, calls
        } = setup( {} );

        expect( await registry.execute(
          "slides.list",
          {}
        ) ).toEqual( {
          slides: [],
          activeSlide: null
        } );
        await expect( registry.execute(
          "slides.select",
          {
            index: 0
          }
        ) ).rejects.toMatchObject( {
          code: "invalid",
          message: "this piece has no slides — slides.add makes one"
        } );

        expect( await registry.execute(
          "slides.add",
          {}
        ) ).toMatchObject( {
          added: 0,
          activeSlide: 0
        } );
        await registry.execute(
          "slides.add",
          {}
        );
        await registry.execute(
          "slides.rename",
          {
            index: 0,
            name: "  Intro "
          }
        );
        expect( await registry.execute(
          "slides.duplicate",
          {
            index: 0
          }
        ) ).toMatchObject( {
          added: 1,
          activeSlide: 1
        } );
        expect( document.slides.map( ( slide: { name: string } ) => slide.name ) ).toEqual( [
          "Intro",
          "Intro",
          "Slide 2"
        ] );

        expect( await registry.execute(
          "slides.move",
          {
            from: 2,
            to: 0
          }
        ) ).toMatchObject( {
          activeSlide: 0
        } );
        expect( await registry.execute(
          "slides.select",
          {
            index: 2
          }
        ) ).toMatchObject( {
          activeSlide: 2
        } );
        expect( await registry.execute(
          "slides.remove",
          {
            index: 2
          }
        ) ).toMatchObject( {
          removed: 2,
          activeSlide: 1
        } );
        await expect( registry.execute(
          "slides.remove",
          {
            index: 5
          }
        ) ).rejects.toMatchObject( {
          message: "slide 5 does not exist — slides 0 to 1"
        } );
        await expect( registry.execute(
          "slides.rename",
          {
            index: 0,
            name: "   "
          }
        ) ).rejects.toMatchObject( {
          code: "invalid"
        } );
        expect( calls ).toEqual( [
          "add",
          "add",
          "rename 0 Intro",
          "duplicate 0",
          "move 2 0",
          "select 2",
          "remove 2"
        ] );
      }
    );
    it(
      "know which slide the filmstrip shows after a deletion",
      () => {
        expect( activeAfterRemoval(
          2,
          0,
          2
        ) ).toBe( 1 );
        expect( activeAfterRemoval(
          1,
          1,
          2
        ) ).toBe( 1 );
        expect( activeAfterRemoval(
          2,
          2,
          2
        ) ).toBe( 1 );
        expect( activeAfterRemoval(
          0,
          1,
          2
        ) ).toBe( 0 );
        expect( activeAfterRemoval(
          0,
          0,
          0
        ) ).toBeUndefined();
      }
    );
  }
);
