/**
 * A client for the person's OWN Postiz — the self-hosted scheduler that
 * publishes to Instagram, TikTok and YouTube through their official APIs.
 * Ported from Atelier (`src/shared/sources/postiz/client.ts`, its labs 12–15),
 * where every limit below was measured on the maintainer's instance; a fix to
 * one belongs in the other.
 *
 * Sketchbook reaches it from the BROWSER only: the address the person typed
 * in Publishing, the API key they pasted (kept in this browser, `store.ts`),
 * on their gesture. Never through Sketchbook's server — every route there is
 * public and unauthenticated (`docs/memory/security.md`), so a server-side
 * call would be an open relay to their accounts.
 *
 * The public API (`<postiz>/api/public/v1`, header `Authorization: <key>`):
 * - `GET  /is-connected`, `GET /integrations` — the accounts it publishes to;
 * - `POST /upload` (multipart `file`) → `{ id, path }`;
 * - `POST /posts` — `{ type: schedule|now|draft, date, shortLink, tags, posts: [{ integration: { id }, value: [{ content, image }], settings: { __type, … } }] }`,
 *   one entry per account, which is how ONE post goes to several accounts;
 * - `GET  /posts?startDate&endDate` → `{ posts }` (state QUEUE · PUBLISHED · ERROR · DRAFT);
 * - `DELETE /posts/:id`.
 *
 * Limits: 90 post requests an hour; an upload over 100 MB is refused by
 * Cloudflare with a 413 that carries no CORS header — the browser sees a bare
 * network error — so the size is checked HERE, before anything leaves
 * (`uploadProblem`). Postiz caps an image at 10 MB. Instagram takes a picture
 * as JPEG only, never PNG (`postFiles.ts` converts).
 *
 * The request builders and readers are pure; `PostizClient` only wires them
 * to a `fetch`, so the specs drive it with a stub.
 */

/** What an Instagram account receives the files as. TikTok and YouTube take a video (TikTok also pictures). */
export type PostKind = "reel" | "post" | "carousel" | "story";
export type PostState = "queue" | "published" | "error" | "draft";
/** The networks Sketchbook knows how to fill a post for; any other account is listed and left unticked. */
export type Provider = "instagram" | "tiktok" | "youtube" | "threads" | "x" | "bluesky" | "other";

/** An account Postiz publishes to. */
export interface PostizChannel {
  id: string;
  name: string;
  /** The provider's identifier — `instagram`, `instagram-standalone`, `tiktok`… — the post's `settings.__type`. */
  identifier: string;
  picture: string | null;
  disabled: boolean;
  /** The account's username on its network (Postiz's `profile`), when Postiz says it — what a collaborator invite needs. */
  handle: string | null;
}

/** A file Postiz holds, ready to go on a post. */
export interface PostizMedia {
  id: string;
  path: string;
}

/**
 * The tag every post Sketchbook sends carries — the maintainer's convention
 * for every app posting through his one Postiz (Atelier's is `Atelier`,
 * CostardRouge/atelier#471): one tag per app, its own name. Postiz links a tag
 * by NAME (`label`) and only to one that already exists in that Postiz — it
 * drops an unknown one silently, and its public API cannot create one — so he
 * makes it once by hand (Create Post › Tags › Add New Tag). Until then a post
 * is known as Sketchbook's by the publications this browser keeps.
 */
export const SKETCHBOOK_TAG = "Sketchbook";

/** A post as Postiz lists it. */
export interface PostizPost {
  id: string;
  group: string | null;
  /** The names of its tags, as Postiz lists them. */
  tags: string[];
  content: string;
  publishDate: string;
  state: PostState;
  releaseURL: string | null;
  error: string | null;
  channel: {
    id: string;
    name: string;
    identifier: string;
    picture: string | null;
  } | null;
}

export class PostizError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super( message );
    this.name = "PostizError";
  }
}

/** Which network an account is, from its identifier. */
export function providerOf( identifier: string ): Provider {
  if ( /^instagram/.test( identifier ) ) {
    return "instagram";
  }

  if ( /^tiktok/.test( identifier ) ) {
    return "tiktok";
  }

  if ( identifier === "youtube" ) {
    return "youtube";
  }

  if ( identifier === "x" ) {
    return "x";
  }

  if ( identifier === "threads" ) {
    return "threads";
  }

  if ( identifier === "bluesky" ) {
    return "bluesky";
  }

  return "other";
}

