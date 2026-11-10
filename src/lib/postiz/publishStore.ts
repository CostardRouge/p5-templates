/**
 * A sketch's post, as the Export dialog's Post band and the `publish.*`
 * commands share it: which variant goes, as what, to which accounts, with
 * which caption (approved or not), and what this sketch already sent.
 *
 * Per sketch and in `localStorage`, beside the variant list
 * (`export/variantStore.ts`) and for the same reason: a post is a delivery,
 * not part of the document — it must never reach a saved job, an `/embed`
 * link or the options JSON. The WHEN is kept in memory only: a stored date
 * goes stale, the next free slot is recomputed every time.
 */

import type {
  PostKind, TikTokPrivacy, YouTubeVisibility
} from "./client";

export type DeliverMode = "save" | "publish";

export interface PostDraft {
  /** Save or Publish, the footer's switch — Publish first, then the last one used. */
  mode: DeliverMode;
  variantId: string | null;
  /** Instagram's kind; null follows the variant's first fitting one. */
  kind: PostKind | null;
  /** The accounts ticked; null follows the connection's defaults. */
  channelIds: string[] | null;
  /** The caption TEMPLATE; null is Sketchbook's own. */
  caption: string | null;
  /** The person read these words: pressing Schedule, or saying so to Claude. Changing them takes it back. */
  approved: boolean;
  trial: boolean;
  graduate: "auto" | "manual";
  /** Propose the connection's collaborator. */
  collab: boolean;
  tiktokPrivacy: TikTokPrivacy;
  /** null is the sketch's title. */
  youtubeTitle: string | null;
  youtubeVisibility: YouTubeVisibility;
}

export type When =
  | { kind: "next" }
  | { kind: "at";
    at: string;
    /** A time of the person's own (Another time…), not a slot of the rhythm. */
    custom?: boolean }
  | { kind: "now" }
  | { kind: "draft" };

export interface Publication {
  /** One per account, as Postiz made them. */
  postIds: string[];
  channelIds: string[];
  kind: PostKind;
  variantName: string;
  files: number;
  /** When it goes out, ISO; null for a draft. */
  at: string | null;
  target: "schedule" | "now" | "draft";
  sentAt: number;
}

export const DEFAULT_DRAFT: PostDraft = {
  mode: "publish",
  variantId: null,
  kind: null,
  channelIds: null,
  caption: null,
  approved: false,
  trial: false,
  graduate: "auto",
  collab: true,
  tiktokPrivacy: "PUBLIC_TO_EVERYONE",
  youtubeTitle: null,
  youtubeVisibility: "public"
};

const PREFIX = "sketchbook.publish.v1";
const MAX_PUBLICATIONS = 20;
const KINDS: PostKind[] = [
  "reel",
  "post",
  "carousel",
  "story"
];

interface Entry {
  draft: PostDraft;
  when: When;
  publications: Publication[];
}

const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
const NEXT: When = {
  kind: "next"
};

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** A stored draft, whatever an older or a hand-edited copy holds. */
export function readDraft( raw: unknown ): PostDraft {
  const r = ( raw && typeof raw === "object" ? raw : {} ) as Record<string, unknown>;
  const pick = <T >( value: unknown, allowed: readonly T[], fallback: T ): T => allowed.includes( value as T ) ? value as T : fallback;

  return {
    mode: pick(
      r.mode,
      [
        "save",
        "publish"
      ] as const,
      DEFAULT_DRAFT.mode
    ),
    variantId: typeof r.variantId === "string" ? r.variantId : null,
    kind: KINDS.includes( r.kind as PostKind ) ? r.kind as PostKind : null,
    channelIds: Array.isArray( r.channelIds ) ? r.channelIds.filter( ( id ): id is string => typeof id === "string" ) : null,
    caption: typeof r.caption === "string" ? r.caption.slice(
      0,
      6000
    ) : null,
    approved: r.approved === true,
    trial: r.trial === true,
    graduate: pick(
      r.graduate,
      [
        "auto",
        "manual"
      ] as const,
      "auto"
    ),
    collab: r.collab !== false,
    tiktokPrivacy: pick(
      r.tiktokPrivacy,
      [
        "PUBLIC_TO_EVERYONE",
        "MUTUAL_FOLLOW_FRIENDS",
        "FOLLOWER_OF_CREATOR",
        "SELF_ONLY"
      ] as const,
      "PUBLIC_TO_EVERYONE"
    ),
    youtubeTitle: typeof r.youtubeTitle === "string" ? r.youtubeTitle.slice(
      0,
      100
    ) : null,
    youtubeVisibility: pick(
      r.youtubeVisibility,
      [
        "public",
        "unlisted",
        "private"
      ] as const,
      "public"
    )
  };
}

