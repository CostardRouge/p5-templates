"use client";

import {
  useEffect, useLayoutEffect, useRef
} from "react";
import {
  useRouter
} from "next/navigation";
import {
  useFormContext
} from "react-hook-form";

import useSketch from "@/components/ClientProcessingSketch/components/SketchProvider/hooks/useSketch";
import useAssetDrop from "@/hooks/useAssetDrop";
import {
  assetCommands
} from "@/lib/agent/commands/assetCommands";
import {
  contentCommands
} from "@/lib/agent/commands/contentCommands";
import {
  navigationCommands
} from "@/lib/agent/commands/navigationCommands";
import {
  exportCommands
} from "@/lib/agent/commands/exportCommands";
import {
  sketchCommands
} from "@/lib/agent/commands/sketchCommands";
import {
  slideCommands
} from "@/lib/agent/commands/slideCommands";
import type {
  StudioHandles
} from "@/lib/agent/handles";
import {
  blobToImageResult
} from "@/lib/agent/imageResult";
import {
  getBridgeSketch, getBridgeStatus, resumeBridge, sendFileToRelay, setBridgeSketch, studioCommands
} from "@/lib/agent/studioBridge";
import {
  getMetadata
} from "@/engines/metadata";
import {
  getAnimationBridge
} from "@/lib/animationBridge";
import {
  captureFreshPngBlob
} from "@/lib/canvasSnapshot";
import {
  runExportBatch
} from "@/lib/export/runExportBatch";
import {
  addVariant, ensureVariants, getVariantSnapshot, patchVariant, removeVariant
} from "@/lib/export/variantStore";
import {
  makeVariant, nativeFramerateFor, VARIANT_PRESETS
} from "@/lib/export/variants";
import {
  validateOptionsDocument
} from "@/lib/optionsDocument";
import type {
  SketchOption
} from "@/types/sketch.types";
import {
  findEmbeddableSketch, loadSketchForm
} from "@/lib/sketchLayerCatalogue";
import {
  getP5
} from "@/p5/utils/sketch";
import {
  getItemBounds
} from "@/p5/utils/slides/common/itemBoundsRegistry";
import type {
  FieldConfig
} from "./ContentItems/constants/field-config";
import makeDefaultItem from "./ContentItems/components/AddItemControls/utils/makeDefaultItem";
import type {
  ItemKind
} from "./ContentItems/components/AddItemControls/components/ItemPalette/types/item-kinds";
import {
  useFormUndoRedo
} from "./FormUndoRedo";
import {
  useSelectContentPath
} from "../hooks/useContentItemSelection";
import {
  addHudElementForControl, hudQuickAddKinds
} from "../utils/hudQuickAdd";
import {
  randomizeFields
} from "../utils/randomizeFields";

/**
 * `content.N` / `slides.S.content.N` → the drawn rectangle the p5 renderers
 * report for on-canvas grabbing (`itemBoundsRegistry`), as canvas fractions.
 */
function drawnBounds( path: string ) {
  const match = /^(?:content|slides\.(\d+)\.content)\.(\d+)$/.exec( path );
  const p = getP5() as { width: number;
    height: number } | null;

  if ( !match || !p?.width || !p.height ) {
    return null;
  }

  const rect = getItemBounds(
    match[ 1 ] === undefined ? "global" : `slide:${ match[ 1 ] }`,
    Number( match[ 2 ] ),
    // A playing sketch reports every frame; a paused one keeps its last report.
    30
  );

  return rect ? {
    x: rect.x / p.width,
    y: rect.y / p.height,
    w: rect.w / p.width,
    h: rect.h / p.height
  } : null;
}

/** The control at a dotted path through nested-object groups. */
function configAt(
  configuration: Record<string, FieldConfig>, path: string
): FieldConfig | null {
  let fields: Record<string, FieldConfig> | undefined = configuration;
  let found: FieldConfig | null = null;

  for ( const key of path.split( "." ) ) {
    found = fields?.[ key ] ?? null;
    if ( !found ) {
      return null;
    }
    fields = ( found as { fields?: Record<string, FieldConfig> } ).fields;
  }

  return found;
}

export type SlideHandlers = StudioHandles[ "slides" ];

/**
 * Registers the studio's agent commands (`src/lib/agent/`) while the sketch
 * page's form is mounted, wired to the funnels the controls use. Mounted inside
 * `FormProvider` / `FormUndoRedo` / `ContentSelectionProvider`, beside the
 * content selection listener, so it reaches every one of them; it renders
 * nothing. Every handle reads the latest value through a ref, so the commands
 * are registered once per sketch, not per render.
 */