export const PROVIDER_LABEL: Record<Provider, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  threads: "Threads",
  x: "X",
  bluesky: "Bluesky",
  other: "Other"
};

/** The networks whose posts are short: they take the SHORT caption. */
export const SHORT_PROVIDERS: ReadonlySet<Provider> = new Set( [
  "threads",
  "x",
  "bluesky"
] );

/** The longest caption each network takes (Postiz's own schemas). */
export const CAPTION_LIMIT: Record<Provider, number> = {
  instagram: 2200,
  tiktok: 2000,
  youtube: 5000,
  threads: 500,
  x: 280,
  bluesky: 300,
  other: 2000
};

/** Where the public API is answered, from what the person typed: the Postiz address, or the API's own. */
export function apiCandidates( raw: string ): string[] {
  let url: URL;

  try {
    url = new URL( raw.trim() );
  } catch {
    throw new PostizError( "That is not an address — paste it as https://postiz.example." );
  }

  if ( url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1" ) {
    throw new PostizError( "A Postiz must be reached over https." );
  }

  const base = `${ url.origin }${ url.pathname.replace(
    /\/+$/,
    ""
  ) }`;

  if ( /\/public\/v1$/.test( base ) ) {
    return [
      base
    ];
  }

  // A Postiz behind one domain serves its backend under /api; one whose backend has a domain of its own, at the root.
  return [
    `${ base }/api/public/v1`,
    `${ base }/public/v1`
  ];
}

/** The largest file sent: Cloudflare refuses 100 MB with a 413 the browser cannot read, so stay under it. */
export const MAX_UPLOAD_BYTES = 95 * 1024 * 1024;
/** Postiz's own cap on an image. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/** A carousel through Instagram's API. */
export const MAX_CAROUSEL_ITEMS = 10;

const mb = ( n: number ) => `${ ( n / 1024 / 1024 ).toFixed( n < 10 * 1024 * 1024 ? 1 : 0 ) } MB`;

/** Why `file` cannot be sent, or null — said before a byte leaves. */
export function uploadProblem( file: { size: number;
  type: string;
  name: string } ): string | null {
  const image = file.type.startsWith( "image/" );

  if ( image && file.size > MAX_IMAGE_BYTES ) {
    return `${ file.name } is ${ mb( file.size ) } — Postiz takes an image up to 10 MB.`;
  }

  if ( file.size > MAX_UPLOAD_BYTES ) {
    return `${ file.name } is ${ mb( file.size ) } — your Postiz takes a file up to ${ mb( MAX_UPLOAD_BYTES ) }. A lower frame rate or a shorter loop makes it smaller.`;
  }

  return null;
}

/** Why an Instagram post of `kind` cannot carry these files, or null. */
export function postProblem(
  kind: PostKind, media: readonly { type: string }[]
): string | null {
  if ( !media.length ) {
    return "A post needs a picture or a video.";
  }

  if ( kind === "reel" && ( media.length !== 1 || !media[ 0 ].type.startsWith( "video/" ) ) ) {
    return "A Reel is one video.";
  }

  if ( ( kind === "story" || kind === "post" ) && media.length !== 1 ) {
    return `A ${ kind } is one picture or one video.`;
  }

  if ( kind === "carousel" && media.length < 2 ) {
    return "A carousel is two files at least.";
  }

  if ( kind === "carousel" && media.length > MAX_CAROUSEL_ITEMS ) {
    return `A carousel sent through Instagram's API holds ${ MAX_CAROUSEL_ITEMS } at most — this one has ${ media.length }.`;
  }

  return null;
}

/** Why an account on `provider` cannot take these files, or null. */
export function channelProblem(
  provider: Provider, media: readonly { type: string }[]
): string | null {
  const videos = media.filter( ( m ) => m.type.startsWith( "video/" ) ).length;

  if ( provider === "youtube" && ( media.length !== 1 || videos !== 1 ) ) {
    return "YouTube takes one video.";
  }

  if ( provider === "tiktok" && videos > 0 && media.length !== 1 ) {
    return "TikTok takes one video, or pictures.";
  }

  if ( ( provider === "x" || provider === "bluesky" ) && ( videos > 1 || ( videos === 1 && media.length > 1 ) || media.length > 4 ) ) {
    return `${ PROVIDER_LABEL[ provider ] } takes one video, or 4 pictures at most.`;
  }

  if ( provider === "threads" && ( ( videos > 0 && media.length > 1 ) || media.length > MAX_CAROUSEL_ITEMS ) ) {
    return `Threads takes one video, or ${ MAX_CAROUSEL_ITEMS } pictures at most.`;
  }

  if ( provider === "other" ) {
    return OTHER_PROVIDER;
  }

  return null;
}

