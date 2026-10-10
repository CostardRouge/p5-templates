import type {
  ExportVariant
} from "../../export/variants";
import type {
  StudioHandles
} from "../handles";

/** A studio without React: a plain document, recorded writes and calls. */
export function fakeHandles(
  document: Record<string, any>, overrides: Partial<StudioHandles> = {}
) {
  const writes: [ string, unknown ][] = [];
  const calls: string[] = [];
  let active: number | undefined;
  let variants: ExportVariant[] = [];
  let opened = "p5/noise/noise-v1";
  let made = 0;

  function makeVariant( key: string ): ExportVariant {
    made += 1;

    return {
      id: `v${ made }`,
      name: key === "still" ? "Still image" : "Square",
      kind: key === "still" ? "image" : "video",
      size: key === "still" ? null : {
        width: 1080,
        height: 1080
      },
      framerate: null,
      format: "mp4",
      frameCount: 10,
      slides: "current",
      delivery: "separate",
      sizeStrategy: "smallest"
    };
  }

  function at( path?: string ) {
    if ( !path ) {
      return document;
    }

    return path.split( "." ).reduce<any>(
      (
        node, key
      ) => node?.[ key ],
      document
    );
  }

  function put(
    path: string, value: unknown
  ) {
    const keys = path.split( "." );
    const last = keys.pop() as string;
    const parent = keys.reduce<any>(
      (
        node, key
      ) => {
        node[ key ] ??= {};

        return node[ key ];
      },
      document
    );

    parent[ last ] = value;
  }

  const handles: StudioHandles = {
    sketchId: "p5/voronoi/voronoi-v1-cells",
    engineId: "p5",
    getValues: ( path ) => at( path ),
    setValue: (
      path, value
    ) => {
      writes.push( [
        path,
        value
      ] );
      put(
        path,
        value
      );
    },
    formConfiguration: {
      render: {
        component: "nested-object",
        fields: {
          hueSpeed: {
            component: "slider",
            min: 0,
            max: 3
          },
          palette: {
            component: "select",
            options: [
              {
                value: "rainbow"
              },
              {
                value: "sunset"
              }
            ]
          }
        }
      }
    },
    formValues: {
      render: {
        hueSpeed: 0,
        palette: "rainbow"
      }
    },
    activeSlide: () => active,
    slides: {
      select: ( index ) => {
        calls.push( `select ${ index }` );
        active = index;
      },
      add: () => {
        calls.push( "add" );
        document.slides = [
          ...( document.slides ?? [] ),
          {
            name: `Slide ${ ( document.slides ?? [] ).length + 1 }`,
            content: []
          }
        ];
        active = document.slides.length - 1;
      },
      duplicate: ( index ) => {
        calls.push( `duplicate ${ index }` );
        document.slides.splice(
          index + 1,
          0,
          structuredClone( document.slides[ index ] )
        );
        active = index + 1;
      },
      remove: ( index ) => {
        calls.push( `remove ${ index }` );
        document.slides.splice(
          index,
          1
        );
        active = document.slides.length ? Math.min(
          index,
          document.slides.length - 1
        ) : undefined;
      },
      move: (
        from, to
      ) => {
        calls.push( `move ${ from } ${ to }` );
        const [
          slide
        ] = document.slides.splice(
          from,
          1
        );

        document.slides.splice(
          to,
          0,
          slide
        );
        active = to;
      },
      rename: (
        index, name
      ) => {
        calls.push( `rename ${ index } ${ name }` );
        document.slides[ index ].name = name;
      }
    },
    history: {
      undo: () => calls.push( "undo" ),
      redo: () => calls.push( "redo" ),
      canUndo: () => true,
      canRedo: () => false
    },
    playback: {
      isPlaying: () => true,
      play: () => calls.push( "play" ),
      pause: () => calls.push( "pause" ),
      seek: ( progress ) => calls.push( `seek ${ progress }` ),
      progress: () => 0.25
    },
    timing: () => ( {
      frameRate: 60,
      duration: 12,
      totalFrames: 720
    } ),
    snapshot: async() => new Blob( [
      "png"
    ] ),
    imageResult: async(
      _blob, maxEdge, format, note
    ) => ( {
      kind: "image",
      mimeType: format === "png" ? "image/png" : "image/jpeg",
      data: "QQ==",
      width: maxEdge,
      height: maxEdge,
      note
    } ),
    selectPath: ( path ) => calls.push( `selectPath ${ path }` ),
    makeItem: (
      kind, seed
    ) => ( {
      type: kind,
      enabled: true,
      position: {
        x: 0.5,
        y: 0.5
      },
      ...seed
    } ),
    validateDocument: ( doc: any ) => ( {
      issues: [],
      normalized: doc
    } ),
    randomize: ( basePath ) => calls.push( `randomize ${ basePath }` ),
    saveFile: async(
      _blob, name
    ) => ( {
      path: `/out/${ name }`,
      bytes: 3
    } ),
    relayConnected: () => true,
    navigation: {
      catalogue: () => [
        {
          engine: "p5",
          category: "voronoi",
          name: "voronoi-v1-cells"
        },
        {
          engine: "p5",
          category: "voronoi",
          name: "voronoi-v2-draft",
          hiddenFromGallery: true
        },
        {
          engine: "threejs",
          category: "dragon",
          name: "dragon-corridor"
        }
      ],
      open: ( href ) => {
        calls.push( `open ${ href }` );
        opened = href.replace(
          "/sketches/",
          ""
        );
      },
      currentSketch: () => opened
    },
    addAsset: async(
      file, kind, slide
    ) => {
      const path = `${ slide === undefined ? "global" : `slide-${ slide }` }/${ kind }/${ file.name }`;
      const base = slide === undefined ? "assets" : `slides.${ slide }.assets`;

      put(
        `${ base }.${ kind }`,
        [
          ...( at( `${ base }.${ kind }` ) ?? [] ),
          path
        ]
      );
      calls.push( `asset ${ path } ${ file.size }` );

      return path;
    },
    exports: {
      supported: () => true,
      presets: [
        {
          key: "square",
          label: "Square",
          size: {
            width: 1080,
            height: 1080
          }
        },
        {
          key: "still",
          label: "Still image",
          kind: "image"
        }
      ],
      list: () => variants,
      add: ( key ) => {
        const variant = makeVariant( key );

        variants.push( variant );

        return variant;
      },
      make: makeVariant,
      patch: (
        id, patch
      ) => {
        const index = variants.findIndex( ( variant ) => variant.id === id );

        variants[ index ] = {
          ...variants[ index ],
          ...patch
        };
      },
      remove: ( id ) => {
        variants = variants.filter( ( variant ) => variant.id !== id );
      },
      nativeFramerate: () => 30,
      run: async(
        list, onArtifacts, onProgress
      ) => {
        calls.push( `export ${ list.map( ( variant ) => variant.name ).join( "," ) }` );

        const items = list.map( ( variant ) => {
          onArtifacts(
            variant.id,
            [
              {
                fileName: `${ variant.name }.${ variant.kind === "image" ? "png" : variant.format }`,
                blob: new Blob( [
                  "x"
                ] )
              }
            ],
            `${ variant.name }.zip`
          );

          return {
            variantId: variant.id,
            status: "done" as const,
            percentage: 100,
            phase: "encoding" as const,
            phaseProgress: 1
          };
        } );

        onProgress( items );

        return items;
      }
    },
    // Only the second item is "on screen", drawn at its own offset.
    itemBounds: async( path ) => path === "content.1" ? {
      x: 0.1,
      y: 0.1,
      w: 0.2,
      h: 0.1
    } : null,
    sketchLayerSeed: async( path ) => {
      if ( path !== "noise/noise-v1" ) {
        throw new Error( `no sketch "${ path }" can be a layer` );
      }

      return {
        sketch: path,
        settings: {
          amount: 1
        }
      };
    },
    addHudForControl: (
      registeredName, kind
    ) => {
      const kinds = registeredName.endsWith( "hueSpeed" ) ? [
        "hud-counter",
        "hud-gauge",
        "hud-sparkline"
      ] : [];
      const chosen = kind ?? kinds[ 0 ];

      if ( !chosen || !kinds.includes( chosen ) ) {
        return {
          path: null,
          kinds
        };
      }
      calls.push( `hud ${ registeredName } ${ chosen }` );

      return {
        path: "content.0",
        kinds
      };
    },
    ...overrides
  };

  return {
    handles,
    writes,
    calls,
    document,
    setActive: ( index: number | undefined ) => {
      active = index;
    }
  };
}
