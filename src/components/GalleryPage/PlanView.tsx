"use client";

import React, {
  useEffect, useMemo, useState, useSyncExternalStore
} from "react";
import {
  useRouter
} from "next/navigation";
import clsx from "clsx";
import {
  Pencil, Star
} from "lucide-react";

import RhythmDialog, {
  RhythmWeekDots
} from "@/components/RhythmDialog";
import {
  seedAccounts
} from "@/lib/postiz/accountRhythm";
import {
  providerOf
} from "@/lib/postiz/client";

import {
  weekLabel
} from "@/lib/gallery/calendar";
import type {
  GalleryEntry
} from "@/lib/gallery/types";
import {
  beatOf, CAMPAIGN_WEEKS, planWithCampaigns
} from "@/lib/planner/campaign";
import {
  getCampaigns, noCampaigns, passBeat, subscribeCampaigns
} from "@/lib/planner/campaignStore";
import {
  DEFAULT_GAP_WEEKS, EMPTY_CHOICES, GAP_WEEKS, MIXES, sketchKeyOf, sketchPath, type Pillar, type PlanSignal, type PlanSketch, type PlanSlot
} from "@/lib/planner/planner";
import {
  acceptedCounts
} from "@/lib/variations/kept";
import {
  getChoices, holdLine, passProposal, patchLine, releaseLine, resetPlan, skipSlot, subscribeChoices, updateChoices
} from "@/lib/planner/planStore";
import {
  lineStatus, queueable, type LineStatus
} from "@/lib/planner/approval";
import {
  reelCaption
} from "@/lib/planner/reel";
import {
  cancelRun, claimRun, clearRun, getRun, runAlive, runInterrupted, startRun, subscribeRun, updateRun
} from "@/lib/planner/runStore";
import {
  plannedInstants
} from "@/lib/postiz/plan";
import {
  getDraft, patchDraft, subscribePublish
} from "@/lib/postiz/publishStore";
import type {
  PostizConnection
} from "@/lib/postiz/store";
import {
  planFreeSlots
} from "@/lib/planner/slots";
import {
  DEFAULT_RHYTHM, slotHead, weekOf, type Rhythm
} from "@/lib/postiz/rhythm";
import {
  BeatDetail, CampaignMaker, CampaignTag, type CampaignContext
} from "./CampaignPanel";
import {
  catalogueThumbnail
} from "./items";
import {
  Vignette
} from "./marks";
import type {
  LinePost
} from "./PlanLines";

type Lines = typeof import( "./PlanLines" );

const PILLAR_LABEL: Record<Pillar, string> = {
  drop: "New",
  favourite: "Favourite",
  series: "Series",
  recap: "Recap"
};

const BUTTON = "inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-hover disabled:opacity-40";
const INK_BUTTON = "inline-flex h-8 items-center justify-center rounded-lg bg-foreground px-3 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40";
const EYEBROW = "font-mono text-[10.5px] uppercase tracking-[0.08em] text-foreground/50";

/** `Tue 24 Nov` and `09:00`, in the rhythm's zone. */
function whenParts(
  at: Date, tz: string
): { day: string;
  time: string } {
  return {
    day: at.toLocaleDateString(
      "en-GB",
      {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: tz
      }
    ).replace(
      ",",
      ""
    ),
    time: at.toLocaleTimeString(
      "en-GB",
      {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: tz
      }
    )
  };
}

const NO_ENTRIES: readonly GalleryEntry[] = [];

/** The catalogue, asked for only when the Plan opens: 150 KB the other views never load. */
function useCatalogue(): PlanSketch[] | null {
  const [
    catalogue,
    setCatalogue
  ] = useState<PlanSketch[] | null>( null );

  useEffect(
    () => {
      let live = true;

      void import( "@/sketches/metadata.json" ).then( ( mod ) => {
        if ( live ) {
          setCatalogue( mod.default as PlanSketch[] );
        }
      } );

      return () => {
        live = false;
      };
    },
    []
  );

  return catalogue;
}

/** The picture of a proposal: its sketch, or — for a reel — its first sketch with how many follow. */
function Cover( {
  slot, className
}: {
  slot: PlanSlot;
  className: string;
} ) {
  const p = slot.proposal;
  const reel = p?.reel;

  return (
    <span className={ clsx(
      "relative block aspect-[4/5] shrink-0 overflow-hidden bg-hover/60",
      className
    ) }
    >
      {p && <Vignette src={ catalogueThumbnail( reel ? reel.sketches[ 0 ] : p.sketchKey ) } />}
      {reel && (
        <span className="absolute bottom-0.5 right-0.5 rounded-sm bg-foreground px-1 font-mono text-[9px] font-semibold leading-tight text-background">
          {reel.sketches.length}
        </span>
      )}
    </span>
  );
}

