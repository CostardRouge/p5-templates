/**
 * A post resolved from what is kept — the variant that goes, the accounts,
 * the kind, the instant, the words, and why it cannot go yet. One reading for
 * the Export dialog's Post band and footer AND the `publish.*` commands, so a
 * person and an agent always see the same post.
 *
 * Pure: the connection, the sketch's post, its variants, the planned posts and
 * a clock in; a plan out.
 */

import {
  providerOf, type PostChoices, type PostKind, type PostizChannel
} from "./client";
import {
  captionLimit, DEFAULT_CAPTION, fillCaption, type CaptionFacts
} from "./caption";
import {
  fitKind, postShape, providerFits, type PostShape
} from "./postShape";
import type {
  PostDraft, When
} from "./publishStore";
import {
  nextFreeSlot, rhythmWarnings, slotLabel
} from "./rhythm";
import type {
  PostizConnection
} from "./store";
import type {
  ExportVariant
} from "../export/variants";

/**
 * The instants Postiz's live posts go out at, ONE per post: a post sent to
 * several accounts is listed once per account, and counting each would fill
 * the rhythm's week with a single post (seen headless: one post to Instagram
 * and TikTok made the week's three). Drafts and failures hold no slot.
 */
export function plannedInstants( posts: readonly { publishDate: string;
  state: string }[] ): Date[] {
  const seen = new Set<number>();

  for ( const post of posts ) {
    const at = Date.parse( post.publishDate );

    if ( post.state !== "error" && post.state !== "draft" && Number.isFinite( at ) ) {
      seen.add( at );
    }
  }

  return [
    ...seen
  ].sort( (
    a, b
  ) => a - b )
    .map( ( at ) => new Date( at ) );
}

export interface PostPlan {
  variant: ExportVariant | null;
  shape: PostShape | null;
  /** Every account, with why it cannot take this post (null when it can). */
  accounts: { channel: PostizChannel;
    ticked: boolean;
    reason: string | null }[];
  /** The ticked accounts that can take it — where it goes. */
  targets: PostizChannel[];
  kind: PostKind | null;
  /** An Instagram account is among the targets: the kind and its options matter. */
  instagram: boolean;
  /** The instant, `now`, `draft`, or null when a custom time is missing. */
  at: Date | "now" | "draft" | null;
  /** The next free slot of the rhythm, null when none in sight. */
  free: Date | null;
  /** `Sun 15 Nov · 10:00`, `now`, `a draft in Postiz`. */
  whenWords: string;
  /** The footer's verb: `Schedule · Sun 15 Nov · 10:00`, `Publish now…`, `Send as a draft`. */
  verb: string;
  warnings: string[];
  template: string;
  text: string;
  limit: number;
  choices: PostChoices | null;
  /** Why it cannot be sent as it stands, or null. */
  blocked: string | null;
}

/** Variants and the slides each covers, as the panel resolves them. */
export interface VariantSpan {
  variant: ExportVariant;
  slideSpan: number;
}

export function planPost( {
  conn, draft, when, variants, facts, planned, now = new Date()
}: {
  conn: PostizConnection;
  draft: PostDraft;
  when: When;
  variants: readonly VariantSpan[];
  facts: CaptionFacts;
  /** Postiz's live posts' instants (not drafts nor failures). */
  planned: readonly Date[];
  now?: Date;
} ): PostPlan {
  const shaped = variants.map( ( v ) => ( {
    ...v,
    shape: postShape(
      v.variant,
      v.slideSpan
    )
  } ) );
  const picked = shaped.find( ( v ) => v.variant.id === draft.variantId && v.shape.files !== null ) ??
    shaped.find( ( v ) => v.shape.files !== null ) ??
    null;
  const shape = picked?.shape ?? null;
  const tickedIds = new Set( draft.channelIds ?? conn.defaultChannelIds );
  const accounts = conn.channels.map( ( channel ) => {
    const reason = channel.disabled
      ? "Disabled in your Postiz"
      : shape ? providerFits(
        providerOf( channel.identifier ),
        shape
      ) : null;

    return {
      channel,
      ticked: tickedIds.has( channel.id ),
      reason
    };
  } );
  const targets = accounts.filter( ( a ) => a.ticked && !a.reason ).map( ( a ) => a.channel );
  const instagram = targets.some( ( c ) => providerOf( c.identifier ) === "instagram" );
  const kind = shape ? fitKind(
    draft.kind,
    shape
  ) : null;

  const tz = conn.rhythm.timeZone;
  const free = nextFreeSlot(
    conn.rhythm,
    planned,
    now
  );
  let at: PostPlan[ "at" ];

  if ( when.kind === "now" || when.kind === "draft" ) {
    at = when.kind;
  } else if ( when.kind === "at" ) {
    const parsed = new Date( when.at );

    at = Number.isNaN( parsed.getTime() ) ? null : parsed;
  } else {
    at = free ?? "draft";
  }

  const whenWords = at === "now" ? "now" : at === "draft" ? "a draft in Postiz" : at ? slotLabel(
    at,
    tz
  ) : "a time to choose";
  const verb = at === "now" ? "Publish now…" : at === "draft" ? "Send as a draft" : at ? `Schedule · ${ slotLabel(
    at,
    tz
  ) }` : "Schedule";
  const warnings = at instanceof Date ? rhythmWarnings(
    conn.rhythm,
    planned,
    at
  ) : [];

  const template = draft.caption ?? DEFAULT_CAPTION;
  const text = fillCaption(
    template,
    facts
  );
  const limit = captionLimit( targets.map( ( c ) => c.identifier ) );
  const choices: PostChoices | null = kind ? {
    kind,
    trial: kind === "reel" && draft.trial,
    graduate: draft.graduate,
    collaborators: draft.collab && conn.collaborator ? [
      conn.collaborator
    ] : [],
    tiktokPrivacy: draft.tiktokPrivacy,
    youtubeTitle: draft.youtubeTitle ?? facts.title,
    youtubeVisibility: draft.youtubeVisibility
  } : null;

  const youtube = targets.some( ( c ) => providerOf( c.identifier ) === "youtube" );
  let blocked: string | null = null;

  if ( !picked ) {
    blocked = shaped.length ? "No variant can be posted: export an mp4, or png stills." : "Add a variant to post.";
  } else if ( !targets.length ) {
    blocked = accounts.some( ( a ) => a.ticked ) ? `None of the accounts ticked takes ${ shape?.media === "image" ? "pictures" : "this video" } — tick another.` : "Tick an account in To.";
  } else if ( at instanceof Date && at.getTime() <= now.getTime() ) {
    blocked = "That time is past — choose another, or Now.";
  } else if ( at === null ) {
    blocked = "Choose when it goes out.";
  } else if ( text.length > limit ) {
    blocked = `The caption is ${ text.length.toLocaleString( "en-GB" ) } characters — ${ limit.toLocaleString( "en-GB" ) } at most here.`;
  } else if ( youtube && ( choices?.youtubeTitle ?? "" ).trim().length < 2 ) {
    blocked = "YouTube needs a title.";
  }

  return {
    variant: picked?.variant ?? null,
    shape,
    accounts,
    targets,
    kind,
    instagram,
    at,
    free,
    whenWords,
    verb,
    warnings,
    template,
    text,
    limit,
    choices,
    blocked
  };
}
