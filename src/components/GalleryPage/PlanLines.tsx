"use client";

/**
 * A Plan line's POST, read away from its sketch (lab 7, pass 3): the words it
 * will carry, account by account, as Export › Publish would fit them — and
 * the editor that changes them in place. Loaded only when the Plan is open
 * with a Postiz kept: it brings the catalogue's facts and the pill editor,
 * which the gallery's other views never need.
 */

import React from "react";
import clsx from "clsx";

import PillEditor from "@/components/ClientProcessingSketch/components/SketchOptions/components/ExportPanel/components/PillEditor";
import {
  ensureVariants
} from "@/lib/export/variantStore";
import {
  makeVariant, VARIANT_PRESETS, type ExportVariant
} from "@/lib/export/variants";
import {
  tickedAccounts
} from "@/lib/planner/approval";
import {
  wantedVariants
} from "@/lib/planner/usualVariants";
import {
  postShape, variantFormat
} from "@/lib/postiz/postShape";
import {
  lineDraft, linePlan, previewSpans, quotesPiece, wordsStamp
} from "@/lib/planner/approval";
import {
  REEL_HOST, type PlanSlot
} from "@/lib/planner/planner";
import {
  reelSeconds
} from "@/lib/planner/reel";
import {
  DEFAULT_CAPTION
} from "@/lib/postiz/caption";
import {
  PROVIDER_LABEL
} from "@/lib/postiz/client";
import {
  publishFacts, withSends
} from "@/lib/postiz/facts";
import {
  paletteOf, type PillContext
} from "@/lib/postiz/pills";
import {
  routeWords, type PostPlan
} from "@/lib/postiz/plan";
import {
  postKeyOfProposal
} from "@/lib/postiz/postKey";
import {
  allPublications, getDraft, patchDraft, type PostDraft
} from "@/lib/postiz/publishStore";
import type {
  PostizConnection
} from "@/lib/postiz/store";

export interface LinePost {
  /** Where the line's words are kept (`publishStore`). */
  postKey: string;
  draft: PostDraft;
  plan: PostPlan;
  /** The words as they stand now (`wordsStamp`) — what an approval is checked against. */
  stamp: string;
  /** The shared words' template. */
  template: string;
  ctx: PillContext;
}

/** The post of the line on `slot`, as it stands in this browser; null for a line that proposes nothing. */
export function readLinePost(
  conn: PostizConnection, slot: PlanSlot, planned: readonly Date[], now: number
): LinePost | null {
  const p = slot.proposal;

  if ( !p ) {
    return null;
  }

  const postKey = slot.held?.postKey ?? postKeyOfProposal( p );
  const draft = lineDraft(
    p,
    getDraft( postKey )
  );
  const [
    engine,
    name
  ] = p.sketchKey.split( "/" );
  // A reel's loop is known (`reel.ts`); a sketch's is read from its page when
  // it renders — the catalogue's default stands in (`quotesPiece` says so).
  const facts = withSends(
    publishFacts(
      p.reel ? REEL_HOST.name : name,
      p.reel ? REEL_HOST.engine : engine,
      p.reel ? {
        duration: reelSeconds( p.reel.scenes.length )
      } : undefined,
      1
    ),
    p.sketchKey,
    draft.note,
    allPublications()
  );
  // The sketch's variants, plus the ones the queue will add for the accounts'
  // usual formats (`usualVariants.ts`) — so the line reads as it will be sent.
  const kept = previewSpans( ensureVariants( p.sketchKey ).variants );
  const added: ExportVariant[] = wantedVariants(
    conn.usual,
    tickedAccounts(
      draft,
      conn
    ),
    kept.map( ( v ) => variantFormat(
      postShape(
        v.variant,
        v.slideSpan
      ),
      v.size
    ) ),
    VARIANT_PRESETS
  ).map( ( wanted ) => ( {
    ...makeVariant( VARIANT_PRESETS.find( ( preset ) => preset.key === wanted.preset )! ),
    ...wanted.patch,
    id: `plan-${ wanted.format }`
  } ) );
  const plan = linePlan( {
    conn,
    proposal: p,
    draft,
    slot: slot.slot,
    spans: [
      ...kept,
      ...previewSpans( added )
    ],
    facts,
    planned,
    now: new Date( now )
  } );

  return {
    postKey,
    draft,
    plan,
    stamp: wordsStamp(
      draft,
      conn
    ),
    template: draft.caption ?? DEFAULT_CAPTION,
    ctx: {
      facts,
      at: slot.at,
      timeZone: conn.rhythm.timeZone,
      dayStart: conn.dayStart,
      phrases: conn.phrases
    }
  };
}

