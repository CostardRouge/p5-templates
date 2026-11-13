/**
 * The menu's one line under Connections › Publishing (lab 3 Q2, M1): the
 * next post Sketchbook sends, with its networks, and how many sends failed —
 * both leading to the gallery, where the week and the reasons live. Only
 * Sketchbook's posts (`sketchbookPosts`), each SEND counted once (one post to
 * N accounts is N posts in Postiz, one Postiz group).
 *
 * Pure and DOM-free.
 */

import {
  providerOf, type PostizPost, type Provider
} from "./client";
import {
  sketchbookPosts
} from "./own";

export interface PublishingPeek {
  /** The next send still to go out: when, and its networks in order. */
  next: { at: number;
    providers: Provider[] } | null;
  /** Sends with at least one failed account, over what was read. */
  failed: number;
}

const sendOf = ( p: PostizPost ) => p.group ?? `${ p.publishDate }|${ p.id }`;

export function publishingPeek(
  posts: readonly PostizPost[], keptIds: Iterable<string>, now: number
): PublishingPeek {
  const {
    mine
  } = sketchbookPosts(
    posts,
    keptIds
  );
  const ahead = mine
    .filter( ( p ) => p.state === "queue" && Date.parse( p.publishDate ) > now )
    .sort( (
      a, b
    ) => Date.parse( a.publishDate ) - Date.parse( b.publishDate ) );
  const first = ahead[ 0 ];
  const failed = new Set( mine.filter( ( p ) => p.state === "error" ).map( sendOf ) );

  if ( !first ) {
    return {
      next: null,
      failed: failed.size
    };
  }

  const together = ahead.filter( ( p ) => sendOf( p ) === sendOf( first ) || p.publishDate === first.publishDate );

  return {
    next: {
      at: Date.parse( first.publishDate ),
      providers: [
        ...new Set( together.map( ( p ) => providerOf( p.channel?.identifier ?? "" ) ) )
      ]
    },
    failed: failed.size
  };
}
