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
