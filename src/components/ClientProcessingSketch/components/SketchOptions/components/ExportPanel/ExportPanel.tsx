"use client";

import clsx from "clsx";
import React, {
  useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore
} from "react";
import {
  ChevronUp, History, Plus
} from "lucide-react";
import {
  Menu, MenuButton, MenuItem, MenuItems
} from "@headlessui/react";
import {
  runExportBatch, type ExportArtifact, type ExportItemState
} from "@/lib/export/runExportBatch";
import {
  downloadArtifacts,
  isDelivered,
  saveArtifacts,
  shouldDeferDelivery,
  type SaveOutcome
} from "@/lib/export/delivery";
import {
  addVariant,
  duplicateVariantById,
  ensureVariants,
  getVariantSnapshot,
  patchVariant,
  removeVariant,
  subscribeVariants
} from "@/lib/export/variantStore";
import {
  hasMixedSlideSizes,
  nativeFramerateFor,
  nativeSizeFor,
  resolveSlideIndices,
  resolveRunSize,
  slugify,
  VARIANT_PRESETS,
  type ExportVariant
} from "@/lib/export/variants";
import {
  PROVIDER_GLYPH
} from "@/components/ChannelChip";
import {
  keepPiece
} from "@/lib/gallery/keep";
import {
  getGalleryStore
} from "@/lib/gallery/store";
import {
  captureGalleryThumbnail
} from "@/lib/gallery/thumbnail";
import {
  PostizClient, postizHome, type PostizPost
} from "@/lib/postiz/client";
import {
  publishFacts
} from "@/lib/postiz/facts";
import SketchSheetLoader from "@/components/GalleryPage/SketchSheetLoader";
import {
  postedLine
} from "@/lib/gallery/sends";
import {
  planPost, plannedInstants, routeWords, type PostPlan
} from "@/lib/postiz/plan";
import {
  postShape
} from "@/lib/postiz/postShape";
import {
  updatePostiz
} from "@/lib/postiz/store";
import {
  DEFAULT_DRAFT,
  addPublication,
  dropPublication,
  getDraft,
  getPublications,
  getWhen,
  patchDraft,
  setWhen,
  subscribePublish,
  type DeliverMode,
  type Publication,
  type When
} from "@/lib/postiz/publishStore";
import {
  mimeOf, postableFile, sendRoutes
} from "@/lib/postiz/send";
import {
  failedChannels, mergeResend, outcomeWindow, type AccountOutcome
} from "@/lib/postiz/outcome";
import {
  usePostiz
} from "@/lib/postiz/usePostiz";
import useSketch from "../../../SketchProvider/hooks/useSketch";
import PostBand from "./components/PostBand";
import {
  PublishReview, PublishSent
} from "./components/PublishScreens";
import ExportPreview from "./components/ExportPreview";
import VariantTableRow, {
  VARIANT_GRID
} from "./components/VariantTableRow";
import type {
  RecordingFormat
} from "@/engines/recording";
import type {
  SketchOption
} from "@/types/sketch.types";

type ExportPanelProps = {
  name: string;
  options: SketchOption;
  activeSlideIndex: number | undefined;
  /** How many produced files are still unsaved, so the dialog can guard its
   *  close — the panel unmounts with it and the blobs die there. */
  onPendingChange?: ( count: number ) => void;
};

/** One variant's output, plus the name it takes when zipped into one file. */
type VariantOutput = {
  artifacts: ExportArtifact[];
  bundleFileName: string;
};

const FALLBACK_FORMATS: RecordingFormat[] = [
  "mp4",
  "webm",
  "gif"
];

/** How far ahead Postiz's planned posts are read, to mark the rhythm's slots taken. */
const AHEAD_DAYS = 42;
const NEXT: When = {
  kind: "next"
};

/** An artifact as a typed File: the recorder may hand back an untyped blob, and Postiz needs the type. */
function artifactFile( artifact: ExportArtifact ): File {
  return new File(
    [
      artifact.blob
    ],
    artifact.fileName,
    {
      type: mimeOf(
        artifact.fileName,
        artifact.blob.type
      )
    }
  );
}

/** What a publish run hands from the render to the send: the plan as it was pressed. */
/** The server's snapshot of a sketch's sends: none, one stable array. */
const NO_PUBLICATIONS: Publication[] = [];

type PublishSnapshot = {
  plan: PostPlan;
  target: Date | "now" | "draft";
  /** The gallery piece this run kept, so the gallery's card knows its posts. */
  pieceId?: string;
};

/** Publish's screens, in the table's place like the preview. */
type PublishView =
  | { kind: "review";
    /** Each variant's files, by variant id. */
    files: Map<string, File[]>;
    snapshot: PublishSnapshot }
  | { kind: "sent";
    files: File[];
    publication: Publication;
    /** What was sent, kept for *Send again*: the plan and each variant's postable files. */
    snapshot: PublishSnapshot;
    postable: Map<string, File[]> };

const HEAD_CELL =
  "px-2.5 text-left text-[9.5px] font-semibold uppercase tracking-[0.09em] text-label";

/** What to say when a save did not put anything anywhere. */
const SAVE_NOTICE: Record<string, string> = {
  dismissed: "Nothing saved — you dismissed the sheet.",
  busy: "A share sheet is already open. Close it and try again.",
  failed: "Those files could not be saved."
};

