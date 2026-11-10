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
  providerOf,
  uploadProblem,
  type PostChoices,
  type PostizChannel,
  type PostizClient
} from "./client";
import type {
  Publication
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

export interface SendPost {
  client: PostizClient;
  channels: readonly PostizChannel[];
  choices: PostChoices;
  caption: string;
  /** The export's files, already JPEG where they need to be (`postableFile`). */
  files: readonly File[];
  at: Date | "now" | "draft";
  variantName: string;
  signal?: AbortSignal;
  /** Before each file leaves: its place, of how many. */
  onFile?: ( n: number, of: number ) => void;
}

/** Why these files cannot go to these accounts as chosen, or null. Pure. */
export function sendProblem(
  channels: readonly Pick<PostizChannel, "identifier" | "name">[],
  kind: PostChoices[ "kind" ],
  files: readonly { type: string;
    size: number;
    name: string }[]
): string | null {
  if ( !channels.length ) {
    return "Tick an account to post to.";
  }

  if ( channels.some( ( c ) => providerOf( c.identifier ) === "instagram" ) ) {
    const problem = postProblem(
      kind,
      files
    );

    if ( problem ) {
      return problem;
    }
  }

  for ( const channel of channels ) {
    const problem = channelProblem(
      providerOf( channel.identifier ),
      files
    );

    if ( problem ) {
      return `${ channel.name }: ${ problem }`;
    }
  }

  return files.map( uploadProblem ).find( Boolean ) ?? null;
}

export async function sendPost( s: SendPost ): Promise<Publication> {
  const problem = sendProblem(
    s.channels,
    s.choices.kind,
    s.files
  );

  if ( problem ) {
    throw new Error( problem );
  }

  const media = [];

  for ( const [
    i,
    file
  ] of s.files.entries() ) {
    s.onFile?.(
      i + 1,
      s.files.length
    );
    media.push( await s.client.upload(
      file,
      s.signal
    ) );
  }

  const ids = await s.client.createPost(
    {
      channels: s.channels,
      choices: s.choices,
      caption: s.caption,
      media,
      video: s.files.some( ( f ) => f.type.startsWith( "video/" ) ),
      at: s.at
    },
    s.signal
  );

  if ( !ids.length ) {
    throw new Error( "Postiz took the post but gave no id back — look in Postiz before sending it again." );
  }

  return {
    postIds: ids,
    channelIds: s.channels.map( ( c ) => c.id ),
    kind: s.choices.kind,
    variantName: s.variantName,
    files: s.files.length,
    at: s.at instanceof Date ? s.at.toISOString() : s.at === "now" ? new Date().toISOString() : null,
    target: s.at === "now" ? "now" : s.at === "draft" ? "draft" : "schedule",
    sentAt: Date.now()
  };
}