export const OTHER_PROVIDER = "Sketchbook posts to Instagram, TikTok, YouTube, Threads, X and Bluesky.";

export type TikTokPrivacy = "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "FOLLOWER_OF_CREATOR" | "SELF_ONLY";
export type YouTubeVisibility = "public" | "unlisted" | "private";

/** What the person chose for a post, read per account by `channelSettings`. */
export interface PostChoices {
  /** Instagram only. */
  kind: PostKind;
  /** A Reel shown to non-followers first. */
  trial?: boolean;
  /** A trial Reel shared to followers when it performs (`SS_PERFORMANCE`), or by hand. */
  graduate?: "auto" | "manual";
  /** Instagram handles invited as collaborators, without the @. */
  collaborators?: readonly string[];
  tiktokPrivacy?: TikTokPrivacy;
  youtubeTitle?: string;
  youtubeVisibility?: YouTubeVisibility;
}

/**
 * The `settings` of one account's entry: Instagram's post type, trial and
 * collaborators; TikTok's required switches (direct post, nobody may duet or
 * stitch a loop, comments open, no added music); YouTube's title and
 * visibility. The shapes are Postiz's own schemas (`integrationSchema`).
 */
export function channelSettings(
  channel: Pick<PostizChannel, "identifier">,
  choices: PostChoices,
  video: boolean
): Record<string, unknown> {
  const provider = providerOf( channel.identifier );
  const settings: Record<string, unknown> = {
    __type: channel.identifier
  };

  if ( provider === "instagram" ) {
    settings.post_type = choices.kind === "story" ? "story" : "post";

    if ( choices.kind === "reel" && choices.trial ) {
      settings.is_trial_reel = true;
      settings.graduation_strategy = choices.graduate === "manual" ? "MANUAL" : "SS_PERFORMANCE";
    }

    const collaborators = ( choices.collaborators ?? [] ).map( ( c ) => c.trim().replace(
      /^@/,
      ""
    ) )
      .filter( Boolean );

    if ( collaborators.length && choices.kind !== "story" ) {
      settings.collaborators = collaborators.map( ( label ) => ( {
        label
      } ) );
    }
  } else if ( provider === "tiktok" ) {
    Object.assign(
      settings,
      {
        privacy_level: choices.tiktokPrivacy ?? "PUBLIC_TO_EVERYONE",
        duet: false,
        stitch: false,
        comment: true,
        autoAddMusic: "no",
        brand_content_toggle: false,
        brand_organic_toggle: false,
        content_posting_method: "DIRECT_POST"
      }
    );

    if ( video ) {
      settings.video_made_with_ai = false;
    }
  } else if ( provider === "youtube" ) {
    settings.title = ( choices.youtubeTitle ?? "" ).trim().slice(
      0,
      100
    );
    settings.type = choices.youtubeVisibility ?? "public";
  } else if ( provider === "x" ) {
    Object.assign(
      settings,
      {
        post_type: "post",
        who_can_reply_post: "everyone",
        made_with_ai: false
      }
    );
  }

  return settings;
}

/** One account's entry of a post: its own files, its own words, its own settings. */
export interface PostEntry {
  channel: Pick<PostizChannel, "id" | "identifier">;
  choices: PostChoices;
  caption: string;
  media: readonly PostizMedia[];
  /** Whether the media is a video — TikTok's settings differ for pictures. */
  video: boolean;
}

export interface PostRequest {
  /**
   * One per account: the same send may carry a 9:16 Reel to Instagram and a
   * square picture to Threads and X — Postiz keeps each entry's own files.
   */
  entries: readonly PostEntry[];
  /** When it goes out; `'now'`, or `'draft'` to leave it in Postiz unsent. */
  at: Date | "now" | "draft";
}