/** True when a slot answers the gallery's search and its sketch filter. */
export function slotMatches(
  slot: PlanSlot, needle: string, sketchFilter: string
): boolean {
  const p = slot.proposal;

  if ( !needle && !sketchFilter ) {
    return true;
  }
  if ( !p ) {
    return false;
  }

  const keys = p.reel ? p.reel.sketches : [
    p.sketchKey
  ];
  const name = sketchFilter.split( "/" ).pop() ?? "";

  if ( sketchFilter && !keys.some( ( key ) => key.endsWith( `/${ name }` ) ) ) {
    return false;
  }

  return !needle || [
    p.title,
    p.path,
    p.why,
    ...keys
  ].some( ( text ) => text.toLowerCase().includes( needle ) );
}

function PillarChip( {
  slot
}: {
  slot: PlanSlot;
} ) {
  const p = slot.proposal;
  const beat = beatOf( p );

  if ( !p ) {
    return null;
  }
  if ( beat ) {
    return <CampaignTag tag={ beat } />;
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded border border-foreground/70 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-foreground">
      {p.pillar === "favourite" && <Star className="h-2.5 w-2.5 fill-current" aria-hidden />}
      {PILLAR_LABEL[ p.pillar ]}
    </span>
  );
}

const STATUS: Record<LineStatus, { words: string;
  dot: string;
  tone: string }> = {
  empty: {
    words: "Nothing left",
    dot: "border-dashed border-foreground/60",
    tone: "text-foreground/45"
  },
  skipped: {
    words: "Skipped",
    dot: "border-dashed border-foreground/60",
    tone: "text-foreground/45"
  },
  proposed: {
    words: "Proposed",
    dot: "border-dashed border-foreground/60",
    tone: "text-foreground/80"
  },
  pinned: {
    words: "Pinned",
    dot: "border-foreground bg-foreground",
    tone: "text-foreground/80"
  },
  approved: {
    words: "Approved",
    dot: "border-blue-500 bg-blue-500",
    tone: "text-blue-600 dark:text-blue-300"
  },
  reworded: {
    words: "Approve again",
    dot: "border-amber-500",
    tone: "text-amber-700 dark:text-amber-400"
  },
  taken: {
    words: "Slot taken",
    dot: "border-amber-500",
    tone: "text-amber-700 dark:text-amber-400"
  },
  rendering: {
    words: "Rendering",
    dot: "border-2 border-blue-500 border-r-transparent motion-safe:animate-spin",
    tone: "text-blue-600 dark:text-blue-300"
  },
  planned: {
    words: "Planned",
    dot: "border-2 border-blue-500",
    tone: "text-blue-600 dark:text-blue-300"
  },
  failed: {
    words: "Failed",
    dot: "border-2 border-red-500",
    tone: "text-red-600 dark:text-red-400"
  }
};

function StateWord( {
  slot, status
}: {
  slot: PlanSlot;
  status: LineStatus;
} ) {
  const s = STATUS[ status ];
  const beat = beatOf( slot.proposal );

  return (
    <span
      className={ clsx(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-mono text-[11px]",
        s.tone
      ) }
      data-plan-state={ status }
    >
      <i
        aria-hidden
        className={ clsx(
          "inline-block h-2 w-2 rounded-full border",
          s.dot
        ) }
      />
      {beat && ( status === "proposed" || status === "pinned" ) ? ( beat.needs ? "Waiting" : "Campaign" ) : status === "pinned" && slot.proposal?.pin?.by === "agent" ? "Pinned by Claude" : s.words}
    </span>
  );
}

/**
 * Why a campaign's beat cannot be approved in place, or null. The queue
 * renders a sketch as it stands (a release, a comeback); a beat that must be
 * STAGED first — the carousel of accepted variations, the breakdown, the
 * series' reel, the words card that waits for his words — is opened in
 * Export › Publish, where he sees the staged piece before anything is sent.
 * Never rendered as a plain sketch post.
 */
function beatBlock( slot: PlanSlot ): string | null {
  const beat = beatOf( slot.proposal );

  return beat && beat.kind !== "sketch"
    ? `«${ beat.label }» is staged on the sketch’s page before it is sent — open it in Publish. Only a campaign’s release and comeback are approved here.`
    : null;
}

