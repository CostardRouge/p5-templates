/**
 * Which of Postiz's posts are Sketchbook's — the maintainer's convention for
 * every app posting through his one Postiz (Atelier's `atelierPosts`, in
 * CostardRouge/atelier `src/shared/recap/recap-planned.ts`): a view that lists
 * posts shows only its own app's, while the rhythm (free slots, one a day, the
 * week's ceiling) keeps counting EVERY post of the account, whatever app made
 * it — so nothing here is read by `plannedInstants`.
 *
 * Pure and DOM-free.
 */
import {
  hasSketchbookTag, type PostizPost
} from "./client";

/**
 * Sketchbook's posts: tagged `Sketchbook` (case aside), or one whose id this
 * browser kept when it sent it — how a post sent before the tag existed in his
 * Postiz is still known — and any post of the same Postiz group as one of
 * those (one send on several accounts). A post with no app tag and no kept id
 * belongs to no app, so it is not ours. `others` counts what is left out.
 */
export function sketchbookPosts(
  posts: readonly PostizPost[], keptIds: Iterable<string>
): { mine: PostizPost[];
  others: number } {
  const kept = new Set( keptIds );
  const own = ( p: PostizPost ) => hasSketchbookTag( p ) || kept.has( p.id );
  const groups = new Set( posts.filter( ( p ) => p.group && own( p ) ).map( ( p ) => p.group as string ) );
  const mine = posts.filter( ( p ) => own( p ) || ( p.group !== null && groups.has( p.group ) ) );

  return {
    mine,
    others: posts.length - mine.length
  };
}

/** What a view says of the posts it leaves out: hidden, and still counted. */
export const HIDDEN_NOTE = "Only what Sketchbook sent is listed. Posts from your other apps on this Postiz are hidden, yet they still take their slots of your rhythm.";
