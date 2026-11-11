/**
 * A post resolved from what is kept — for EACH account ticked, the variant
 * it takes, as what, with which words — plus the instant and why it cannot go
 * yet. One reading for the Export dialog's Post band and footer AND the
 * `publish.*` commands, so a person and an agent always see the same post.
 *
 * Since 2026-11-11 (his ask: «les réels et les stories sur Instagram, et sur
 * Threads et Twitter des images plutôt carrées») a send is a set of ROUTES:
 * one account, one variant. The same send may carry the 9:16 Reel to
 * Instagram and the square picture to Threads, X and Bluesky; each variant is
 * rendered once and uploaded once.
 *
 * Pure: the connection, the sketch's post, its variants, the planned posts and
 * a clock in; a plan out.
 */

import {
  OTHER_PROVIDER,
  PROVIDER_LABEL,
  SHORT_PROVIDERS,
  providerOf,
  type PostChoices,
  type PostKind,
  type PostizChannel,
  type Provider
} from "./client";
import {
  captionLimit, DEFAULT_CAPTION, DEFAULT_SHORT_CAPTION, fillCaption, type CaptionFacts
} from "./caption";
import {
  fitKind, postShape, providerFits, variantFormat, type PostShape
} from "./postShape";
import type {
  PostDraft, When
} from "./publishStore";
import {
  nextFreeSlot, rhythmWarnings, slotLabel
} from "./rhythm";
import {
  handleOf, type PostizConnection
} from "./store";
import type {
  ExportSize, ExportVariant
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

/** Variants, the slides each covers and the size it renders at, as the panel resolves them. */
export interface VariantSpan {
  variant: ExportVariant;
  slideSpan: number;
  /** The size it renders at (the sketch's own when the variant follows it). */
  size: ExportSize;
}

/** One account's part of the send. */
export interface PostRoute {
  channel: PostizChannel;
  provider: Provider;
  variant: ExportVariant;
  shape: PostShape;
  /** `video 9:16` — what the account is remembered to take after this send. */
  format: string;
  /** Why this variant: picked for this account, its usual format, or the first that fits. */
  source: "picked" | "usual" | "first";
  /** Instagram's kind; null elsewhere. */
  kind: PostKind | null;
  /** Instagram: the same file also goes out as a story. */
  story: boolean;
  /** Takes the short caption (Threads, X, Bluesky). */
  short: boolean;
  choices: PostChoices;
}

/** An account as the band lists it: ticked or not, what it can take, its route. */
export interface PlanAccount {
  channel: PostizChannel;
  provider: Provider;
  ticked: boolean;
  /** Why it cannot be posted to at all (disabled, a network Sketchbook does not fill, no variant it takes). */
  reason: string | null;
  /** Every variant, with why this account cannot take it (null when it can). */
  options: { variant: ExportVariant;
    /** `video 9:16`. */
    format: string;
    reason: string | null }[];
  /** The format it usually takes, when one is remembered. */
  usual: string | null;
  route: PostRoute | null;
}

export interface PostPlan {
  accounts: PlanAccount[];
  /** Where it goes: one route per ticked account that can take a variant. */
  routes: PostRoute[];
  /** The variants the routes use, each once, in the table's order — what is rendered. */
  variants: ExportVariant[];
  /** The accounts of the routes. */
  targets: PostizChannel[];
  /**
   * His OTHER Instagram accounts, as collaborators the Instagram post may
   * invite (one post co-authored, instead of a post on each): offered only
   * when the post goes to an Instagram account, never one it goes to.
   */
  partners: { channel: PostizChannel;
    handle: string | null;
    invited: boolean }[];
  /** The Instagram usernames invited, the typed collaborator included. */
  collaborators: string[];
  /** An Instagram account is among the routes: its kinds and options matter. */
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
  /** The long caption (Instagram, TikTok, YouTube): template, words, limit; `used` when a route takes it. */
  caption: { template: string;
    text: string;
    limit: number;
    used: boolean };
  /** The short caption (Threads, X, Bluesky). */
  shortCaption: { template: string;
    text: string;
    limit: number;
    used: boolean };
  /** Files sent in all (each variant's once). */
  files: number;
  /** Why it cannot be sent as it stands, or null. */
  blocked: string | null;
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
  const shaped = variants.map( ( v ) => {
    const shape = postShape(
      v.variant,
      v.slideSpan
    );

    return {
      ...v,
      shape,
      format: variantFormat(
        shape,
        v.size
      )
    };
  } );
  const tickedIds = new Set( draft.channelIds ?? conn.defaultChannelIds );
  // An account invited as a collaborator is not one the post goes to.
  const invitedIds = new Set( draft.collabAccounts );

  const accounts: PlanAccount[] = conn.channels.map( ( channel ) => {
    const provider = providerOf( channel.identifier );
    const options = shaped.map( ( v ) => ( {
      variant: v.variant,
      format: v.format,
      reason: providerFits(
        provider,
        v.shape
      )
    } ) );
    const fitting = shaped.filter( ( v ) => !providerFits(
      provider,
      v.shape
    ) );
    const usual = conn.usual[ channel.id ] ?? null;
    let reason: string | null = null;

    if ( channel.disabled ) {
      reason = "Disabled in your Postiz";
    } else if ( provider === "other" ) {
      reason = OTHER_PROVIDER;
    } else if ( !fitting.length ) {
      reason = shaped.length ? `No variant fits ${ PROVIDER_LABEL[ provider ] } — ${ options[ 0 ]?.reason ?? "" }`.replace(
        / — $/,
        ""
      ) : "Add a variant to post.";
    }

    const ticked = tickedIds.has( channel.id ) && !invitedIds.has( channel.id );
    let route: PostRoute | null = null;

    if ( ticked && !reason ) {
      const picked = fitting.find( ( v ) => v.variant.id === draft.variantFor[ channel.id ] );
      const byUsual = usual ? fitting.find( ( v ) => v.format === usual ) : undefined;
      const byMain = fitting.find( ( v ) => v.variant.id === draft.variantId );
      const chosen = picked ?? byUsual ?? byMain ?? fitting[ 0 ];
      const source: PostRoute[ "source" ] = picked ? "picked" : byUsual ? "usual" : "first";
      const instagram = provider === "instagram";
      const kind = instagram ? fitKind(
        draft.kindFor[ channel.id ] ?? draft.kind,
        chosen.shape
      ) : null;
      const storyAllowed = instagram && kind !== "story" && chosen.shape.files === 1;

      route = {
        channel,
        provider,
        variant: chosen.variant,
        shape: chosen.shape,
        format: chosen.format,
        source,
        kind,
        story: storyAllowed && draft.storyToo.includes( channel.id ),
        short: SHORT_PROVIDERS.has( provider ),
        // The rest of the choices are filled once the collaborators are known.
        choices: {
          kind: kind ?? chosen.shape.kinds[ 0 ] ?? "post"
        }
      };
    }

    return {
      channel,
      provider,
      ticked,
      reason,
      options,
      usual,
      route
    };
  } );

  const routes = accounts.flatMap( ( a ) => a.route ? [
    a.route
  ] : [] );
  const targets = routes.map( ( r ) => r.channel );
  const instagram = routes.some( ( r ) => r.provider === "instagram" );
  const targetIds = new Set( targets.map( ( c ) => c.id ) );
  const partners = instagram
    ? conn.channels
      .filter( ( c ) => !c.disabled && !targetIds.has( c.id ) && providerOf( c.identifier ) === "instagram" )
      .map( ( channel ) => {
        const handle = handleOf(
          conn,
          channel
        );

        return {
          channel,
          handle,
          invited: Boolean( handle ) && draft.collabAccounts.includes( channel.id )
        };
      } )
    : [];
  const collaborators = [
    ...new Set( [
      ...partners.filter( ( p ) => p.invited ).map( ( p ) => p.handle as string ),
      ...( draft.collab && conn.collaborator ? [
        conn.collaborator
      ] : [] )
    ] )
  ];

  for ( const route of routes ) {
    route.choices = {
      kind: route.choices.kind,
      trial: route.kind === "reel" && draft.trial,
      graduate: draft.graduate,
      collaborators: route.provider === "instagram" && route.kind !== "story" ? collaborators : [],
      tiktokPrivacy: draft.tiktokPrivacy,
      youtubeTitle: draft.youtubeTitle ?? facts.title,
      youtubeVisibility: draft.youtubeVisibility
    };
  }

  const used = new Set( routes.map( ( r ) => r.variant.id ) );
  const renderList = variants.map( ( v ) => v.variant ).filter( ( v ) => used.has( v.id ) );
  const files = shaped.filter( ( v ) => used.has( v.variant.id ) ).reduce(
    (
      n, v
    ) => n + ( v.shape.files ?? 0 ),
    0
  );

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

  const longRoutes = routes.filter( ( r ) => !r.short );
  const shortRoutes = routes.filter( ( r ) => r.short );
  const longTemplate = draft.caption ?? DEFAULT_CAPTION;
  const shortTemplate = draft.shortCaption ?? DEFAULT_SHORT_CAPTION;
  const caption = {
    template: longTemplate,
    text: fillCaption(
      longTemplate,
      facts
    ),
    limit: captionLimit( longRoutes.map( ( r ) => r.channel.identifier ) ),
    used: longRoutes.length > 0
  };
  const shortCaption = {
    template: shortTemplate,
    text: fillCaption(
      shortTemplate,
      facts
    ),
    limit: shortRoutes.length ? captionLimit( shortRoutes.map( ( r ) => r.channel.identifier ) ) : 280,
    used: shortRoutes.length > 0
  };

  const youtube = routes.some( ( r ) => r.provider === "youtube" );
  let blocked: string | null = null;

  if ( !shaped.some( ( v ) => v.shape.files !== null ) ) {
    blocked = shaped.length ? "No variant can be posted: export an mp4, or png stills." : "Add a variant to post.";
  } else if ( !routes.length ) {
    blocked = accounts.some( ( a ) => a.ticked ) ? "None of the accounts ticked takes these variants — tick another, or add a variant." : "Tick an account in To.";
  } else if ( at instanceof Date && at.getTime() <= now.getTime() ) {
    blocked = "That time is past — choose another, or Now.";
  } else if ( at === null ) {
    blocked = "Choose when it goes out.";
  } else if ( caption.used && caption.text.length > caption.limit ) {
    blocked = `The caption is ${ caption.text.length.toLocaleString( "en-GB" ) } characters — ${ caption.limit.toLocaleString( "en-GB" ) } at most here.`;
  } else if ( shortCaption.used && shortCaption.text.length > shortCaption.limit ) {
    blocked = `The short caption is ${ shortCaption.text.length.toLocaleString( "en-GB" ) } characters — ${ shortCaption.limit.toLocaleString( "en-GB" ) } at most for ${ shortRoutes.map( ( r ) => PROVIDER_LABEL[ r.provider ] ).join( ", " ) }.`;
  } else if ( instagram && collaborators.length > 3 ) {
    blocked = `Instagram invites 3 collaborators at most — ${ collaborators.length } are ticked.`;
  } else if ( youtube && ( draft.youtubeTitle ?? facts.title ).trim().length < 2 ) {
    blocked = "YouTube needs a title.";
  }

  return {
    accounts,
    routes,
    variants: renderList,
    targets,
    partners,
    collaborators: routes.some( ( r ) => r.provider === "instagram" && r.kind !== "story" ) ? collaborators : [],
    instagram,
    at,
    free,
    whenWords,
    verb,
    warnings,
    caption,
    shortCaption,
    files,
    blocked
  };
}

/** `Reel · mp4`, `Picture · jpg`, `Carousel · 4 jpg` — what a route sends, said short. */
export function routeWords( route: PostRoute ): string {
  const what = route.kind ? {
    reel: "Reel",
    post: "Post",
    carousel: "Carousel",
    story: "Story"
  }[ route.kind ] : route.shape.media === "video" ? "Video" : ( route.shape.files ?? 1 ) > 1 ? "Pictures" : "Picture";
  const files = route.shape.files ?? 0;
  const ext = route.shape.media === "video" ? "mp4" : "jpg";

  return `${ what }${ route.story ? " + Story" : "" } · ${ files > 1 ? `${ files } ${ ext }` : ext }`;
}