/** A patch applied to a draft: new words take the approval back unless the patch sets it. */
export function patchedDraft(
  draft: PostDraft, patch: Partial<PostDraft>
): PostDraft {
  const next = {
    ...draft,
    ...patch
  };

  if ( "caption" in patch && patch.caption !== draft.caption && !( "approved" in patch ) ) {
    next.approved = false;
  }

  return next;
}

function load( key: string ): Entry {
  let draft = DEFAULT_DRAFT;
  let publications: Publication[] = [];

  try {
    const raw = JSON.parse( storage()?.getItem( `${ PREFIX }:${ key }` ) ?? "null" ) as { draft?: unknown;
      publications?: unknown } | null;

    draft = readDraft( raw?.draft );
    publications = Array.isArray( raw?.publications ) ? ( raw.publications as Publication[] ).filter( ( p ) => p && Array.isArray( p.postIds ) ) : [];
  } catch {
    // Unreadable: start over.
  }

  return {
    draft,
    when: NEXT,
    publications
  };
}

function entry( key: string ): Entry {
  let found = entries.get( key );

  if ( !found ) {
    found = load( key );
    entries.set(
      key,
      found
    );
  }

  return found;
}

function commit(
  key: string, next: Entry
): void {
  entries.set(
    key,
    next
  );

  try {
    storage()?.setItem(
      `${ PREFIX }:${ key }`,
      JSON.stringify( {
        draft: next.draft,
        publications: next.publications
      } )
    );
  } catch {
    // Private mode / quota: kept for this visit.
  }

  for ( const listener of listeners ) {
    listener();
  }
}

export function getDraft( key: string ): PostDraft {
  return entry( key ).draft;
}

export function patchDraft(
  key: string, patch: Partial<PostDraft>
): PostDraft {
  const current = entry( key );
  const draft = patchedDraft(
    current.draft,
    patch
  );

  commit(
    key,
    {
      ...current,
      draft
    }
  );

  return draft;
}

export function getWhen( key: string ): When {
  return entry( key ).when;
}

export function setWhen(
  key: string, when: When
): void {
  commit(
    key,
    {
      ...entry( key ),
      when
    }
  );
}

export function getPublications( key: string ): Publication[] {
  return entry( key ).publications;
}

export function addPublication(
  key: string, publication: Publication
): void {
  const current = entry( key );

  commit(
    key,
    {
      ...current,
      publications: [
        ...current.publications,
        publication
      ].slice( -MAX_PUBLICATIONS )
    }
  );
}

/** A post taken back: forgotten here once Postiz deleted it. */
export function dropPublication(
  key: string, postId: string
): void {
  const current = entry( key );

  commit(
    key,
    {
      ...current,
      publications: current.publications.filter( ( p ) => !p.postIds.includes( postId ) )
    }
  );
}

export function subscribePublish( listener: () => void ): () => void {
  listeners.add( listener );

  return () => {
    listeners.delete( listener );
  };
}

/** For specs, which swap `localStorage` underneath. */
export function resetPublishStore(): void {
  entries.clear();
}