/**
 * The export surface: one row per variant, every setting editable in place.
 *
 * The batch IS the table. An earlier split — a list of variants beside an
 * editor for the selected one — showed one variant's settings and summarised
 * the other two, which is the wrong shape for a tool whose whole job is
 * producing several outputs at once. Here all of them are readable together,
 * nothing is stated twice, and a column that does not apply to a variant says
 * so with a dash instead of offering a control that would be ignored.
 *
 * The row doubles as the run queue: progress is the row inverting under an ink
 * wipe, a phase meter under its status and a slide counter in its Slides cell,
 * so what is happening is attached to the variant it happens to. The footer's
 * own 2px bar is the batch's, which a per-row reading cannot answer.
 *
 * The same table serves every viewport — a phone scrolls it sideways rather
 * than folding into cards, so there is one layout to reason about and one set
 * of controls. Its rows grow to a thumb's height below `md`.
 *
 * **The panel also owns delivery**, which the runner used to do itself. On a
 * device with a share sheet nothing is delivered automatically: the run ends
 * holding its files and the footer turns into a save action, because several
 * unattended downloads there raise modal prompts that overwrite one another and
 * report nothing back. See `src/lib/export/delivery.ts`.
 */
export default function ExportPanel( {
  name,
  options,
  activeSlideIndex,
  onPendingChange
}: ExportPanelProps ) {
  const [
    {
      engine, engineId, category
    }
  ] = useSketch();

  const sketchKey = `${ engineId }/${ name }`;

  // Seed before the first subscription read so the table is never momentarily
  // empty on open.
  ensureVariants( sketchKey );

  const snapshot = useSyncExternalStore(
    subscribeVariants,
    () => getVariantSnapshot( sketchKey ),
    () => getVariantSnapshot( sketchKey )
  );

  const [
    items,
    setItems
  ] = useState<ExportItemState[]>( [] );
  const [
    running,
    setRunning
  ] = useState( false );
  const [
    error,
    setError
  ] = useState<string | null>( null );

  // What each finished variant produced, kept so it can be previewed and — on
  // a deferred device — so it can still be saved after the run. ExportPanel is
  // mounted only while the dialog is open, so this dies with the dialog.
  const [
    outputs,
    setOutputs
  ] = useState<Record<string, VariantOutput>>( {} );
  const [
    saved,
    setSaved
  ] = useState<Record<string, SaveOutcome>>( {} );
  const [
    saving,
    setSaving
  ] = useState( false );
  const [
    notice,
    setNotice
  ] = useState<string | null>( null );
  const [
    previewing,
    setPreviewing
  ] = useState<string | null>( null );
  const abortRef = useRef<AbortController | null>( null );
  const scrollRef = useRef<HTMLDivElement | null>( null );

  // ---- Export › Publish (lab 1, docs/memory/publishing.md) ----
  const postiz = usePostiz();
  const canPublish = Boolean( postiz && postiz.channels.length > 0 );
  const draft = useSyncExternalStore(
    subscribePublish,
    () => getDraft( sketchKey ),
    () => DEFAULT_DRAFT
  );
  const when = useSyncExternalStore(
    subscribePublish,
    () => getWhen( sketchKey ),
    () => NEXT
  );
  const publishMode = canPublish && draft.mode === "publish";
  const publications = useSyncExternalStore(
    subscribePublish,
    () => getPublications( sketchKey ),
    () => NO_PUBLICATIONS
  );
  const postedWords = postiz ? postedLine(
    publications,
    postiz.channels,
    postiz.rhythm.timeZone,
    // eslint-disable-next-line react-hooks/purity -- a day-precision label, re-read with the store
    Date.now()
  ) : null;
  const [
    sheetOpen,
    setSheetOpen
  ] = useState( false );
  const [
    planned,
    setPlanned
  ] = useState<PostizPost[] | null>( null );
  const [
    publishView,
    setPublishView
  ] = useState<PublishView | null>( null );
  const [
    sending,
    setSending
  ] = useState<string | null>( null );
  const [
    verbMenu,
    setVerbMenu
  ] = useState( false );
  /** Set while a run renders for Publish: its files are not delivered, they are sent. */
  const publishingRef = useRef( false );
  const client = useMemo(
    () => postiz ? new PostizClient(
      postiz.apiBase,
      postiz.apiKey
    ) : null,
    [
      postiz
    ]
  );

  // Postiz's coming posts, read once when Export opens (and after a send):
  // they mark the rhythm's slots taken — Atelier's posts on the same Postiz too.
  // Unreadable (offline, CORS): the slots are simply not marked.
  const readPlanned = useCallback(
    async(): Promise<PostizPost[]> => {
      if ( !client ) {
        return [];
      }

      const now = Date.now();

      return client.posts(
        new Date( now - 86400000 ),
        new Date( now + AHEAD_DAYS * 86400000 )
      ).catch( () => [] );
    },
    [
      client
    ]
  );
  const refreshPlanned = useCallback(
    async() => setPlanned( await readPlanned() ),
    [
      readPlanned
    ]
  );

  useEffect(
    () => {
      if ( !canPublish ) {
        return;
      }

      let alive = true;

      void readPlanned().then( ( posts ) => {
        if ( alive ) {
          setPlanned( posts );
        }
      } );

      return () => {
        alive = false;
      };
    },
    [
      canPublish,
      readPlanned
    ]
  );

  /**
   * Publish how much of the table is off to the sides, as a `data-more`
   * attribute the edge fades key off.
   *
   * Written straight to the DOM rather than held in state: it fires on every
   * scroll frame, and a re-render per frame is precisely the cost this panel
   * has just been rid of. A `ResizeObserver` covers the other way the answer
   * changes — the dialog resizing, or a variant being added or removed.
   */
  useEffect(
    () => {
      const element = scrollRef.current;

      if ( !element ) {
        return;
      }

      const update = () => {
        const overflow = element.scrollWidth - element.clientWidth;
        const atStart = element.scrollLeft <= 1;
        const atEnd = element.scrollLeft >= overflow - 1;

        element.dataset.more = overflow <= 1
          ? "none"
          : atStart ? "right" : atEnd ? "left" : "both";
      };

      update();

      const observer = new ResizeObserver( update );

      observer.observe( element );
      element.addEventListener(
        "scroll",
        update,
        {
          passive: true
        }
      );

      return () => {
        observer.disconnect();
        element.removeEventListener(
          "scroll",
          update
        );
      };
    },
    []
  );

  /**
   * Whether this run holds its files back, decided ONCE from the first
   * variant's real files.
   *
   * Per-variant would be worse than either answer: a batch that downloads its
   * Reel and then silently keeps its square post is the confusing half-state.
   */
  const deferredRef = useRef<boolean | null>( null );

  const slideCount = Array.isArray( options.slides ) ? options.slides.length : 0;

  const supportedFormats = useMemo(
    () => {
      if ( !engine ) {
        return FALLBACK_FORMATS;
      }

      try {
        return engine.getRecordingCapabilities(
          options,
          activeSlideIndex
        ).supportedFormats;
      } catch {
        return FALLBACK_FORMATS;
      }
    },
    [
      engine,
      options,
      activeSlideIndex
    ]
  );

  /** The slides a variant covers — drives the delivery column, the file count
   *  and whether the size picker has to offer a reconciliation. */
  const slidesOf = useCallback(
    ( variant: ExportVariant ) => resolveSlideIndices(
      variant,
      slideCount,
      activeSlideIndex
    ),
    [
      slideCount,
      activeSlideIndex
    ]
  );

  const fileCount = snapshot.variants.reduce(
    (
      total, variant
    ) => {
      const span = slidesOf( variant ).length;

      return total + ( variant.delivery === "combined" && variant.kind === "video"
        ? 1
        : span );
    },
    0
  );

  const facts = useMemo(
    () => publishFacts(
      name,
      engineId,
      ( options as { animation?: { duration?: number;
        framerate?: number } } ).animation
    ),
    [
      name,
      engineId,
      options
    ]
  );
  const taken = useMemo(
    () => plannedInstants( planned ?? [] ),
    [
      planned
    ]
  );
  const plan = postiz && canPublish
    ? planPost( {
      conn: postiz,
      draft,
      when,
      variants: snapshot.variants.map( ( variant ) => ( {
        variant,
        slideSpan: slidesOf( variant ).length,
        size: variant.size ?? resolveRunSize(
          variant,
          options,
          slidesOf( variant )
        ) ?? nativeSizeFor(
          options,
          activeSlideIndex
        )
      } ) ),
      facts,
      planned: taken
    } )
    : null;

  /**
   * What a row sends, and to whom: `Reel → IG`, `Picture → TH X BS`; a
   * variant no account takes says so, one nothing can take says why.
   */
  const postsAsFor = ( variant: ExportVariant ) => {
    const shape = postShape(
      variant,
      slidesOf( variant ).length
    );

    if ( shape.files === null ) {
      return {
        chosen: false,
        postsAs: null,
        reason: shape.reason
      };
    }

    const routes = plan?.routes.filter( ( r ) => r.variant.id === variant.id ) ?? [];

    if ( !routes.length ) {
      return {
        chosen: false,
        postsAs: "not sent",
        reason: "No account ticked takes this variant — pick it for one in the Post band"
      };
    }

    const what = routeWords( routes[ 0 ] ).split( " · " )[ 0 ];

    return {
      chosen: true,
      postsAs: `${ what } → ${ [
        ...new Set( routes.map( ( r ) => PROVIDER_GLYPH[ r.provider ] ) )
      ].join( " " ) }`,
      reason: routes.map( ( r ) => `${ r.channel.name }: ${ routeWords( r ) }` ).join( "\n" )
    };
  };

  /** Produced, but not yet anywhere the user can reach. */
  const unsaved = snapshot.variants
    .map( ( variant ) => ( {
      variant,
      output: outputs[ variant.id ]
    } ) )
    .filter( ( entry ): entry is {
      variant: ExportVariant;
      output: VariantOutput;
    } => Boolean( entry.output ) && !isDelivered( saved[ entry.variant.id ] ?? "failed" ) );

  const unsavedFileCount = unsaved.reduce(
    (
      total, entry
    ) => total + entry.output.artifacts.length,
    0
  );

  useEffect(
    () => onPendingChange?.( unsavedFileCount ),
    [
      unsavedFileCount,
      onPendingChange
    ]
  );

  // Whatever is still held when the panel goes away goes with it: tell the
  // dialog the count is zero so a later open does not inherit a stale guard.
  useEffect(
    () => () => onPendingChange?.( 0 ),
    [
      onPendingChange
    ]
  );

  const markSaved = (
    variantIds: string[], outcome: SaveOutcome
  ) => setSaved( ( current ) => ( {
    ...current,
    ...Object.fromEntries( variantIds.map( ( id ) => [
      id,
      outcome
    ] ) )
  } ) );

  const handleArtifacts = (
    variantId: string, produced: ExportArtifact[], bundleFileName: string
  ) => {
    setOutputs( ( current ) => ( {
      ...current,
      [ variantId ]: {
        artifacts: produced,
        bundleFileName
      }
    } ) );

    // A publish run's files are sent to Postiz, not saved: they stay in hand
    // for the preview and a later Save, never downloaded on their own.
    if ( publishingRef.current ) {
      return;
    }

    if ( deferredRef.current === null ) {
      deferredRef.current = shouldDeferDelivery( produced );
    }

    if ( deferredRef.current ) {
      return;
    }

    void downloadArtifacts(
      produced,
      bundleFileName
    ).then( ( outcome ) => markSaved(
      [
        variantId
      ],
      outcome
    ) );
  };

  /** Keep the exported piece in the gallery — its id, for the send that follows; a failure there never reads as an export failure. */
  const keepExported = async(): Promise<string | undefined> => {
    if ( !engine ) {
      return undefined;
    }

    try {
      const kept = await keepPiece(
        getGalleryStore(),
        {
          engine: engineId,
          category,
          name,
          options,
          origin: "export",
          thumbnail: await captureGalleryThumbnail( engine )
        }
      );

      return kept.entry.id;
    } catch( galleryError ) {
      console.warn(
        "[gallery] the export was not kept:",
        galleryError
      );

      return undefined;
    }
  };

  const handleExport = async() => {
    if ( running || !engine || snapshot.variants.length === 0 ) {
      return;
    }

    const controller = new AbortController();

    abortRef.current = controller;
    setRunning( true );
    setError( null );
    setNotice( null );
    // A new run replaces the last one's results; holding both would pin two
    // batches' worth of blobs for no reason.
    setPreviewing( null );
    setOutputs( {} );
    setSaved( {} );
    deferredRef.current = null;

    try {
      const results = await runExportBatch( {
        engine,
        options,
        sketchName: name,
        activeSlideIndex,
        variants: snapshot.variants,
        signal: controller.signal,
        onProgress: setItems,
        onArtifacts: handleArtifacts
      } );

      // A piece that was exported whole is worth finding again: keep its
      // document and a thumbnail in the browser's gallery (/gallery). Not on
      // a cancelled or partly failed run, and never twice for the same
      // document — keepPiece answers the existing entry then. A gallery
      // failure (quota, a locked-down browser) must not read as an export
      // failure: the files are already delivered, so it only logs.
      if ( !controller.signal.aborted && results.every( ( item ) => item.status === "done" ) ) {
        await keepExported();
      }
    } catch( caught ) {
      // A cancel is a normal outcome, not a failure worth shouting about —
      // the per-row states already say what happened.
      if ( !( caught instanceof DOMException && caught.name === "AbortError" ) ) {
        setError( caught instanceof Error ? caught.message : String( caught ) );
      }
    } finally {
      abortRef.current = null;
      setRunning( false );
    }
  };

  /**
   * Every unsaved file, in one gesture.
   *
   * One share sheet carrying all of them is the whole point on a phone: iOS
   * offers "Save 3 Videos" straight to Photos, where three separate prompts
   * would have overwritten one another.
   */
  const handleSaveAll = async() => {
    if ( saving || unsaved.length === 0 ) {
      return;
    }

    setSaving( true );
    setNotice( null );

    try {
      const outcome = await saveArtifacts(
        unsaved.flatMap( ( entry ) => entry.output.artifacts ),
        name,
        `${ slugify( name ) || "sketch" }-export.zip`
      );

      if ( isDelivered( outcome ) ) {
        markSaved(
          unsaved.map( ( entry ) => entry.variant.id ),
          outcome
        );
      } else {
        setNotice( SAVE_NOTICE[ outcome ] ?? SAVE_NOTICE.failed );
      }
    } finally {
      setSaving( false );
    }
  };

  /**
   * Send rendered files to Postiz — the one path (`sendRoutes`) the Publish
   * button and `publish.schedule` share: each variant's files made postable
   * (a PNG as the JPEG Instagram requires; the files in hand stay as
   * rendered), uploaded once, one entry per account.
   */
  const sendToPostiz = async(
    snap: PublishSnapshot, rendered: Map<string, File[]>
  ) => {
    if ( !client || !snap.plan.routes.length ) {
      return;
    }

    const controller = new AbortController();

    abortRef.current = controller;
    setRunning( true );
    setError( null );
    setSending( "Preparing the files" );

    try {
      const postable = new Map<string, File[]>();

      for ( const [
        id,
        files
      ] of rendered ) {
        const out: File[] = [];

        for ( const file of files ) {
          out.push( await postableFile( file ) );
        }
        postable.set(
          id,
          out
        );
      }

      const publication = {
        ...await sendRoutes( {
          client,
          routes: snap.plan.routes,
          files: postable,
          caption: snap.plan.caption.text,
          shortCaption: snap.plan.shortCaption.text,
          at: snap.target,
          signal: controller.signal,
          onFile: (
            n, of
          ) => setSending( `Sending ${ n } / ${ of } to Postiz` )
        } ),
        pieceId: snap.pieceId
      };

      addPublication(
        sketchKey,
        publication
      );
      setWhen(
        sketchKey,
        NEXT
      );
      // Each account's format becomes what it usually takes.
      updatePostiz( {
        usual: {
          ...( postiz?.usual ?? {} ),
          ...Object.fromEntries( snap.plan.routes.map( ( r ) => [
            r.channel.id,
            r.format
          ] ) )
        }
      } );
      // Sent is delivered: closing the dialog no longer warns about these files.
      markSaved(
        snap.plan.variants.map( ( v ) => v.id ),
        "shared"
      );
      setPublishView( {
        kind: "sent",
        files: postable.get( snap.plan.routes[ 0 ].variant.id ) ?? [],
        publication,
        snapshot: snap,
        postable
      } );
      void refreshPlanned();
    } catch( caught ) {
      if ( !( caught instanceof DOMException && caught.name === "AbortError" ) ) {
        setError( caught instanceof Error ? caught.message : String( caught ) );
      }
    } finally {
      abortRef.current = null;
      setRunning( false );
      setSending( null );
    }
  };

  /**
   * Publish's verb: render each variant the accounts take (once), then send — at once for a
   * schedule or a draft, after the review screen for Publish now (the one
   * send that cannot be taken back). Pressing it approves the caption read.
   */
  const handlePublish = async( as?: "now" | "draft" ) => {
    setVerbMenu( false );

    // Now and Draft need no time, so a time-only refusal does not hold them back.
    const timeOnly = plan?.blocked === "Choose when it goes out." || Boolean( plan?.blocked?.startsWith( "That time is past" ) );

    if ( running || !engine || !plan || !plan.routes.length || ( plan.blocked && !( as && timeOnly ) ) ) {
      return;
    }

    const target = as ?? plan.at ?? "draft";
    const snap: PublishSnapshot = {
      plan,
      target
    };

    patchDraft(
      sketchKey,
      {
        approved: true
      }
    );

    const controller = new AbortController();
    const produced = new Map<string, File[]>();

    abortRef.current = controller;
    publishingRef.current = true;
    setRunning( true );
    setError( null );
    setNotice( null );
    setPreviewing( null );
    setPublishView( null );
    setOutputs( {} );
    setSaved( {} );
    deferredRef.current = null;

    try {
      const results = await runExportBatch( {
        engine,
        options,
        sketchName: name,
        activeSlideIndex,
        variants: plan.variants,
        signal: controller.signal,
        onProgress: setItems,
        onArtifacts: (
          variantId, artifacts, bundleFileName
        ) => {
          produced.set(
            variantId,
            artifacts.map( artifactFile )
          );
          handleArtifacts(
            variantId,
            artifacts,
            bundleFileName
          );
        }
      } );
      const failed = results.find( ( item ) => item.status !== "done" );

      if ( failed || plan.variants.some( ( v ) => !produced.get( v.id )?.length ) ) {
        throw new Error( failed?.error ?? "The render produced no file." );
      }

      snap.pieceId = await keepExported();
    } catch( caught ) {
      if ( !( caught instanceof DOMException && caught.name === "AbortError" ) ) {
        setError( caught instanceof Error ? caught.message : String( caught ) );
      }

      return;
    } finally {
      publishingRef.current = false;
      abortRef.current = null;
      setRunning( false );
    }

    if ( target === "now" ) {
      setPublishView( {
        kind: "review",
        files: produced,
        snapshot: snap
      } );

      return;
    }

    await sendToPostiz(
      snap,
      produced
    );
  };

  const takeBack = async( publication: Publication ) => {
    if ( !client ) {
      throw new Error( "Postiz is not connected." );
    }

    for ( const id of publication.postIds ) {
      await client.deletePost( id );
      dropPublication(
        sketchKey,
        id
      );
    }

    void refreshPlanned();
  };

  /**
   * The failed accounts sent the same files again: their routes from the
   * snapshot (a story again only where the story failed), now unless the
   * slot is still ahead; once Postiz took them, the failed posts are deleted
   * there (nothing of theirs went out) and the screen follows the new ones.
   */
  const sendAgain = async(
    view: Extract<PublishView, { kind: "sent" }>, failed: AccountOutcome[]
  ) => {
    if ( !client ) {
      throw new Error( "Postiz is not connected." );
    }

    const routes = view.snapshot.plan.routes.flatMap( ( r ) => {
      const mine = failed.filter( ( o ) => o.channelId === r.channel.id );

      return mine.some( ( o ) => !o.story ) ? [
        {
          ...r,
          story: r.story && mine.some( ( o ) => o.story )
        }
      ] : [];
    } );

    if ( !routes.length ) {
      return;
    }

    const target = view.snapshot.target instanceof Date && view.snapshot.target.getTime() > Date.now() + 60_000
      ? view.snapshot.target
      : view.snapshot.target === "draft" ? "draft" : "now";
    const resent = {
      ...await sendRoutes( {
        client,
        routes,
        files: view.postable,
        caption: view.snapshot.plan.caption.text,
        shortCaption: view.snapshot.plan.shortCaption.text,
        at: target
      } ),
      pieceId: view.snapshot.pieceId
    };

    addPublication(
      sketchKey,
      resent
    );

    for ( const post of failed ) {
      try {
        await client.deletePost( post.postId );
      } catch {
        // Left in Postiz as an error; nothing of it went out.
      }

      dropPublication(
        sketchKey,
        post.postId
      );
    }

    setPublishView( {
      ...view,
      publication: mergeResend(
        view.publication,
        failedChannels( failed ),
        resent
      )
    } );
    void refreshPlanned();
  };

  const stateFor = ( id: string ) => items.find( ( item ) => item.variantId === id );

  /**
   * How far the whole batch has got, 0-100.
   *
   * Averaging the variants' own percentages rather than counting finished ones
   * is what keeps it moving during the long one: a three-variant run that sat
   * at 0 / 33 / 67 told you nothing for minutes at a time.
   */
  const batchPercentage = items.length === 0
    ? 0
    : items.reduce(
      (
        sum, item
      ) => sum + ( item.status === "done" ? 100 : item.percentage ),
      0
    ) / items.length;

  const runningIndex = Math.max(
    0,
    items.findIndex( ( item ) => item.status === "running" )
  );

  const previewed = previewing ? outputs[ previewing ] : undefined;

  // Publish's screens take the table's place too, as the preview does.
  if ( publishView?.kind === "review" ) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PublishReview
          files={ [
            ...publishView.files.values()
          ].flat() }
          caption={ publishView.snapshot.plan.caption.used ? publishView.snapshot.plan.caption.text : publishView.snapshot.plan.shortCaption.text }
          targets={ publishView.snapshot.plan.targets }
          sending={ running }
          onConfirm={ () => void sendToPostiz(
            publishView.snapshot,
            publishView.files
          ) }
          onBack={ () => setPublishView( null ) }
        />
        {( error || sending ) && (
          <p className="m-0 border-t border-theme px-3 py-2 text-[10px] text-label" role="status">
            {error ? <span className="text-red-500">{error}</span> : sending}
          </p>
        )}
      </div>
    );
  }

  if ( publishView?.kind === "sent" && postiz ) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PublishSent
          publication={ publishView.publication }
          channels={ postiz.channels.filter( ( c ) => publishView.publication.channelIds.includes( c.id ) ) }
          files={ publishView.files }
          timeZone={ postiz.rhythm.timeZone }
          postizUrl={ postizHome( postiz.apiBase ) }
          onCheck={ () => {
            const span = outcomeWindow( publishView.publication );

            return client ? client.posts(
              span.from,
              span.to
            ) : Promise.reject( new Error( "Postiz is not connected." ) );
          } }
          onSendAgain={ client ? ( failed ) => sendAgain(
            publishView,
            failed
          ) : null }
          onChooseAgain={ ( channelIds ) => {
            patchDraft(
              sketchKey,
              {
                channelIds
              }
            );
            setPublishView( null );
          } }
          onTakeBack={ () => takeBack( publishView.publication ) }
          onBack={ () => setPublishView( null ) }
        />
      </div>
    );
  }

  // The preview takes over the list's region rather than opening a second
  // modal: on a phone the dialog already owns the whole screen, and stacking a
  // surface over that fights the chrome instead of using it.
  if ( previewing && previewed && previewed.artifacts.length > 0 ) {
    return (
      <ExportPreview
        title={ snapshot.variants.find( ( variant ) => variant.id === previewing )?.name ?? "Export" }
        artifacts={ previewed.artifacts }
        bundleFileName={ previewed.bundleFileName }
        outcome={ saved[ previewing ] }
        onSaved={ ( outcome ) => {
          if ( isDelivered( outcome ) ) {
            markSaved(
              [
                previewing
              ],
              outcome
            );
          }
        } }
        onBack={ () => setPreviewing( null ) }
      />
    );
  }

  const rowProps = ( variant: ExportVariant ) => ( {
    variant,
    nativeSize: nativeSizeFor(
      options,
      activeSlideIndex
    ),
    nativeFramerate: nativeFramerateFor(
      options,
      activeSlideIndex
    ),
    slideCount,
    slideSpan: slidesOf( variant ).length,
    mixedSizes: hasMixedSlideSizes(
      variant,
      options,
      slidesOf( variant )
    ),
    supportedFormats,
    state: stateFor( variant.id ),
    running,
    delivered: isDelivered( saved[ variant.id ] ?? "failed" ),
    onPreview: outputs[ variant.id ]?.artifacts.length
      ? () => setPreviewing( variant.id )
      : undefined,
    removable: snapshot.variants.length > 1,
    publish: publishMode && plan ? postsAsFor( variant ) : undefined,
    onPatch: ( patch: Partial<ExportVariant> ) => patchVariant(
      sketchKey,
      variant.id,
      patch
    ),
    onDuplicate: () => duplicateVariantById(
      sketchKey,
      variant.id
    ),
    onRemove: () => removeVariant(
      sketchKey,
      variant.id
    )
  } );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* In Publish, the table, its add row and the Post band scroll as one;
          in Save this wrapper is `contents` and the layout is exactly as it
          was. */}
      <div className={ publishMode ? "flex min-h-0 flex-1 flex-col overflow-y-auto bg-background" : "contents" }>
        {/* Opaque, unlike the dialog's glass chrome around it: a table of small
          mono values with a sketch showing through is unreadable, and this is
          the region you actually read. The glass stays on the title bar and
          the footer, where it still frames the dialog against the canvas. */}
        {/* The one table, every viewport. A phone scrolls it sideways rather
          than folding it into cards: the six settings are the same on both,
          and the edge fades say when more of them are off to the side — which
          is the part a bare sideways scroll never admitted to.

          The fades are siblings of the scrolling region, not children of it:
          an absolutely positioned child of a scroll container is placed
          against that container's UNSCROLLED origin, so it would slide away
          with the content it is meant to be marking. */}
        <div className={ publishMode ? "relative flex shrink-0" : "relative flex min-h-0 flex-1" }>
          <div
            ref={ scrollRef }
            data-more="none"
            className="peer min-h-0 flex-1 overflow-auto bg-background"
          >
            <div role="table" aria-label="Export variants" className="min-w-[700px]">
              <div
                role="row"
                className={ `${ VARIANT_GRID } sticky top-0 z-10 h-8 items-center border-b border-theme bg-background` }
              >
                <div role="columnheader" className={ HEAD_CELL }>Variant</div>
                <div role="columnheader" className={ HEAD_CELL }>Size</div>
                <div role="columnheader" className={ HEAD_CELL }>Output</div>
                <div role="columnheader" className={ HEAD_CELL }>Rate</div>
                <div role="columnheader" className={ HEAD_CELL }>Slides</div>
                <div role="columnheader" className={ `${ HEAD_CELL } text-right` }>
                  {publishMode ? "Posts as" : "Delivers"}
                </div>
                <div role="columnheader" className="px-2">
                  <span className="sr-only">Row actions</span>
                </div>
              </div>

              {snapshot.variants.map( ( variant ) => (
                <VariantTableRow key={ variant.id } { ...rowProps( variant ) } />
              ) )}
            </div>
          </div>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-linear-to-r from-background to-transparent opacity-0 transition-opacity motion-reduce:transition-none peer-data-[more=both]:opacity-100 peer-data-[more=left]:opacity-100"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-linear-to-l from-background to-transparent opacity-0 transition-opacity motion-reduce:transition-none peer-data-[more=both]:opacity-100 peer-data-[more=right]:opacity-100"
          />
        </div>

        {/* Adding a variant starts from a preset, never a blank row: a new
          variant needing four fields filled in before it does anything is not
          a starting point. Kept out of the scrolling region so it stays put
          while the table is scrolled sideways. */}
        <div className="border-t border-dashed border-theme">
          <Menu as="div" className="relative">
            <MenuButton
              disabled={ running }
              className="flex min-h-[44px] w-full items-center gap-1.5 px-2.5 py-2 text-left text-[11px] text-label transition-colors hover:bg-hover hover:text-foreground disabled:opacity-40 md:min-h-0"
            >
              <Plus className="h-3 w-3 shrink-0" />
              Add a variant
            </MenuButton>
            <MenuItems
              anchor="bottom start"
              className="z-110 w-56 rounded-xl border border-theme bg-background p-1 shadow-lg focus:outline-hidden"
            >
              {VARIANT_PRESETS.map( ( preset ) => (
                <MenuItem key={ preset.key }>
                  <button
                    type="button"
                    onClick={ () => addVariant(
                      sketchKey,
                      preset
                    ) }
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-foreground data-focus:bg-hover"
                  >
                    <span className="truncate">{preset.label}</span>
                    {preset.size && (
                      <span className="shrink-0 font-mono text-[10px] tabular-nums text-label">
                        {preset.size.width}×{preset.size.height}
                      </span>
                    )}
                  </button>
                </MenuItem>
              ) )}
            </MenuItems>
          </Menu>
        </div>

        {/* What this sketch already sent (lab 3 Q5): one line, opening the gallery's sheet. */}
        {publishMode && postiz && postedWords && (
          <button
            type="button"
            data-posted-line
            onClick={ () => setSheetOpen( true ) }
            className="flex w-full items-center gap-2 border-t border-theme px-3 py-2 text-left text-xs text-foreground/80 hover:bg-hover"
          >
            <History className="h-3.5 w-3.5 shrink-0 text-label" />
            <span className="min-w-0 flex-1 truncate">{postedWords}</span>
            <span className="shrink-0 font-mono text-[10px] text-label">its posts ›</span>
          </button>
        )}
        {sheetOpen && (
          <SketchSheetLoader sketchKey={ sketchKey } onClose={ () => setSheetOpen( false ) } />
        )}

        {publishMode && postiz && plan && (
          <PostBand
            conn={ postiz }
            plan={ plan }
            draft={ draft }
            when={ when }
            taken={ taken }
            facts={ facts }
            disabled={ running }
            onPatch={ ( patch ) => patchDraft(
              sketchKey,
              patch
            ) }
            onWhen={ ( next ) => setWhen(
              sketchKey,
              next
            ) }
            onRemember={ (
              accountId, format
            ) => updatePostiz( {
              usual: {
                ...postiz.usual,
                [ accountId ]: format
              }
            } ) }
          />
        )}
      </div>

      {/* The batch's own progress, along the footer's top edge: a row says how
          far ITS variant has got, and on a three-variant run that is not the
          question being asked. Two pixels, no label — the footer already names
          which variant is in hand. */}
      <div className={ running ? "h-0.5 w-full bg-foreground/15" : "h-0.5 w-full" }>
        <div
          aria-hidden="true"
          className="h-full bg-foreground transition-[width] duration-300 ease-out motion-reduce:transition-none"
          style={ {
            width: `${ running ? batchPercentage : 0 }%`
          } }
        />
      </div>

      <div className={ clsx(
        "flex items-center gap-2 border-t border-theme px-3 py-2",
        canPublish && "max-md:flex-wrap"
      ) }
      >
        {canPublish && !running && (
          <div
            role="radiogroup"
            aria-label="Deliver to"
            className="grid shrink-0 grid-flow-col gap-0.5 rounded-lg border border-theme p-0.5"
          >
            {( [
              [
                "save",
                "Save"
              ],
              [
                "publish",
                "Publish"
              ]
            ] as [DeliverMode, string][] ).map( ( [
              id,
              label
            ] ) => (
              <button
                key={ id }
                type="button"
                role="radio"
                aria-checked={ draft.mode === id }
                onClick={ () => patchDraft(
                  sketchKey,
                  {
                    mode: id
                  }
                ) }
                className={ clsx(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors pointer-coarse:min-h-9",
                  draft.mode === id ? "bg-foreground text-background" : "text-label hover:bg-hover hover:text-foreground"
                ) }
              >
                {label}
              </button>
            ) )}
          </div>
        )}
        <span className={ clsx(
          "min-w-0 flex-1 truncate text-[10px] text-label",
          canPublish && "max-md:order-2 max-md:basis-full"
        ) }
        >
          {publishMode && !error && !notice && ( sending || running ) && (
            <span className="tabular-nums text-foreground/80">
              {sending ?? `Rendering ${ plan?.variants.map( ( v ) => v.name ).join( " + " ) ?? "" } — then it goes to Postiz`}
            </span>
          )}
          {publishMode && !error && !notice && !sending && !running && plan && (
            plan.blocked
              ? <span className="text-red-500">{plan.blocked}</span>
              : `Renders ${ plan.variants.map( ( v ) => v.name ).join( " + " ) }, sends ${ plan.files } file${ plan.files === 1 ? "" : "s" } to ${ plan.targets.length } account${ plan.targets.length === 1 ? "" : "s" } · caption ${ draft.approved ? "approved" : "not approved yet" }`
          )}
          {error && <span className="text-red-500">{error}</span>}
          {!error && notice && <span className="text-red-500">{notice}</span>}
          {!publishMode && !error && !notice && running && (
            <span className="tabular-nums text-foreground/80">
              Variant {runningIndex + 1} of {snapshot.variants.length}
            </span>
          )}
          {!publishMode && !error && !notice && !running && unsavedFileCount > 0 && (
            <span className="text-foreground/80">
              {unsavedFileCount} file{unsavedFileCount === 1 ? "" : "s"} ready · not saved yet
            </span>
          )}
          {!publishMode && !error && !notice && !running && unsavedFileCount === 0 && (
            `${ snapshot.variants.length } variant${ snapshot.variants.length === 1 ? "" : "s" } · ${ fileCount } file${ fileCount === 1 ? "" : "s" }`
          )}
        </span>

        {running ? (
          <button
            type="button"
            onClick={ () => abortRef.current?.abort() }
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-red-500/40 bg-background px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/5"
          >
            <span
              aria-hidden="true"
              className="block h-2 w-2 rounded-full bg-red-500 animate-pulse-soft"
            />
            Stop
          </button>
        ) : publishMode && plan ? (
          <div className="relative flex shrink-0 max-md:order-3 max-md:basis-full">
            <button
              type="button"
              onClick={ () => void handlePublish() }
              disabled={ !engine || Boolean( plan.blocked ) }
              className="min-w-0 flex-1 truncate rounded-l-lg border border-transparent bg-foreground px-3 py-1.5 text-xs font-medium text-background tabular-nums transition-opacity hover:opacity-85 disabled:opacity-40 max-md:min-h-11 max-md:text-sm"
            >
              {plan.verb}
            </button>
            <button
              type="button"
              aria-label="Other ways to send"
              aria-haspopup="menu"
              aria-expanded={ verbMenu }
              disabled={ !engine }
              onClick={ () => setVerbMenu( ( open ) => !open ) }
              className="rounded-r-lg border border-transparent border-l-background/30 bg-foreground px-1.5 text-background transition-opacity hover:opacity-85 disabled:opacity-40"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            {verbMenu && (
              <div
                role="menu"
                className="absolute bottom-[calc(100%+6px)] right-0 z-120 flex w-64 flex-col rounded-xl border border-theme bg-background p-1 shadow-lg"
              >
                {when.kind !== "next" && plan.free && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={ () => {
                      setWhen(
                        sketchKey,
                        NEXT
                      );
                      setVerbMenu( false );
                    } }
                    className="flex flex-col items-start rounded-lg px-2.5 py-2 text-left text-xs text-foreground hover:bg-hover"
                  >
                    The next free slot
                    <span className="text-[11px] text-label">Back to your rhythm</span>
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={ () => void handlePublish( "now" ) }
                  className="flex flex-col items-start rounded-lg px-2.5 py-2 text-left text-xs text-foreground hover:bg-hover"
                >
                  Publish now…
                  <span className="text-[11px] text-label">You see the file first — it cannot be taken back</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={ () => void handlePublish( "draft" ) }
                  className="flex flex-col items-start rounded-lg px-2.5 py-2 text-left text-xs text-foreground hover:bg-hover"
                >
                  Send as a draft
                  <span className="text-[11px] text-label">Kept in Postiz, unsent, to finish there</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Re-exporting stays reachable while files are held, but it is no
                longer the loud button: saving what the last run produced is. */}
            <button
              type="button"
              onClick={ handleExport }
              disabled={ !engine || snapshot.variants.length === 0 || saving }
              // Every footer button carries a border, transparent on the
              // filled ones: without it the ink-filled Export is 2px shorter
              // than the outlined Stop it swaps with, and the dialog — which is
              // centred — jumps by a pixel each time a run starts or ends.
              className={ unsavedFileCount > 0
                ? "shrink-0 rounded-lg border border-theme bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-hover disabled:opacity-40"
                : "shrink-0 rounded-lg border border-transparent bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-85 disabled:opacity-40" }
            >
              Export {snapshot.variants.length === 1
                ? "variant"
                : `all ${ snapshot.variants.length }`}
            </button>

            {unsavedFileCount > 0 && (
              <button
                type="button"
                onClick={ handleSaveAll }
                disabled={ saving }
                className="shrink-0 rounded-lg border border-transparent bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-85 disabled:opacity-40"
              >
                {saving ? "Saving…" : `Save ${ unsavedFileCount } file${ unsavedFileCount === 1 ? "" : "s" }`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