/** The body of `POST /posts`: one entry per account, each with its files, caption and settings. */
export function postBody(
  req: PostRequest, now: Date = new Date()
): Record<string, unknown> {
  return {
    type: req.at === "now" ? "now" : req.at === "draft" ? "draft" : "schedule",
    date: ( req.at instanceof Date ? req.at : now ).toISOString(),
    shortLink: false,
    tags: [
      {
        value: SKETCHBOOK_TAG,
        label: SKETCHBOOK_TAG
      }
    ],
    posts: req.entries.map( ( entry ) => ( {
      integration: {
        id: entry.channel.id
      },
      value: [
        {
          content: entry.caption,
          image: entry.media.map( ( m ) => ( {
            id: m.id,
            path: m.path
          } ) )
        }
      ],
      settings: channelSettings(
        entry.channel,
        entry.choices,
        entry.video
      )
    } ) )
  };
}

const str = ( v: unknown ): string | null => ( typeof v === "string" && v ? v : null );

/** The accounts `GET /integrations` lists, whatever extra fields a version adds. */
export function readChannels( raw: unknown ): PostizChannel[] {
  const list = Array.isArray( raw )
    ? raw
    : raw && typeof raw === "object" && Array.isArray( ( raw as { integrations?: unknown } ).integrations )
      ? ( raw as { integrations: unknown[] } ).integrations
      : [];

  return list.flatMap( ( x ) => {
    if ( !x || typeof x !== "object" ) {
      return [];
    }

    const r = x as Record<string, unknown>;
    const id = str( r.id );

    if ( !id ) {
      return [];
    }

    return [
      {
        id,
        name: str( r.name ) ?? id,
        identifier: str( r.identifier ) ?? str( r.providerIdentifier ) ?? str( r.platform ) ?? "instagram",
        picture: str( r.picture ),
        disabled: r.disabled === true,
        handle: ( str( r.profile ) ?? str( r.username ) ?? "" ).replace(
          /^@/,
          ""
        ) || null
      }
    ];
  } );
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'",
  nbsp: " ",
  "#39": "'"
};

/**
 * A caption as Postiz keeps it — HTML from its editor (`<p>…</p>`, `<br>`,
 * entities) — turned into the plain text it says: each paragraph and break a
 * line, every tag dropped, entities decoded. Never parsed into a document,
 * never injected: it is drawn as text.
 */
