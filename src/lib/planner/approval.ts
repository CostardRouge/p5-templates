/**
 * Approving a line of the Plan in place (lab 7, pass 3).
 *
 * The rule, extended from one post to a batch: approving covers the WORDS
 * shown — the shared template, each account's own words, the note, and the
 * accounts they go to. They are stamped when the person approves; any later
 * change to one of them, by the person or by an agent, makes the stamp differ
 * and the line is no longer approved. Only the person's gesture in the Plan
 * stamps a line: there is no command that does.
 *
 * Pure: the post draft, the connection and the plan's line in; a reading out.
 */

import {
  DEFAULT_CAPTION
} from "../postiz/caption";
import type {
  ExportVariant
} from "../export/variants";
import {
  planPost, type PostPlan, type VariantSpan
} from "../postiz/plan";
import type {
  PillFacts
} from "../postiz/pills";
import type {
  PostDraft
} from "../postiz/publishStore";
import type {
  PostizConnection
} from "../postiz/store";
import type {
  PlanSlot, Proposal
} from "./planner";
import {
  reelCaption
} from "./reel";

/**
 * The draft a line's post is read from: the one kept for it, and — for a reel
 * that has no words yet — the words a reel starts from (`reelCaption`), since
 * the default caption's `{title}` and `{link}` would name the empty host.
 */
export function lineDraft(
  proposal: Pick<Proposal, "title" | "pillar" | "reel">, draft: PostDraft
): PostDraft {
  return draft.caption === null && proposal.reel ? {
    ...draft,
    caption: reelCaption( proposal )
  } : draft;
}

/** The accounts a draft goes to: its own ticks or the connection's defaults, an invited collaborator aside. Pure. */
export function tickedAccounts(
  draft: PostDraft, conn: PostizConnection
): string[] {
  const invited = new Set( draft.collabAccounts );
  const live = new Set( conn.channels.map( ( c ) => c.id ) );

  return ( draft.channelIds ?? conn.defaultChannelIds ).filter( ( id ) => live.has( id ) && !invited.has( id ) ).sort();
}

function fnv( text: string ): string {
  let h = 0x811c9dc5;

  for ( let i = 0; i < text.length; i++ ) {
    h ^= text.charCodeAt( i );
    h = Math.imul(
      h,
      0x01000193
    );
  }

  return ( h >>> 0 ).toString( 36 );
}

/**
 * What an approval covers, as a short stamp: the shared words, each ticked
 * account's own words, the legacy short caption, the note and the accounts.
 * Two drafts that would read the same give the same stamp; anything a reader
 * could tell apart gives another.
 */
export function wordsStamp(
  draft: PostDraft, conn: PostizConnection
): string {
  const ids = tickedAccounts(
    draft,
    conn
  );
  const said = JSON.stringify( [
    draft.caption ?? DEFAULT_CAPTION,
    draft.shortCaption,
    draft.note,
    ids,
    ids.map( ( id ) => draft.own[ id ] ?? null )
  ] );

  return `${ said.length.toString( 36 ) }.${ fnv( said ) }.${ fnv( said.split( "" ).reverse()
    .join( "" ) ) }`;
}

/** Where a line of the plan stands, for the person and for `plan.get`. */
export type LineStatus =
  | "empty"
  | "skipped"
  | "proposed"
  | "pinned"
  | "approved"
  /** Approved, then its words changed: it waits to be approved again. */
  | "reworded"
  /** Approved, but another post took its slot. */
  | "taken"
  | "rendering"
  | "planned"
  | "failed";

/**
 * `stamp` is the line's words as they stand NOW (`wordsStamp`), null when
 * they cannot be read (no Postiz); `running` says a queue is alive on it.
 */
export function lineStatus(
  slot: Pick<PlanSlot, "proposal" | "skipped" | "held" | "taken">, stamp: string | null, running = false
): LineStatus {
  const line = slot.held;

  if ( !line ) {
    return slot.skipped ? "skipped" : !slot.proposal ? "empty" : slot.proposal.pin ? "pinned" : "proposed";
  }
  if ( line.state === "planned" ) {
    return "planned";
  }
  if ( line.state === "rendering" && running ) {
    return "rendering";
  }
  if ( slot.taken ) {
    return "taken";
  }
  if ( line.stamp === null || ( stamp !== null && stamp !== line.stamp ) ) {
    return "reworded";
  }

  return line.state === "failed" ? "failed" : "approved";
}

/** A line the queue may render and send: approved as its words stand, on a slot still its own. */
export function queueable( status: LineStatus ): boolean {
  return status === "approved" || status === "failed";
}

const FALLBACK_SIZE = {
  width: 1080,
  height: 1350
};

/**
 * Variants as the Plan can know them away from the sketch: one slide, and a
 * variant that follows the sketch's own size taken as 4:5. Good for the
 * words (they depend on the account's network alone); the sketch page reads
 * the real spans when the line is rendered.
 */
export function previewSpans( variants: readonly ExportVariant[] ): VariantSpan[] {
  return variants.map( ( variant ) => ( {
    variant,
    slideSpan: 1,
    size: variant.size ?? FALLBACK_SIZE
  } ) );
}

/** A line's post, read as Export › Publish reads a post (`planPost`), scheduled on the line's slot. */
export function linePlan( {
  conn, proposal, draft, slot, spans, facts, planned, now
}: {
  conn: PostizConnection;
  proposal: Pick<Proposal, "title" | "pillar" | "reel">;
  draft: PostDraft;
  /** The line's slot, ISO. */
  slot: string;
  spans: readonly VariantSpan[];
  facts: PillFacts;
  planned: readonly Date[];
  now?: Date;
} ): PostPlan {
  return planPost( {
    conn,
    draft: lineDraft(
      proposal,
      draft
    ),
    when: {
      kind: "at",
      at: slot
    },
    variants: spans,
    facts,
    // The line's own slot is its own: it must not warn about itself.
    planned: planned.filter( ( at ) => at.toISOString() !== slot ),
    now
  } );
}

/** Pills whose value is the rendered piece's, or this send.s number — known only when the line is rendered and sent (`pills.ts`). */
const PIECE_PILLS = /\{(loop|seconds|fps|slides|postNo|catNo)(\||\})/;

/** True when these words quote the piece itself — its loop, its frame rate — which the Plan reads from the catalogue's defaults. */
export function quotesPiece( template: string ): boolean {
  return PIECE_PILLS.test( template );
}
