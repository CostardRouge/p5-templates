/**
 * What the plan knows of a sketch's posts: the sends THIS browser kept
 * (`publishStore`) and the posts of Postiz whose caption links to a sketch —
 * another device's. A draft and a failed post are not a post. Pure.
 */

import {
  sketchFromCaption
} from "../gallery/sends";

export interface Posted {
  /** `<engine>/<name>`. */
  sketchKey: string;
  at: number;
}

export function postedFrom(
  publications: readonly { key: string;
    publication: { at: string | null;
      target: string;
      sentAt: number }; }[],
  posts: readonly { content: string;
    publishDate: string;
    state: string }[] | null
): Posted[] {
  const out: Posted[] = [];

  for ( const {
    key, publication
  } of publications ) {
    if ( publication.target === "draft" ) {
      continue;
    }

    const at = publication.at ? Date.parse( publication.at ) : NaN;

    out.push( {
      sketchKey: key,
      at: Number.isFinite( at ) ? at : publication.sentAt
    } );
  }

  for ( const post of posts ?? [] ) {
    const sketchKey = post.state === "error" || post.state === "draft" ? null : sketchFromCaption( post.content );
    const at = Date.parse( post.publishDate );

    if ( sketchKey && Number.isFinite( at ) ) {
      out.push( {
        sketchKey,
        at
      } );
    }
  }

  return out;
}
