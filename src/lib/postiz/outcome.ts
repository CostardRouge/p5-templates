/**
 * What became of a send, account by account: the posts Postiz LISTS
 * (`GET /posts`) matched to the ids the send got back. The Sent screen used
 * to say "publishing" for every account whatever happened — on 2026-11-11 X
 * and Bluesky failed under it and only Atelier's Planned showed it.
 *
 * Pure: a publication and a listing in, one outcome per account out.
 */

import type {
  PostizPost, PostState
} from "./client";
import type {
  Publication, PublishedPost
} from "./publishStore";

export interface AccountOutcome {
  channelId: string;
  postId: string;
  /** The story sent beside an Instagram post. */
  story: boolean;
  /** `unknown` while Postiz does not list it (not looked yet, or out of the window). */
  state: PostState | "unknown";
  error: string | null;
  /** The live post, once published. */
  url: string | null;
}

/** Which post is which account's — recorded since 2026-11-12, guessed by order before. */
export function publishedPosts( publication: Publication ): PublishedPost[] {
  if ( publication.posts?.length ) {
    return publication.posts;
  }

  return publication.postIds.map( (
    postId, i
  ) => ( {
    postId,
    channelId: publication.channelIds[ i ] ?? "",
    story: false
  } ) );
}

/** Each account's post as Postiz lists it; one it does not list stays `unknown`. */
export function readOutcomes(
  publication: Publication, listed: readonly PostizPost[]
): AccountOutcome[] {
  const byId = new Map( listed.map( ( p ) => [
    p.id,
    p
  ] ) );

  return publishedPosts( publication ).map( ( post ) => {
    const found = byId.get( post.postId );

    return {
      channelId: found?.channel?.id ?? post.channelId,
      postId: post.postId,
      story: post.story,
      state: found?.state ?? "unknown",
      error: found?.error ?? null,
      url: found?.releaseURL ?? null
    };
  } );
}

/**
 * The accounts whose POST failed, each once — what *Send again* resends. A
 * story that failed beside a post that went out shows on its row only:
 * sending the account again would post it twice.
 */
export function failedChannels( outcomes: readonly AccountOutcome[] ): string[] {
  return [
    ...new Set( outcomes.filter( ( o ) => o.state === "error" && !o.story ).map( ( o ) => o.channelId ) )
  ].filter( Boolean );
}

/** True while a post may still change on its own: queued, or not listed yet. */
export function stillMoving( outcomes: readonly AccountOutcome[] ): boolean {
  return outcomes.some( ( o ) => o.state === "queue" || o.state === "unknown" );
}

/**
 * The window to list: a day each side of when it goes out (Postiz filters on
 * the publish date, and a "now" send's date is the send's). A draft has no
 * date; its send's instant stands in.
 */
export function outcomeWindow( publication: Publication ): { from: Date;
  to: Date } {
  const at = publication.at ? Date.parse( publication.at ) : publication.sentAt;
  const day = 24 * 60 * 60 * 1000;

  return {
    from: new Date( at - day ),
    to: new Date( at + day )
  };
}

/** A send made of what was resent: the failed accounts' posts replaced by the new ones. */
export function mergeResend(
  publication: Publication, failed: readonly string[], resent: Publication
): Publication {
  const gone = new Set( failed );
  const kept = publishedPosts( publication ).filter( ( p ) => !gone.has( p.channelId ) );
  const posts = [
    ...kept,
    ...publishedPosts( resent )
  ];

  return {
    ...publication,
    postIds: posts.map( ( p ) => p.postId ),
    posts,
    channelIds: [
      ...new Set( [
        ...publication.channelIds,
        ...resent.channelIds
      ] )
    ]
  };
}
