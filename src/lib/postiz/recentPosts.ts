/**
 * Postiz's posts around today, read at most once a minute and SHARED by the
 * gallery and the menu's Publishing line — opening the menu on the gallery,
 * or the gallery after the menu, asks Postiz nothing more. The window is the
 * gallery's (5 weeks back, 8 ahead, `postizWindow`).
 */

import {
  postizWindow
} from "@/lib/gallery/calendar";
import type {
  PostizClient, PostizPost
} from "./client";

const FRESH_MS = 60 * 1000;
let cached: { base: string;
  at: number;
  read: Promise<PostizPost[]> } | null = null;

/** Every post of the window (any app's), from cache when it is under a minute old; `fresh` asks again. */
export function recentPosts(
  client: PostizClient, fresh = false
): Promise<PostizPost[]> {
  const now = Date.now();

  if ( !fresh && cached && cached.base === client.apiBase && now - cached.at < FRESH_MS ) {
    return cached.read;
  }

  const span = postizWindow( now );
  const read = client.posts(
    span.from,
    span.to
  );
  const mine = {
    base: client.apiBase,
    at: now,
    read
  };

  cached = mine;
  // A failure is not kept: the next look asks again.
  read.catch( () => {
    if ( cached === mine ) {
      cached = null;
    }
  } );

  return read;
}