const EYEBROW = "font-mono text-[10.5px] uppercase tracking-[0.08em] text-foreground/50";
const STATE_WORD: Record<PostPlan[ "routes" ][ number ][ "words" ][ "state" ], string> = {
  follows: "shared words",
  adapted: "fitted",
  own: "its own words",
  stale: "its own · shared changed",
  over: "too long"
};

/**
 * The words of a line: the shared text, editable where it stands, and under it
 * how each account will read them. Editing writes the line's post
 * (`publishStore`) — the same post Export › Publish opens — and new words are
 * never approved.
 */
export function PlanWords( {
  conn, post, locked
}: {
  conn: PostizConnection;
  post: LinePost;
  /** The line is being rendered or is already in Postiz: its words are read, not edited. */
  locked: boolean;
} ) {
  const {
    plan
  } = post;

  return (
    <div className="flex flex-col gap-2" data-plan-words>
      <div className="flex items-baseline justify-between gap-2">
        <span className={ EYEBROW }>Words</span>
        <span className="font-mono text-[10.5px] text-foreground/45">{locked ? "as sent" : "type / for a pill"}</span>
      </div>
      {locked
        ? <p className="whitespace-pre-wrap rounded-lg border border-border bg-background p-2 text-xs text-foreground/80 [overflow-wrap:anywhere]">{plan.caption.text}</p>
        : (
          // The editor fills itself after its first paint: its height is
          // reserved from the words' line count (its own type size and
          // leading), so nothing under it moves when it does.
          <div
            className="text-base leading-[1.9] sm:text-sm"
            style={ {
              minHeight: `calc(${ post.template.split( "\n" ).length } * 1.9em + 18px)`
            } }
          >
            <PillEditor
              id={ `plan-words-${ post.postKey }` }
              label="the words of this post"
              value={ post.template }
              ctx={ post.ctx }
              palette={ paletteOf( conn.phrases ) }
              small
              onChange={ ( template ) => patchDraft(
                post.postKey,
                {
                  caption: template
                }
              ) }
            />
          </div>
        )}
      {quotesPiece( post.template ) && (
        <p className="text-[11px] leading-snug text-foreground/50">
          The loop’s length and this post’s number are read from the sketch when it renders; what shows here is the catalogue’s.
        </p>
      )}

      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border" data-plan-accounts>
        {plan.routes.map( ( route ) => (
          <li key={ route.channel.id } className="flex flex-col gap-1 p-2">
            <span className="flex items-center gap-2 text-xs">
              <span className="min-w-0 truncate font-semibold text-foreground">{route.channel.name}</span>
              <span className="shrink-0 text-foreground/50">{PROVIDER_LABEL[ route.provider ]}</span>
              <span
                className={ clsx(
                  "ml-auto shrink-0 font-mono text-[10.5px] tabular-nums",
                  route.words.state === "over" ? "text-red-600 dark:text-red-400" : "text-foreground/50"
                ) }
              >
                {STATE_WORD[ route.words.state ]} · {route.words.length}/{route.words.limit}
              </span>
            </span>
            <span className="font-mono text-[10.5px] text-foreground/45">{routeWords( route )}</span>
            <p className="max-h-24 overflow-y-auto whitespace-pre-wrap text-[11.5px] leading-snug text-foreground/75 [overflow-wrap:anywhere]" data-plan-account-words={ route.channel.id }>
              {route.words.text}
            </p>
            {route.words.notes.length > 0 && (
              <span className="text-[10.5px] text-foreground/45">{route.words.notes.join( " · " )}</span>
            )}
          </li>
        ) )}
        {plan.routes.length === 0 && (
          <li className="p-2 text-xs text-foreground/60">{plan.blocked ?? "No account takes this post."}</li>
        )}
      </ul>
    </div>
  );
}