export function postizText( html: string ): string {
  return html
    .replace(
      /<br\s*\/?>/gi,
      "\n"
    )
    .replace(
      /<\/(p|div|li|h[1-6])\s*>/gi,
      "\n"
    )
    .replace(
      /<[^>]*>/g,
      ""
    )
    .replace(
      /&(#\d+|#x[0-9a-f]+|[a-z]+\d*);/gi,
      (
        all, e: string
      ) => {
        if ( e[ 0 ] === "#" ) {
          const code = e[ 1 ] === "x" || e[ 1 ] === "X" ? parseInt(
            e.slice( 2 ),
            16
          ) : Number( e.slice( 1 ) );

          return Number.isFinite( code ) && code > 0 && code < 0x110000 ? String.fromCodePoint( code ) : all;
        }

        return ENTITIES[ e.toLowerCase() ] ?? all;
      }
    )
    .replace(
      /[ \t]+\n/g,
      "\n"
    )
    .replace(
      /\n{3,}/g,
      "\n\n"
    )
    .trim();
}

/** What to do about a post a network refused, from what Postiz says — null when the error is not one we know. */
export function failureHint( error: string | null ): string | null {
  if ( !error ) {
    return null;
  }

  // Postiz's Bluesky provider uploads a video to Bluesky's video service and
  // waits for its job; no job back means Bluesky refused the upload (seen
  // 2026-11-11: «Could not prepare the post for Bluesky … missing jobId»).
  if ( /jobId|video\.bsky|uploadVideo|bluesky.{0,60}video/i.test( error ) ) {
    return "Bluesky refused the video. Its video upload needs the account's email verified in Bluesky (Settings › Account) — or send Bluesky a picture.";
  }

  if ( /could not process (this|the) video|video format|codec|aspect ratio/i.test( error ) ) {
    return "Export it again at 30 fps, then send it again.";
  }

  if ( /(fetch|download|retrieve|access).{0,40}(media|image|video|url)|media.{0,20}(not|un)reachable|invalid (image|media) url/i.test( error ) ) {
    return "Your Postiz’s uploads must be reachable from the internet. Send it again once they are.";
  }

  if ( /token|expired|re-?authori[sz]e|reconnect|session has been invalidated|permission/i.test( error ) ) {
    return "Reconnect the account in your Postiz, then send it again.";
  }

  if ( /too (long|many)|caption|hashtag/i.test( error ) ) {
    return "Shorten the caption or its hashtags, then send it again.";
  }

  return null;
}

/** The person's Postiz itself, for a link: its API's base without `/api/public/v1`. */
export function postizHome( apiBase: string ): string {
  return apiBase.replace(
    /\/(api\/)?public\/v1\/?$/,
    ""
  ) || apiBase;
}

/**
 * A post's tag names, whatever shape a version lists them in: `{ tag: { name } }`
 * (what his Postiz answers, though its docs list no tags), `{ name }`,
 * `{ label }` or a bare name.
 */
export function readTagNames( raw: unknown ): string[] {
  if ( !Array.isArray( raw ) ) {
    return [];
  }

  return raw.flatMap( ( t ) => {
    if ( typeof t === "string" ) {
      return t.trim() ? [
        t
      ] : [];
    }

    if ( !t || typeof t !== "object" ) {
      return [];
    }

    const r = t as Record<string, unknown>;
    const inner = r.tag && typeof r.tag === "object" ? r.tag as Record<string, unknown> : r;
    const name = str( inner.name ) ?? str( inner.label ) ?? str( inner.value );

    return name ? [
      name
    ] : [];
  } );
}

/** Whether a post carries Sketchbook's tag — case aside, a person may have typed it either way. */
export function hasSketchbookTag( post: Pick<PostizPost, "tags"> ): boolean {
  return post.tags.some( ( t ) => t.trim().toLowerCase() === SKETCHBOOK_TAG.toLowerCase() );
}

const STATES: Record<string, PostState> = {
  QUEUE: "queue",
  PUBLISHED: "published",
  ERROR: "error",
  DRAFT: "draft"
};

/** The posts `GET /posts` lists. */
export function readPosts( raw: unknown ): PostizPost[] {
  const list = raw && typeof raw === "object" && Array.isArray( ( raw as { posts?: unknown } ).posts )
    ? ( raw as { posts: unknown[] } ).posts
    : Array.isArray( raw ) ? raw : [];

  return list.flatMap( ( x ) => {
    if ( !x || typeof x !== "object" ) {
      return [];
    }

    const r = x as Record<string, unknown>;
    const id = str( r.id );
    const publishDate = str( r.publishDate );

    if ( !id || !publishDate ) {
      return [];
    }

    const ch = r.integration && typeof r.integration === "object" ? r.integration as Record<string, unknown> : null;
    const chId = ch ? str( ch.id ) : null;

    return [
      {
        id,
        group: str( r.group ),
        tags: readTagNames( r.tags ),
        content: typeof r.content === "string" ? postizText( r.content ) : "",
        publishDate,
        state: STATES[ String( r.state ?? "" ).toUpperCase() ] ?? "queue",
        releaseURL: str( r.releaseURL ),
        error: str( r.error ),
        channel: ch && chId
          ? {
            id: chId,
            name: str( ch.name ) ?? "",
            identifier: str( ch.providerIdentifier ) ?? str( ch.identifier ) ?? "",
            picture: str( ch.picture )
          }
          : null
      }
    ];
  } );
}

/** The ids of the posts `POST /posts` made: `[{ postId }]` in the versions seen, or `{ posts: [{ id }] }`. */
export function readCreated( raw: unknown ): string[] {
  const list = Array.isArray( raw )
    ? raw
    : raw && typeof raw === "object" && Array.isArray( ( raw as { posts?: unknown } ).posts )
      ? ( raw as { posts: unknown[] } ).posts
      : [];

  return list.flatMap( ( x ) => {
    if ( !x || typeof x !== "object" ) {
      return [];
    }

    const r = x as Record<string, unknown>;
    const id = str( r.postId ) ?? str( r.id );

    return id ? [
      id
    ] : [];
  } );
}

type FetchLike = ( input: string, init?: RequestInit ) => Promise<Response>;

export class PostizClient {
  private readonly fetchImpl: FetchLike;

  constructor(
    /** The public API's base: `https://postiz.example/api/public/v1`. */
    public readonly apiBase: string,
    private readonly apiKey: string,
    fetchImpl?: FetchLike
  ) {
    this.fetchImpl = fetchImpl ?? ( (
      input, init
    ) => fetch(
      input,
      init
    ) );
  }

  private async call(
    path: string, init: RequestInit = {}
  ): Promise<unknown> {
    let res: Response;

    try {
      res = await this.fetchImpl(
        `${ this.apiBase }${ path }`,
        {
          ...init,
          headers: {
            Authorization: this.apiKey,
            ...( init.body && !( init.body instanceof FormData ) ? {
              "Content-Type": "application/json"
            } : {} ),
            ...( init.headers as Record<string, string> | undefined ?? {} )
          }
        }
      );
    } catch( err ) {
      if ( err instanceof DOMException && err.name === "AbortError" ) {
        throw err;
      }

      throw new PostizError( "Your Postiz did not answer — is it up, and does it allow this site (CORS)?" );
    }

    const text = await res.text();
    let body: unknown = null;

    try {
      body = text ? JSON.parse( text ) : null;
    } catch {
      body = text;
    }

    if ( !res.ok ) {
      const said = body && typeof body === "object"
        ? str( ( body as { message?: unknown } ).message ) ?? str( ( body as { msg?: unknown } ).msg )
        : typeof body === "string" ? body.slice(
          0,
          200
        ) : null;

      if ( res.status === 401 || res.status === 403 ) {
        throw new PostizError(
          "Postiz refused the API key — paste it again from its Settings › Public API.",
          res.status
        );
      }

      if ( res.status === 413 ) {
        throw new PostizError(
          "The file is too large for your Postiz.",
          res.status
        );
      }

      if ( res.status === 429 ) {
        throw new PostizError(
          "Postiz says too many requests this hour — try again in a few minutes.",
          res.status
        );
      }

      throw new PostizError(
        said ? `Postiz: ${ said }` : `Postiz answered ${ res.status }.`,
        res.status
      );
    }

    return body;
  }

  /** True when the key opens this Postiz. */
  async isConnected(): Promise<boolean> {
    const body = await this.call( "/is-connected" );

    return Boolean( body && typeof body === "object" && ( body as { connected?: unknown } ).connected !== false );
  }

  async channels(): Promise<PostizChannel[]> {
    return readChannels( await this.call( "/integrations" ) );
  }

  async upload(
    file: File, signal?: AbortSignal
  ): Promise<PostizMedia> {
    const problem = uploadProblem( file );

    if ( problem ) {
      throw new PostizError( problem );
    }

    const form = new FormData();

    form.append(
      "file",
      file,
      file.name
    );

    const body = await this.call(
      "/upload",
      {
        method: "POST",
        body: form,
        signal
      }
    );
    const r = ( body ?? {} ) as Record<string, unknown>;
    const id = str( r.id );
    const path = str( r.path );

    if ( !id || !path ) {
      throw new PostizError( "Postiz took the file but did not say where it keeps it." );
    }

    return {
      id,
      path
    };
  }

  /** The posts made, their ids — one per account. */
  async createPost(
    req: PostRequest, signal?: AbortSignal
  ): Promise<string[]> {
    return readCreated( await this.call(
      "/posts",
      {
        method: "POST",
        body: JSON.stringify( postBody( req ) ),
        signal
      }
    ) );
  }

  async posts(
    from: Date, to: Date
  ): Promise<PostizPost[]> {
    const q = new URLSearchParams( {
      startDate: from.toISOString(),
      endDate: to.toISOString()
    } );

    return readPosts( await this.call( `/posts?${ q }` ) );
  }

  async deletePost( id: string ): Promise<void> {
    await this.call(
      `/posts/${ encodeURIComponent( id ) }`,
      {
        method: "DELETE"
      }
    );
  }
}

/** The first of `candidates` whose `/is-connected` answers with this key — the API's base, or the reason none did. */
export async function findApi(
  raw: string, apiKey: string, fetchImpl?: FetchLike
): Promise<PostizClient> {
  let last: unknown = null;

  for ( const base of apiCandidates( raw ) ) {
    const client = new PostizClient(
      base,
      apiKey,
      fetchImpl
    );

    try {
      if ( await client.isConnected() ) {
        return client;
      }
    } catch( err ) {
      last = err;

      // A refused key is the answer, not a wrong address.
      if ( err instanceof PostizError && ( err.status === 401 || err.status === 403 ) ) {
        throw err;
      }
    }
  }

  throw last instanceof Error ? last : new PostizError( "No Postiz public API answered at that address." );
}
