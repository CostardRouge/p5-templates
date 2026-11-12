/**
 * Sending an export's files to the person's Postiz — the one routine behind
 * Export › Publish and `publish.schedule`, so the button and an agent can
 * never send differently (Atelier's `recap-post.ts`, same rule): the files
 * made postable (a PNG becomes a JPEG — Instagram takes nothing else), checked
 * before a byte leaves, uploaded one at a time, then ONE post request with an
 * entry per account.
 */

import {
  channelProblem,
  postProblem,
  uploadProblem,
  type PostEntry,
  type PostizClient,
  type PostizMedia
} from "./client";
import type {
  PostRoute
} from "./plan";
import type {
  Publication, PublishedPost
} from "./publishStore";

/** `loop-1080x1920.png` → `loop-1080x1920.jpg`. Pure. */
export function jpegName( name: string ): string {
  return /\.[a-z0-9]+$/i.test( name ) ? name.replace(
    /\.[a-z0-9]+$/i,
    ".jpg"
  ) : `${ name }.jpg`;
}

/** The MIME type a file name says, for blobs the recorder hands back untyped. Pure. */
export function mimeOf(
  name: string, type = ""
): string {
  if ( type ) {
    return type;
  }

  const ext = name.split( "." ).pop()
    ?.toLowerCase();

  return ext === "mp4" ? "video/mp4" : ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webm" ? "video/webm" : ext === "gif" ? "image/gif" : "application/octet-stream";
}

/**
 * A PNG as the JPEG Instagram takes: drawn on white (a transparent sketch
 * would turn black), at quality 0.92, the same pixels. Anything else passes
 * through untouched. The person's own download stays the PNG.
 */
export async function postableFile( file: File ): Promise<File> {
  if ( file.type !== "image/png" ) {
    return file;
  }

  const bitmap = await createImageBitmap( file );

  try {
    const canvas = document.createElement( "canvas" );

    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const ctx = canvas.getContext( "2d" );

    if ( !ctx ) {
      throw new Error( "This browser cannot convert the picture to JPEG." );
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );
    ctx.drawImage(
      bitmap,
      0,
      0
    );

    const blob = await new Promise<Blob | null>( ( done ) => canvas.toBlob(
      done,
      "image/jpeg",
      0.92
    ) );

    if ( !blob ) {
      throw new Error( "This browser cannot convert the picture to JPEG." );
    }

    return new File(
      [
        blob
      ],
      jpegName( file.name ),
      {
        type: "image/jpeg"
      }
    );
  } finally {
    bitmap.close();
  }
}

export interface SendRoutes {
  client: PostizClient;
  /** Where it goes: one account, one variant (`planPost`). */
  routes: readonly PostRoute[];
  /** Each variant's files, already postable (`postableFile`), by variant id. */
  files: ReadonlyMap<string, readonly File[]>;
  /** The long caption's words (Instagram, TikTok, YouTube). */
  caption: string;
  /** The short caption's words (Threads, X, Bluesky). */
  shortCaption: string;
  at: Date | "now" | "draft";
  signal?: AbortSignal;
  /** Before each file leaves: its place, of how many. */
  onFile?: ( n: number, of: number ) => void;
}

/** Why these routes cannot go with these files, or null — said before a byte leaves. Pure. */
export function routesProblem(
  routes: readonly Pick<PostRoute, "channel" | "provider" | "kind" | "variant">[],
  files: ReadonlyMap<string, readonly { type: string;
    size: number;
    name: string }[]>
): string | null {
  if ( !routes.length ) {
    return "Tick an account to post to.";
  }

  for ( const route of routes ) {
    const own = files.get( route.variant.id ) ?? [];
    const problem = ( route.kind ? postProblem(
      route.kind,
      own
    ) : null ) ?? channelProblem(
      route.provider,
      own
    );

    if ( problem ) {
      return `${ route.channel.name }: ${ problem }`;
    }
  }

  return [
    ...files.values()
  ].flat().map( uploadProblem )
    .find( Boolean ) ?? null;
}

/**
 * The one send: each variant's files uploaded ONCE, then one `POST /posts`
 * with an entry per account (its own files and words); an Instagram account
 * that also takes the file as a story gets it in a second request beside it.
 */
export async function sendRoutes( s: SendRoutes ): Promise<Publication> {
  const problem = routesProblem(
    s.routes,
    s.files
  );

  if ( problem ) {
    throw new Error( problem );
  }

  const used = [
    ...new Set( s.routes.map( ( r ) => r.variant.id ) )
  ];
  const total = used.reduce(
    (
      n, id
    ) => n + ( s.files.get( id )?.length ?? 0 ),
    0
  );
  const media = new Map<string, PostizMedia[]>();
  let n = 0;

  for ( const id of used ) {
    const uploaded: PostizMedia[] = [];

    for ( const file of s.files.get( id ) ?? [] ) {
      n += 1;
      s.onFile?.(
        n,
        total
      );
      uploaded.push( await s.client.upload(
        file,
        s.signal
      ) );
    }
    media.set(
      id,
      uploaded
    );
  }

  const entry = (
    route: PostRoute, story: boolean
  ): PostEntry => ( {
    channel: route.channel,
    choices: story ? {
      ...route.choices,
      kind: "story",
      collaborators: []
    } : route.choices,
    caption: route.short ? s.shortCaption : s.caption,
    media: media.get( route.variant.id ) ?? [],
    video: ( s.files.get( route.variant.id ) ?? [] ).some( ( f ) => f.type.startsWith( "video/" ) )
  } );

  const ids = await s.client.createPost(
    {
      entries: s.routes.map( ( r ) => entry(
        r,
        false
      ) ),
      at: s.at
    },
    s.signal
  );

  if ( !ids.length ) {
    throw new Error( "Postiz took the post but gave no id back — look in Postiz before sending it again." );
  }

  // Postiz answers the ids in the entries' order: which post is which account's.
  const posts: PublishedPost[] = ids.map( (
    postId, i
  ) => ( {
    postId,
    channelId: s.routes[ i ]?.channel.id ?? "",
    story: false
  } ) );
  const stories = s.routes.filter( ( r ) => r.story );

  if ( stories.length ) {
    const storyIds = await s.client.createPost(
      {
        entries: stories.map( ( r ) => entry(
          r,
          true
        ) ),
        at: s.at
      },
      s.signal
    );

    ids.push( ...storyIds );
    posts.push( ...storyIds.map( (
      postId, i
    ) => ( {
      postId,
      channelId: stories[ i ]?.channel.id ?? "",
      story: true
    } ) ) );
  }

  const variantNames = [
    ...new Set( s.routes.map( ( r ) => r.variant.name ) )
  ];

  return {
    postIds: ids,
    posts,
    channelIds: s.routes.map( ( r ) => r.channel.id ),
    kind: s.routes.find( ( r ) => r.kind )?.kind ?? "post",
    variantName: variantNames.join( " + " ),
    files: total,
    at: s.at instanceof Date ? s.at.toISOString() : s.at === "now" ? new Date().toISOString() : null,
    target: s.at === "now" ? "now" : s.at === "draft" ? "draft" : "schedule",
    sentAt: Date.now()
  };
}