export default function StudioCommands( {
  activeSlideIndex,
  slides,
  name,
  exportSupported
}: {
  activeSlideIndex: number | undefined;
  slides: SlideHandlers;
  /** The sketch's name as the Export dialog keys its variants and files. */
  name: string;
  exportSupported: boolean;
} ) {
  const form = useFormContext();
  const [
    state,
    dispatch
  ] = useSketch();
  const history = useFormUndoRedo();
  const selectPath = useSelectContentPath();
  const router = useRouter();
  const {
    addAssets
  } = useAssetDrop();
  const latest = useRef( {
    form,
    state,
    dispatch,
    history,
    selectPath,
    addAssets,
    activeSlideIndex,
    slides,
    exportSupported
  } );

  // The latest of everything, for handles that run long after this render.
  useLayoutEffect( () => {
    latest.current = {
      form,
      state,
      dispatch,
      history,
      selectPath,
      addAssets,
      activeSlideIndex,
      slides,
      exportSupported
    };
  } );

  const sketchId = [
    state.engineId,
    state.category,
    state.name
  ].filter( Boolean ).join( "/" );

  useEffect(
    () => {
      const now = () => latest.current;
      // The Export dialog's key: its variant list is stored per sketch.
      const variantKey = `${ state.engineId }/${ name }`;
      const preset = ( key: string ) => VARIANT_PRESETS.find( ( candidate ) => candidate.key === key ) ?? VARIANT_PRESETS[ 0 ];
      const handles: StudioHandles = {
        sketchId,
        engineId: state.engineId,
        getValues: ( path ) => path ? now().form.getValues( path ) : now().form.getValues(),
        setValue: (
          path, value
        ) => now().form.setValue(
          path,
          value,
          {
            shouldDirty: true,
            shouldValidate: true
          }
        ),
        get formConfiguration() {
          return ( now().state.sketchFormConfiguration ?? {} ) as Record<string, unknown>;
        },
        get formValues() {
          return ( now().state.sketchFormValues ?? {} ) as Record<string, unknown>;
        },
        activeSlide: () => now().activeSlideIndex,
        slides: {
          select: ( index ) => now().slides.select( index ),
          add: () => now().slides.add(),
          duplicate: ( index ) => now().slides.duplicate( index ),
          remove: ( index ) => now().slides.remove( index ),
          move: (
            from, to
          ) => now().slides.move(
            from,
            to
          ),
          rename: (
            index, name
          ) => now().slides.rename(
            index,
            name
          )
        },
        history: {
          undo: () => now().history.undo(),
          redo: () => now().history.redo(),
          // The flags follow a 400 ms debounced capture: flush it and read the
          // stacks, or a write made just now would not count yet.
          canUndo: () => {
            now().history.capture();

            return now().history.getHistory().past.length > 0;
          },
          canRedo: () => {
            now().history.capture();

            return now().history.getHistory().future.length > 0;
          }
        },
        playback: {
          isPlaying: () => now().state.looping,
          // The transport's own toggle: the engine, and the context's flag.
          play: () => {
            now().state.engine?.play();
            now().dispatch( {
              type: "SET_LOOPING",
              payload: true
            } );
          },
          pause: () => {
            now().state.engine?.pause();
            now().dispatch( {
              type: "SET_LOOPING",
              payload: false
            } );
          },
          seek: ( progress ) => {
            const bridge = getAnimationBridge();

            bridge?.setProgression( progress );
            bridge?.redraw();
          },
          progress: () => getAnimationBridge()?.getProgression() ?? null
        },
        timing: () => window.__sketchCapture?.timing?.() ?? null,
        snapshot: () => captureFreshPngBlob( now().state.engine ),
        imageResult: blobToImageResult,
        selectPath: ( path ) => now().selectPath( path ),
        makeItem: (
          kind, seed
        ) => makeDefaultItem(
          kind as ItemKind,
          seed
        ) as unknown as Record<string, unknown>,
        validateDocument: validateOptionsDocument,
        randomize: ( basePath ) => randomizeFields(
          ( now().state.sketchFormConfiguration ?? {} ) as Record<string, FieldConfig>,
          basePath,
          {
            getValues: ( path: string ) => now().form.getValues( path ),
            setValue: (
              path: string, value: unknown
            ) => now().form.setValue(
              path,
              value,
              {
                shouldDirty: true
              }
            )
          }
        ),
        sketchLayerSeed: async( path ) => {
          const choice = findEmbeddableSketch( path );

          if ( !choice ) {
            throw new Error( `no sketch "${ path }" can be a layer — give "<category>/<name>" of a p5 sketch in the gallery` );
          }
          if ( choice.unavailable ) {
            throw new Error( `${ path } cannot be a layer: ${ choice.unavailable }` );
          }

          const form = await loadSketchForm( choice.path );

          return {
            sketch: choice.path,
            settings: structuredClone( form.formValues )
          };
        },
        addHudForControl: (
          registeredName, kind
        ) => {
          const config = configAt(
            ( now().state.sketchFormConfiguration ?? {} ) as Record<string, FieldConfig>,
            registeredName.replace(
              /^(slides\.\d+\.)?sketch\./,
              ""
            )
          );

          if ( !config ) {
            return {
              path: null,
              kinds: []
            };
          }

          const kinds = hudQuickAddKinds(
            registeredName,
            config
          ) as string[];
          const chosen = kind ?? kinds[ 0 ];

          if ( !chosen || !kinds.includes( chosen ) ) {
            return {
              path: null,
              kinds
            };
          }

          return {
            path: addHudElementForControl(
              now().form.getValues,
              now().form.setValue,
              registeredName,
              config,
              chosen as ItemKind
            ),
            kinds
          };
        },
        itemBounds: async( path ) => {
          if ( now().state.engineId !== "p5" ) {
            return null;
          }
          // A write just made may not have been drawn yet.
          for ( let attempt = 0; attempt < 10; attempt++ ) {
            const bounds = drawnBounds( path );

            if ( bounds ) {
              return bounds;
            }
            await new Promise( ( resolve ) => setTimeout(
              resolve,
              50
            ) );
          }

          return null;
        },
        exports: {
          supported: () => now().exportSupported || "this browser cannot export (no WebCodecs encoder) — use a recent Chrome, Edge or Safari",
          presets: VARIANT_PRESETS,
          list: () => ensureVariants( variantKey ).variants,
          add: ( key ) => {
            addVariant(
              variantKey,
              preset( key )
            );

            return getVariantSnapshot( variantKey ).variants.at( -1 ) as ReturnType<typeof makeVariant>;
          },
          make: ( key ) => makeVariant( preset( key ) ),
          patch: (
            id, patch
          ) => patchVariant(
            variantKey,
            id,
            patch
          ),
          remove: ( id ) => removeVariant(
            variantKey,
            id
          ),
          nativeFramerate: () => nativeFramerateFor(
            now().form.getValues() as SketchOption,
            now().activeSlideIndex
          ),
          run: (
            variants, onArtifacts, onProgress, signal
          ) => {
            const engine = now().state.engine;

            if ( !engine ) {
              throw new Error( "the sketch is not running yet" );
            }

            return runExportBatch( {
              engine,
              options: now().form.getValues() as SketchOption,
              sketchName: name,
              activeSlideIndex: now().activeSlideIndex,
              variants,
              onArtifacts,
              onProgress,
              signal
            } );
          }
        },
        addAsset: async(
          file, kind, slide
        ) => {
          const files = new DataTransfer();

          files.items.add( file );

          const [
            path
          ] = await now().addAssets( {
            files: files.files,
            type: kind,
            scope: slide === undefined ? "global" : {
              slide
            }
          } );

          if ( !path ) {
            throw new Error( `${ file.name } could not be read as ${ kind }` );
          }

          // The form is the source of truth (as useAssetsBridge does after the picker).
          const listPath = `${ slide === undefined ? "assets" : `slides.${ slide }.assets` }.${ kind }`;
          const current = now().form.getValues( listPath );

          now().form.setValue(
            listPath,
            [
              ...new Set( [
                ...( Array.isArray( current ) ? current : [] ),
                path
              ] )
            ],
            {
              shouldDirty: true
            }
          );

          return path;
        },
        navigation: {
          catalogue: getMetadata,
          open: ( href ) => router.push( href ),
          currentSketch: getBridgeSketch
        },
        saveFile: sendFileToRelay,
        relayConnected: () => getBridgeStatus().state === "connected"
      };
      const off = studioCommands.register( [
        ...sketchCommands( handles ),
        ...contentCommands( handles ),
        ...slideCommands( handles ),
        ...exportCommands( handles ),
        ...assetCommands( handles ),
        ...navigationCommands( handles )
      ] );

      setBridgeSketch( sketchId );
      resumeBridge();

      return off;
    },
    [
      sketchId,
      state.engineId,
      name,
      router
    ]
  );

  return null;
}
