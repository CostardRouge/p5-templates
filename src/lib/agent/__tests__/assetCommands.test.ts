import {
  createCommandRegistry
} from "../../../../scripts/mcp/registry.ts";
import {
  assetCommands, assetKindOf, safeAssetName
} from "../commands/assetCommands";
import {
  fakeHandles
} from "./fakeHandles";

function setup( document: Record<string, any> ) {
  const fake = fakeHandles( document );
  const registry = createCommandRegistry();

  registry.register( assetCommands( fake.handles ) );

  return {
    ...fake,
    registry
  };
}

describe(
  "asset commands",
  () => {
    it(
      "tell a file's kind and keep its name to one safe segment",
      () => {
        expect( assetKindOf(
          "a.bin",
          "image/png"
        ) ).toBe( "images" );
        expect( assetKindOf(
          "clip.MOV",
          ""
        ) ).toBe( "videos" );
        expect( assetKindOf(
          "notes.txt",
          ""
        ) ).toBeNull();
        expect( safeAssetName( "../../my logo (1).png" ) ).toBe( "my-logo-1-.png" );
        expect( () => safeAssetName( "logo" ) ).toThrow( "needs a file name with an extension" );
      }
    );

    it(
      "add from base64 to the root or a slide, and remove only what nothing shows",
      async() => {
        const {
          registry, document, calls
        } = setup( {
          slides: [
            {
              content: []
            }
          ]
        } );

        expect( await registry.execute(
          "assets.add",
          {
            name: "dot.png",
            data: "data:image/png;base64,iVBORw0KGgo=",
            root: true
          }
        ) ).toMatchObject( {
          path: "global/images/dot.png",
          kind: "images",
          bytes: 8,
          scope: "the root"
        } );
        expect( await registry.execute(
          "assets.add",
          {
            name: "song.mp3",
            data: "AAAA",
            slide: 0
          }
        ) ).toMatchObject( {
          path: "slide-0/audios/song.mp3"
        } );
        await expect( registry.execute(
          "assets.add",
          {
            name: "x.png",
            data: "not base64!"
          }
        ) ).rejects.toMatchObject( {
          message: "data is not base64"
        } );
        await expect( registry.execute(
          "assets.add",
          {
            name: "x.png",
            url: "file:///etc/passwd"
          }
        ) ).rejects.toMatchObject( {
          message: "url must be http(s)"
        } );
        expect( calls ).toEqual( [
          "asset global/images/dot.png 8",
          "asset slide-0/audios/song.mp3 3"
        ] );

        document.slides[ 0 ].content.push( {
          type: "image",
          source: "global/images/dot.png"
        } );
        await expect( registry.execute(
          "assets.remove",
          {
            path: "global/images/dot.png",
            root: true
          }
        ) ).rejects.toMatchObject( {
          message: "global/images/dot.png is still shown by slides.0.content.0"
        } );
        document.slides[ 0 ].content.pop();
        await registry.execute(
          "assets.remove",
          {
            path: "global/images/dot.png",
            root: true
          }
        );
        expect( document.assets.images ).toEqual( [] );
        expect( await registry.execute(
          "assets.list",
          {
            slide: 0
          }
        ) ).toMatchObject( {
          audios: [
            "slide-0/audios/song.mp3"
          ]
        } );
      }
    );
  }
);