/** What a slot proposes, its words, and the gestures on it. */
function Detail( {
  slot, tz, conn, status, post, lines, running, onApprove, onOpen, onSheet, className, campaign
}: {
  /** The calendar and the pieces a campaign reads; null until the plan is read. */
  campaign: CampaignContext | null;
  slot: PlanSlot;
  tz: string;
  conn: PostizConnection | null;
  status: LineStatus;
  /** The line's post as it stands; null without a Postiz or before it is read. */
  post: LinePost | null;
  lines: Lines | null;
  /** A render queue is at work: nothing is approved or released under it. */
  running: boolean;
  onApprove: ( slot: PlanSlot ) => void;
  onOpen: ( slot: PlanSlot ) => void;
  onSheet: ( sketchKey: string ) => void;
  className?: string;
} ) {
  const when = whenParts(
    slot.at,
    tz
  );
  const p = slot.proposal;
  const connected = Boolean( conn );
  const held = slot.held;
  const locked = status === "planned" || status === "rendering";
  const beat = beatOf( p );
  // The variations wait for accepted pieces; the words are typed once the card is open.
  const waits = beat?.kind === "variations" && beat.needs ? beat.needs : null;
  const blocked = beatBlock( slot ) ?? ( post ? ( post.plan.blocked ?? ( post.plan.routes.length ? null : "No account takes this post." ) ) : null );
  const approvable = Boolean( p && post && !blocked && !running && ( status === "proposed" || status === "pinned" || status === "reworded" ) );

  return (
    <div className={ clsx(
      "flex flex-col gap-3",
      className
    ) } data-plan-detail
    >
      <div className="flex items-start gap-3">
        <Cover slot={ slot } className="w-20 rounded-md" />
        <div className="flex min-w-0 flex-col gap-1.5">
          <h3 className="text-sm font-semibold text-foreground [overflow-wrap:anywhere]">
            {p ? p.title : slot.skipped ? "Left empty" : "Nothing left to propose"}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <PillarChip slot={ slot } />
            <StateWord slot={ slot } status={ status } />
          </div>
        </div>
      </div>

      {held && ( status === "failed" || status === "taken" || status === "reworded" ) && (
        <p
          role="status"
          data-plan-reason
          className={ clsx(
            "rounded-lg border px-2.5 py-2 text-xs [overflow-wrap:anywhere]",
            status === "failed" ? "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300" : "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300"
          ) }
        >
          {status === "taken"
            ? "Another post took this slot since you approved — nothing will be sent on it. Skip the line, or ask for another."
            : status === "reworded"
              ? ( held.error ?? "Its words changed after you approved them — read them and approve again." )
              : ( held.error ?? "It could not be sent." )}
        </p>
      )}

      <dl className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs">
        <dt className={ EYEBROW }>When</dt>
        <dd className="text-foreground">{when.day} · {when.time} <span className="text-foreground/50">{tz}</span></dd>
        {p && (
          <>
            <dt className={ EYEBROW }>Why</dt>
            <dd className="text-foreground/70 [overflow-wrap:anywhere]">{p.why}</dd>
            {p.reel
              ? (
                <>
                  <dt className={ EYEBROW }>Reel</dt>
                  <dd className="flex flex-wrap gap-1" data-plan-reel>
                    {p.reel.sketches.map( ( key ) => (
                      <span key={ key } title={ key } className="relative block aspect-[4/5] w-8 overflow-hidden rounded-sm bg-hover/60">
                        <Vignette src={ catalogueThumbnail( key ) } />
                      </span>
                    ) )}
                  </dd>
                </>
              )
              : (
                <>
                  <dt className={ EYEBROW }>Sketch</dt>
                  <dd className="font-mono text-[11px] text-foreground/70 [overflow-wrap:anywhere]">{p.path}</dd>
                </>
              )}
          </>
        )}
        {!p && !slot.skipped && (
          <>
            <dt className={ EYEBROW }>Why</dt>
            <dd className="text-foreground/70">Every new sketch and every favourite is already in the plan, was passed over, or was posted too recently. Shorten the gap or reset the plan.</dd>
          </>
        )}
      </dl>

      {p && conn && post && lines && (
        <lines.PlanWords conn={ conn } post={ post } locked={ locked || running } />
      )}

      <div className="flex flex-wrap gap-2">
        {p && connected && status !== "planned" && status !== "rendering" && (
          status === "approved" || status === "failed" || status === "taken"
            ? (
              <button
                type="button"
                className={ BUTTON }
                data-plan-unapprove
                disabled={ running }
                title="Take the approval back: the slot is proposed for again"
                onClick={ () => releaseLine( slot.slot ) }
              >
                Take approval back
              </button>
            )
            : (
              <button
                type="button"
                className={ INK_BUTTON }
                data-plan-approve
                disabled={ !approvable }
                title={ blocked ?? ( post ? "Approve these words for this slot: the line stays as it is until it is rendered and scheduled" : "Reading the words…" ) }
                onClick={ () => onApprove( slot ) }
              >
                {status === "reworded" ? "Approve again" : "Approve"}
              </button>
            )
        )}
        {p && !locked && (
          <>
            <button
              type="button"
              className={ connected ? BUTTON : INK_BUTTON }
              data-plan-open
              disabled={ running || Boolean( waits ) }
              title={ waits
                ? `It waits for ${ waits }`
                : p.reel
                  ? ( connected ? "Build this reel on the empty sketch and open Export › Publish on this slot — its accounts, formats and each account’s own words" : "Build this reel on the empty sketch — connect your Postiz (menu › Publishing) to schedule it" )
                  : ( connected ? "Open the sketch on Export › Publish, on this slot — its accounts, formats and each account’s own words" : "Open the sketch — connect your Postiz (menu › Publishing) to schedule it" ) }
              onClick={ () => onOpen( slot ) }
            >
              {waits ? "Waiting for variations" : connected ? "Open in Publish" : p.reel ? "Build the reel" : "Open the sketch"}
            </button>
            <button
              type="button"
              className={ BUTTON }
              data-plan-another
              disabled={ running }
              title={ beat ? "Leave this beat out of its campaign; the slot goes back to the plan" : "Pass this sketch over and propose the next one" }
              onClick={ () => {
                if ( beat ) {
                  // An approved beat left out is no longer approved either.
                  releaseLine( slot.slot );
                  passBeat(
                    beat.id,
                    beat.beat
                  );
                } else {
                  passProposal(
                    p.key,
                    slot.slot
                  );
                }
              } }
            >
              {beat ? "Leave out" : "Another"}
            </button>
          </>
        )}
        {!locked && (
          <button
            type="button"
            className={ BUTTON }
            data-plan-skip
            disabled={ running }
            title={ slot.skipped ? "Propose for this slot again" : "Leave this slot empty" }
            onClick={ () => skipSlot(
              slot.slot,
              !slot.skipped
            ) }
          >
            {slot.skipped ? "Propose again" : "Skip"}
          </button>
        )}
        {p && !p.reel && beat?.kind !== "words" && (
          <button type="button" className={ `${ BUTTON } border-transparent text-foreground/60` } onClick={ () => onSheet( p.sketchKey ) }>
            Its posts
          </button>
        )}
      </div>

      {p && campaign && ( beat
        ? <BeatDetail slot={ slot } tag={ beat } ctx={ campaign } />
        : !p.reel && !slot.held && <CampaignMaker key={ slot.slot } slot={ slot } ctx={ campaign } /> )}
    </div>
  );
}

