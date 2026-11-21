/**
 * What OPENING a campaign's beat stages (lab 9): the document, the words and
 * the settings its post starts from — the release opens the sketch as it is,
 * the variations a carousel of accepted pieces, «how it's made» the sketch
 * with its breakdown playing, the series its reel, the words a card on the
 * empty host. Read by the gallery's «Open in Publish» and by `plan.open`, so
 * the button and an agent stage the same thing.
 *
 * A document crosses to the sketch page by the gallery's own handoff
 * (`pendingImportOptions`). The breakdown cannot: only the sketch page knows
 * the sketch's defaults, so it crosses as an ASK (`askStage`) the page takes
 * once on mount, beside the Plan's own (`askPlanned`, `reopen.ts`).
 *
 * Pure but for the two sessionStorage accessors at the end.
 */

import type {
  GalleryEntry
} from "../gallery/types";
import {
  variationsDocument, variationsOf
} from "../variations/kept";
import type {
  BeatTag
} from "./campaign";
import {
  REEL_HOST, type Proposal
} from "./planner";
import {
  reelCaption, reelDocument
} from "./reel";

/** What the sketch page does by itself once it has mounted. */
export interface Stage {
  kind: "process";
}

export interface StagedBeat {
  /** A whole document for the sketch page to import; null when the sketch opens as it is. */
  document: Record<string, unknown> | null;
  /** What the page stages itself; null when there is nothing to. */
  stage: Stage | null;
  /** Words the post starts from (a reel's); null leaves the sketch's own. */
  caption: string | null;
  /** Whether the post is meant as a Trial Reel. */
  trial: boolean;
}

/**
 * The breakdown item «how it's made» adds: EVERY parameter group as a step
 * (`all`) — a sketch at its stock defaults has no diff to narrate — roaming
 * so the block never hides one corner for the whole loop, and set larger
 * than the studio's default so it reads on a phone.
 */
export const PROCESS_ITEM_SEED = {
  build: {
    selection: "all"
  },
  placement: "roaming",
  // The schema's 16 px is a caption in the studio; a post is read on a phone.
  size: 24
} as const;

/** `content` with a breakdown added by `make`; null when it already plays one. */
export function withBreakdown(
  content: unknown, make: ( seed: Record<string, unknown> ) => Record<string, unknown>
): unknown[] | null {
  const list = Array.isArray( content ) ? content : [];

  if ( list.some( ( item ) => ( item as { type?: unknown } | null )?.type === "breakdown" ) ) {
    return null;
  }

  return [
    ...list,
    make( JSON.parse( JSON.stringify( PROCESS_ITEM_SEED ) ) as Record<string, unknown> )
  ];
}

/** What stands on the words card until the person types theirs: plainly a placeholder. */
export const WORDS_PLACEHOLDER = "YOUR WORDS HERE";

/** The words beat's document: one card on the empty host, the series' name over a line that is the person's to write. */
export function wordsDocument( title: string ): Record<string, unknown> {
  return {
    name: REEL_HOST.name,
    animation: {
      duration: 6
    },
    content: [
      {
        type: "sequence",
        scenes: [
          {
            kind: "splash",
            weight: 1,
            title: title.toUpperCase(),
            subtitle: WORDS_PLACEHOLDER
          }
        ]
      }
    ]
  };
}

/**
 * What opening this beat stages — or the sentence saying what it still waits
 * for. `pieces` are the gallery's entries (any sketch's); only the accepted
 * variations of the beat's own sketch are read.
 */
export function stageBeat(
  proposal: Proposal, tag: BeatTag, pieces: readonly GalleryEntry[]
): { ok: true;
  staged: StagedBeat; } | { ok: false;
    reason: string; } {
  const base: StagedBeat = {
    document: null,
    stage: null,
    caption: null,
    trial: tag.trial
  };

  switch ( tag.kind ) {
    case "sketch":
      return {
        ok: true,
        staged: base
      };
    case "process":
      return {
        ok: true,
        staged: {
          ...base,
          stage: {
            kind: "process"
          }
        }
      };
    case "variations": {
      const document = variationsDocument(
        variationsOf(
          pieces,
          proposal.sketchKey
        ),
        tag.pieces?.min ?? 1,
        tag.pieces?.max ?? 5
      );

      return document
        ? {
          ok: true,
          staged: {
            ...base,
            document
          }
        }
        : {
          ok: false,
          reason: `It waits for ${ tag.needs ?? "accepted variations" }: keep other looks of the sketch as variations, then accept the good ones`
        };
    }
    case "series": {
      const document = reelDocument( proposal );

      return document
        ? {
          ok: true,
          staged: {
            ...base,
            document,
            caption: reelCaption( proposal )
          }
        }
        : {
          ok: false,
          reason: "Its series can no longer play as a reel"
        };
    }
    case "words":
      return {
        ok: true,
        staged: {
          ...base,
          document: wordsDocument( tag.series )
        }
      };
  }
}

const KEY = "sketchbook.campaign.stage";
/** An ask older than this is a stale tab's, not the one just made (`reopen.ts`). */
const FRESH_MS = 2 * 60 * 1000;

function session(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** Ask the sketch `<engine>/<name>` to stage this once it has mounted. */
export function askStage(
  sketchKey: string, stage: Stage
): boolean {
  try {
    session()?.setItem(
      KEY,
      JSON.stringify( {
        sketchKey,
        stage,
        at: Date.now()
      } )
    );

    return true;
  } catch {
    return false;
  }
}

/** A stored ask read back, whatever it holds. Pure. */
export function readStage(
  raw: string | null, sketchKey: string, now: number
): Stage | null {
  try {
    const ask = JSON.parse( raw ?? "null" ) as { sketchKey?: unknown;
      at?: unknown;
      stage?: { kind?: unknown }; } | null;

    if ( !ask || ask.sketchKey !== sketchKey || typeof ask.at !== "number" || now - ask.at > FRESH_MS || ask.stage?.kind !== "process" ) {
      return null;
    }

    return {
      kind: "process"
    };
  } catch {
    return null;
  }
}

/** What the Plan asked THIS sketch to stage — taken once. */
export function takeStage( sketchKey: string ): Stage | null {
  const store = session();
  const stage = readStage(
    store?.getItem( KEY ) ?? null,
    sketchKey,
    Date.now()
  );

  if ( stage ) {
    store?.removeItem( KEY );
  }

  return stage;
}