/** Something that changes outside React (the publish store, a clock), as a number that moves. */
function useRevision( subscribe: ( tell: () => void ) => () => void ): number {
  const [
    revision,
    setRevision
  ] = useState( 0 );

  useEffect(
    () => subscribe( () => setRevision( ( n ) => n + 1 ) ),
    [
      subscribe
    ]
  );

  return revision;
}

const everyThreeSeconds = ( tell: () => void ) => {
  const timer = setInterval(
    tell,
    3_000
  );

  return () => clearInterval( timer );
};

/**
 * The gallery's PLAN (lab 7, `docs/memory/publishing.md`): what to post on
 * each free slot of the rhythm over the coming weeks, proposed from the
 * catalogue (`planner.ts`). Each line shows the words its post will carry,
 * fitted per account, editable there; the person approves lines in place —
 * one, a week, all shown — and ONE gesture then renders and schedules every
 * approved line (`runner.ts`): the tab walks the studio from sketch to sketch.
 * Nothing is sent from this page itself.
 *
 * It is the page's last block and its lines have a fixed height, so what
 * loads late (the catalogue, Postiz, the words) lands in place and moves
 * nothing above it.
 */
export default function PlanView( {
  conn, posts, posted, known, now, onOpen, onSheet, onRhythm, search = "", sketchFilter = "", onSketches, entries = NO_ENTRIES, signalFor
}: {
  /** The gallery's pieces: a campaign's variations are the accepted ones among them. */
  entries?: readonly GalleryEntry[];
  /** What measured results may move in the plan (`PlanSignal`); absent, the plan is drawn from the calendar alone. */
  signalFor?: ( catalogue: readonly PlanSketch[] ) => PlanSignal | undefined;
  /** The kept Postiz; null without one (the default rhythm is drawn, nothing can be approved). */
  conn: PostizConnection | null;
  /** Every post Postiz lists (any app's); null until read or without a Postiz. */
  posts: readonly { publishDate: string;
    state: string }[] | null;
  /** Every known send of a sketch. */
  posted: readonly { sketchKey: string;
    at: number }[];
  /** False until the archive and Postiz are read: nothing is proposed on half the facts. */
  known: boolean;
  now: number;
  onOpen: ( slot: PlanSlot ) => void;
  onSheet: ( sketchKey: string ) => void;
  onRhythm: () => void;
  /** The gallery's search, lower-cased, and its sketch filter: they narrow what is SHOWN, never what is planned. */
  search?: string;
  sketchFilter?: string;
  /** The sketches the plan proposes, `engine/category/name`, for the gallery's sketch filter. */
  onSketches?: ( paths: string[] ) => void;
} ) {
  const router = useRouter();
  const rhythm = conn?.rhythm ?? null;
  const catalogue = useCatalogue();
  const choices = useSyncExternalStore(
    subscribeChoices,
    getChoices,
    () => EMPTY_CHOICES
  );
  const run = useSyncExternalStore(
    subscribeRun,
    getRun,
    () => null
  );
  // A post reworded in another tab (an agent's), and the queue's heartbeat going quiet.
  const published = useRevision( subscribePublish );
  const clock = useRevision( everyThreeSeconds );
  const [
    picked,
    setPicked
  ] = useState<string | null>( null );
  const [
    lines,
    setLines
  ] = useState<Lines | null>( null );
  const active = rhythm ?? DEFAULT_RHYTHM;
  const tz = active.timeZone;
  const [
    rhythmOpen,
    setRhythmOpen
  ] = useState( false );
  // The week the Rhythm button draws: each account's slots, or the old one-for-all rhythm spread over them.
  const rhythmAccounts = useMemo(
    () => conn ? seedAccounts(
      conn.rhythm,
      conn.channels.filter( ( c ) => !c.disabled ).map( ( c ) => ( {
        id: c.id,
        provider: providerOf( c.identifier )
      } ) ),
      conn.defaultChannelIds,
      conn.usual
    ) : null,
    [
      conn
    ]
  );

  useEffect(
    () => {
      let live = true;

      if ( conn && !lines ) {
        void import( "./PlanLines" ).then( ( mod ) => {
          if ( live ) {
            setLines( mod );
          }
        } );
      }

      return () => {
        live = false;
      };
    },
    [
      conn,
      lines
    ]
  );

  const campaigns = useSyncExternalStore(
    subscribeCampaigns,
    getCampaigns,
    noCampaigns
  );

  // The plan and its campaigns (lab 9): the beats are laid first, each one a
  // line wearing its tag; with no campaign this is `planSlots` itself.
  const reading = useMemo(
    () => {
      if ( !known || !catalogue ) {
        return null;
      }

      const plan = {
        catalogue,
        slots: planFreeSlots(
          active,
          posts ?? [],
          new Date( now )
        ),
        posted,
        choices,
        now,
        timeZone: tz,
        signal: signalFor?.( catalogue )
      };
      const lay = {
        slots: planFreeSlots(
          active,
          posts ?? [],
          new Date( now ),
          CAMPAIGN_WEEKS
        ),
        posted,
        catalogue,
        accepted: acceptedCounts( entries ),
        now,
        timeZone: tz
      };
      const out = planWithCampaigns(
        {
          ...plan,
          farSlots: lay.slots,
          accepted: lay.accepted
        },
        campaigns
      );
      const context: CampaignContext = {
        plan,
        lay,
        campaigns,
        laid: out.campaigns,
        entries,
        tz
      };

      return {
        slots: out.slots,
        context
      };
    },
    [
      known,
      catalogue,
      active,
      posts,
      posted,
      choices,
      campaigns,
      entries,
      now,
      tz,
      signalFor
    ]
  );
  const slots = reading?.slots ?? null;
  const context = reading?.context ?? null;

  const wall = useMemo(
    () => Date.now(),
    [
      clock,
      run
    ]
  );
  const running = runAlive(
    run,
    wall
  );
  const interrupted = runInterrupted(
    run,
    wall
  );

  /** Each line's post as it stands, by slot. */
  const linePosts = useMemo(
    () => {
      const out = new Map<string, LinePost>();

      if ( slots && conn && lines ) {
        const planned = plannedInstants( posts ?? [] );

        for ( const s of slots ) {
          const post = lines.readLinePost(
            conn,
            s,
            planned,
            now
          );

          if ( post ) {
            out.set(
              s.slot,
              post
            );
          }
        }
      }

      return out;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `published` is the publish store changing under the same slots
    [
      slots,
      conn,
      lines,
      posts,
      now,
      published
    ]
  );
  const statusOf = ( s: PlanSlot ): LineStatus => lineStatus(
    s,
    linePosts.get( s.slot )?.stamp ?? null,
    running
  );

  // Words changed since an approval: it is taken back for good, not only for
  // as long as they stay changed (`approval.ts`).
  useEffect(
    () => {
      for ( const s of slots ?? [] ) {
        const stamp = linePosts.get( s.slot )?.stamp;

        if ( s.held && s.held.stamp !== null && stamp !== undefined && stamp !== s.held.stamp && s.held.state !== "planned" ) {
          patchLine(
            s.slot,
            {
              stamp: null
            }
          );
        }
      }
    },
    [
      slots,
      linePosts
    ]
  );

  const approvable = ( s: PlanSlot ): boolean => {
    const post = linePosts.get( s.slot );
    const status = statusOf( s );

    return Boolean( s.proposal && post && !beatBlock( s ) && !post.plan.blocked && post.plan.routes.length && ( status === "proposed" || status === "pinned" || status === "reworded" ) );
  };
  /** «Approve»: the words as they are shown now, on this slot. */
  const approve = ( s: PlanSlot ) => {
    const p = s.proposal;
    const post = linePosts.get( s.slot );

    if ( !p || !post || !conn || !lines || running || !approvable( s ) ) {
      return;
    }
    // A reel's starting words become its own, so Export › Publish reads the same.
    if ( p.reel && getDraft( post.postKey ).caption === null ) {
      patchDraft(
        post.postKey,
        {
          caption: reelCaption( p ) ?? ""
        }
      );
    }
    holdLine(
      s.slot,
      {
        proposal: p,
        postKey: post.postKey,
        stamp: post.stamp,
        ...( beatOf( p ) ? {
          beat: {
            id: beatOf( p )!.id,
            beat: beatOf( p )!.beat,
            trial: beatOf( p )!.trial
          }
        } : {} )
      }
    );
  };

  const shown = useMemo(
    () => slots?.filter( ( s ) => slotMatches(
      s,
      search,
      sketchFilter
    ) ) ?? null,
    [
      slots,
      search,
      sketchFilter
    ]
  );
  const paths = useMemo(
    () => {
      if ( !slots || !catalogue ) {
        return [];
      }

      const pathOf = new Map( catalogue.map( ( s ) => [
        sketchKeyOf( s ),
        sketchPath( s )
      ] ) );

      return [
        ...new Set( slots.flatMap( ( s ) => !s.proposal ? [] : s.proposal.reel ? s.proposal.reel.sketches.map( ( key ) => pathOf.get( key ) ?? key ) : [
          s.proposal.path
        ] ) )
      ].sort();
    },
    [
      slots,
      catalogue
    ]
  );

  useEffect(
    () => onSketches?.( paths ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- told when the plan's sketches change, not when the callback does
    [
      paths
    ]
  );

  const selected = shown?.find( ( s ) => s.slot === picked ) ?? shown?.find( ( s ) => s.proposal ) ?? shown?.[ 0 ] ?? null;
  const weeks = useMemo(
    () => {
      const out = new Map<string, PlanSlot[]>();

      for ( const s of shown ?? [] ) {
        const monday = weekOf(
          s.at,
          tz
        );

        out.set(
          monday,
          [
            ...( out.get( monday ) ?? [] ),
            s
          ]
        );
      }

      return [
        ...out.entries()
      ];
    },
    [
      shown,
      tz
    ]
  );

  const proposed = slots?.filter( ( s ) => s.proposal ) ?? [];
  const touched = Object.keys( choices.passed ).length + Object.keys( choices.skipped ).length + Object.keys( choices.pins ).length + Object.keys( choices.held ?? {} ).length > 0;
  const summary = slots === null
    ? "Reading the catalogue…"
    : [
      `${ proposed.length } of ${ slots.length } free ${ slots.length === 1 ? "slot" : "slots" } proposed`,
      ...( [
        [
          "drop",
          "new"
        ],
        [
          "favourite",
          "favourites"
        ],
        [
          "series",
          "series"
        ],
        [
          "recap",
          "recaps"
        ]
      ] as const ).map( ( [
        pillar,
        word
      ] ) => [
        // A campaign's beats are counted once, as the campaign's.
        proposed.filter( ( s ) => s.proposal!.pillar === pillar && !beatOf( s.proposal ) ).length,
        word
      ] as const ).filter( ( [
        count
      ] ) => count > 0 )
        .map( ( [
          count,
          word
        ] ) => `${ count } ${ word }` ),
      ...( proposed.some( ( s ) => beatOf( s.proposal ) ) ? [
        `${ proposed.filter( ( s ) => beatOf( s.proposal ) ).length } of a campaign`
      ] : [] ),
      ...( shown && shown.length !== slots.length ? [
        `${ shown.length } shown`
      ] : [] )
    ].join( " · " );

  // ---- The batch (lab 7, pass 3) ----
  const real = slots?.filter( ( s ) => s.proposal || s.skipped ) ?? [];
  const decided = real.filter( ( s ) => s.skipped || s.held ).length;
  const plannedCount = real.filter( ( s ) => s.held?.state === "planned" ).length;
  const queue = ( slots ?? [] ).filter( ( s ) => s.held && queueable( statusOf( s ) ) );
  const toApprove = ( shown ?? [] ).filter( approvable );
  const runLines = run?.slots.length ?? 0;
  const current = run && run.state === "running" ? ( slots ?? [] ).find( ( s ) => s.slot === run.slots[ run.index ] ) : undefined;

  const start = () => {
    const first = queue[ 0 ]?.proposal;

    if ( !first || running ) {
      return;
    }
    startRun(
      queue.map( ( s ) => s.slot ),
      "/gallery"
    );
    router.push( `/sketches/${ first.path }` );
  };
  /** A run whose tab went away: this tab takes it over where it stopped. */
  const resume = () => {
    const next = run?.slots.slice( run.index ).map( ( slot ) => choices.held?.[ slot ] )
      .find( ( line ) => line && line.state !== "planned" );

    if ( !run ) {
      return;
    }
    if ( !next ) {
      updateRun(
        run.id,
        ( r ) => ( {
          ...r,
          state: "done",
          phase: "done"
        } )
      );

      return;
    }
    claimRun( run.id );
    updateRun(
      run.id,
      ( r ) => ( {
        ...r,
        beat: Date.now(),
        phase: "resuming"
      } )
    );
    router.push( `/sketches/${ next.proposal.path }` );
  };

  return (
    <section aria-label="Plan" className="flex flex-col gap-3" data-plan-ready={ slots ? "true" : "false" } data-plan-words-ready={ !conn || ( lines && slots ) ? "true" : "false" }>
      {/* Every width here is fixed or flexed; the summary truncates. */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div role="radiogroup" aria-label="Mix" className="inline-flex h-9 shrink-0 items-center gap-0.5 self-start rounded-lg border border-border bg-hover/40 p-0.5">
          {MIXES.map( ( m ) => (
            <button
              key={ m.id }
              type="button"
              role="radio"
              aria-checked={ choices.mix === m.id }
              title={ m.title }
              data-plan-mix={ m.id }
              onClick={ () => updateChoices( ( c ) => ( {
                ...c,
                mix: m.id
              } ) ) }
              className={ clsx(
                "inline-flex h-full items-center rounded-md px-2.5 text-xs font-medium transition-colors",
                choices.mix === m.id ? "bg-background text-foreground shadow-[0_0_0_1px_var(--color-border)]" : "text-foreground/60 hover:text-foreground"
              ) }
            >
              {m.label}
            </button>
          ) )}
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <label className="flex shrink-0 items-center gap-2 text-xs text-foreground/60">
            No repeat before
            <select
              aria-label="No repeat before"
              value={ choices.gapWeeks ?? DEFAULT_GAP_WEEKS }
              onChange={ ( event ) => updateChoices( ( c ) => ( {
                ...c,
                gapWeeks: Number( event.target.value )
              } ) ) }
              className="h-9 rounded-lg border border-border bg-background px-2 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-focus"
            >
              {GAP_WEEKS.map( ( w ) => <option key={ w } value={ w }>{w} weeks</option> )}
            </select>
          </label>
          {conn ? (
            <button
              type="button"
              onClick={ () => setRhythmOpen( true ) }
              title="Your rhythm, account by account — open it to change slots and formats"
              data-plan-rhythm
              className="inline-flex h-9 min-w-0 shrink items-center gap-2.5 rounded-lg border border-border bg-background pl-2 pr-2.5 text-left transition-colors hover:bg-hover"
            >
              <RhythmWeekDots accounts={ rhythmAccounts } />
              <span className="shrink-0 text-xs font-medium text-foreground">Rhythm</span>
              <span className="min-w-0 truncate font-mono text-[11px] text-foreground/55">
                {active.slots.length} send{active.slots.length === 1 ? "" : "s"} a week · {Object.values( rhythmAccounts ?? {} ).filter( ( a ) => a.slots.length ).length} accounts
              </span>
              <Pencil className="h-3.5 w-3.5 shrink-0 text-foreground/55" />
            </button>
          ) : (
            <button
              type="button"
              onClick={ onRhythm }
              title="The default rhythm — connect your Postiz in Publishing to use yours"
              className="min-w-0 truncate text-left font-mono text-[11px] text-foreground/55 underline-offset-2 hover:text-foreground hover:underline"
            >
              {active.slots.map( slotHead ).join( " · " )} · default rhythm
            </button>
          )}
          <RhythmDialog open={ rhythmOpen } onClose={ () => setRhythmOpen( false ) } />
          {touched && (
            <button type="button" className={ `${ BUTTON } ml-auto shrink-0` } disabled={ running } onClick={ () => resetPlan() } title="Forget what was passed over, skipped, pinned and approved — what is already in Postiz stays">
              Reset
            </button>
          )}
        </div>
      </div>

      <p className="truncate font-mono text-[11px] text-foreground/55" data-plan-summary title={ summary }>{summary}</p>

      <div className="grid min-h-[36rem] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="overflow-hidden rounded-xl border border-border">
          {slots !== null && slots.length > 0 && shown?.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-foreground/60">
              Nothing in the plan matches — clear the search or pick another sketch.
            </p>
          )}
          {slots !== null && slots.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-foreground/60">
              No free slot in the next five weeks: every slot of your rhythm already has a post.
            </p>
          )}
          {weeks.map( ( [
            monday,
            list
          ] ) => {
            const week = list.filter( approvable );

            return (
              <div key={ monday }>
                <div className={ `${ EYEBROW } flex h-9 items-center gap-2 border-b border-border bg-hover/50 px-3` }>
                  <span className="min-w-0 truncate">Week of {weekLabel( monday )}</span>
                  {conn && (
                    <button
                      type="button"
                      data-plan-approve-week={ monday }
                      disabled={ running || week.length === 0 }
                      title="Approve every line of this week whose words are shown here"
                      onClick={ () => week.forEach( approve ) }
                      className="ml-auto inline-flex h-6 shrink-0 items-center rounded-md border border-border bg-background px-2 font-sans text-[11px] font-medium normal-case tracking-normal text-foreground transition-colors hover:bg-hover disabled:opacity-40"
                    >
                      Approve the week
                    </button>
                  )}
                </div>
                {list.map( ( s ) => {
                  const when = whenParts(
                    s.at,
                    tz
                  );
                  const on = selected?.slot === s.slot;
                  const status = statusOf( s );
                  const post = linePosts.get( s.slot ) ?? null;
                  // The words in the line itself: an approval covers what is shown.
                  const firstLine = post?.plan.caption.text.split( "\n" ).find( ( text ) => text.trim() ) ?? null;

                  return (
                    <div key={ s.slot } className="border-b border-border last:border-b-0">
                      <button
                        type="button"
                        aria-expanded={ on }
                        data-plan-slot={ s.slot }
                        data-plan-status={ status }
                        onClick={ () => setPicked( s.slot ) }
                        className={ clsx(
                          "grid h-16 w-full grid-cols-[4.75rem_2.5rem_minmax(0,1fr)] items-center gap-3 px-3 text-left transition-colors sm:grid-cols-[5.5rem_2.5rem_minmax(0,1fr)_auto]",
                          on ? "bg-hover" : "hover:bg-hover/50"
                        ) }
                      >
                        <span className="font-mono text-[11px] leading-tight tabular-nums text-foreground/70">{when.day}<br />{when.time}</span>
                        <Cover slot={ s } className="w-10 rounded" />
                        <span className="flex min-w-0 flex-col gap-1">
                          <span className={ clsx(
                            "truncate text-sm font-semibold",
                            s.proposal ? "text-foreground" : "text-foreground/45"
                          ) }
                          >
                            {s.proposal ? s.proposal.title : s.skipped ? "Left empty" : "Nothing left to propose"}
                          </span>
                          <span className="flex min-w-0 items-center gap-2">
                            <PillarChip slot={ s } />
                            {s.proposal?.heard && (
                              <span
                                data-plan-heard
                                title={ `Moved by your results: ${ s.proposal.heard }` }
                                className="shrink-0 rounded border border-dashed border-foreground/50 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-foreground/70"
                              >
                                Results
                              </span>
                            )}
                            <span className="truncate font-mono text-[11px] text-foreground/50" data-plan-line-words>{firstLine ?? s.proposal?.why ?? ""}</span>
                          </span>
                        </span>
                        <span className="max-sm:hidden"><StateWord slot={ s } status={ status } /></span>
                      </button>
                      {on && (
                        <Detail
                          slot={ s }
                          tz={ tz }
                          conn={ conn }
                          status={ status }
                          post={ post }
                          lines={ lines }
                          running={ running }
                          onApprove={ approve }
                          onOpen={ onOpen }
                          onSheet={ onSheet }
                          campaign={ context }
                          className="border-t border-border bg-hover/30 p-3 lg:hidden"
                        />
                      )}
                    </div>
                  );
                } )}
              </div>
            );
          } )}

          {/* The batch: how far the plan is decided, and the one gesture that renders and schedules it. */}
          {conn && slots !== null && slots.length > 0 && (
            <div className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-2 border-t border-border bg-hover/50 px-3 py-2" data-plan-foot>
              {running || interrupted
                ? (
                  <>
                    <span className="font-mono text-[11px] text-foreground/70" data-plan-run={ running ? "running" : "interrupted" }>
                      {running
                        ? `Line ${ Math.min(
                          ( run?.index ?? 0 ) + 1,
                          runLines
                        ) } of ${ runLines }${ current?.proposal ? ` · ${ current.proposal.title }` : "" } · ${ run?.phase ?? "" }${ run?.progress !== null && run?.progress !== undefined ? ` ${ Math.round( run.progress * 100 ) } %` : "" }`
                        : `Stopped at line ${ Math.min(
                          ( run?.index ?? 0 ) + 1,
                          runLines
                        ) } of ${ runLines } — the tab that rendered it is gone`}
                    </span>
                    <span className="ml-auto flex gap-2">
                      {interrupted && (
                        <button type="button" className={ INK_BUTTON } data-plan-resume onClick={ resume } title="Carry on in this tab from the line it stopped on — what is already scheduled stays scheduled">
                          Resume
                        </button>
                      )}
                      <button type="button" className={ BUTTON } data-plan-cancel onClick={ () => cancelRun() } title="Stop the queue: the line being rendered is dropped and stays approved, what is already scheduled stays scheduled">
                        {interrupted ? "Drop the run" : "Stop"}
                      </button>
                    </span>
                  </>
                )
                : (
                  <>
                    <span className="font-mono text-[11px] text-foreground/70" data-plan-progress>
                      {decided} of {real.length} decided{plannedCount ? ` · ${ plannedCount } planned` : ""}
                    </span>
                    <span className="h-1.5 min-w-16 max-w-52 flex-1 overflow-hidden rounded-full bg-border" aria-hidden>
                      <b className="block h-full bg-blue-500" style={ {
                        width: `${ real.length ? ( 100 * decided ) / real.length : 0 }%`
                      } }
                      />
                    </span>
                    <span className="ml-auto flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={ BUTTON }
                        data-plan-approve-all
                        disabled={ toApprove.length === 0 }
                        title="Approve every line shown here whose words can go as they read"
                        onClick={ () => toApprove.forEach( approve ) }
                      >
                        Approve all shown
                      </button>
                      <button
                        type="button"
                        className={ INK_BUTTON }
                        data-plan-run-start
                        disabled={ queue.length === 0 }
                        title={ queue.length ? "Render each approved line in this tab, one after another, and schedule it on its slot in your Postiz. The tab opens each sketch in turn and must stay open and visible." : "Approve a line first" }
                        onClick={ () => {
                          clearRun();
                          start();
                        } }
                      >
                        Render &amp; schedule{queue.length ? ` · ${ queue.length } approved` : ""}
                      </button>
                    </span>
                  </>
                )}
            </div>
          )}
        </div>

        <aside aria-label="The proposal" className="sticky top-3 max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-xl border border-border p-3 max-lg:hidden">
          {selected
            ? (
              <Detail
                slot={ selected }
                tz={ tz }
                conn={ conn }
                status={ statusOf( selected ) }
                post={ linePosts.get( selected.slot ) ?? null }
                lines={ lines }
                running={ running }
                onApprove={ approve }
                onOpen={ onOpen }
                onSheet={ onSheet }
                campaign={ context }
              />
            )
            : <p className="text-xs text-foreground/50">{slots === null ? "" : "Nothing to propose."}</p>}
        </aside>
      </div>
    </section>
  );
}
