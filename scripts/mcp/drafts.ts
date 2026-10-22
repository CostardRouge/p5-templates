/**
 * A DRAFT is how an agent makes a whole piece rather than a sketch with a few
 * parameters: an options document (size, clock, content items — text, images,
 * HUD, sketch layers —, slides, the sketch's parameters) plus the media files
 * it uses, stored on the server as a recording job in status `draft`.
 *
 * It is the studio's own "Save draft": `POST /api/recordings/enqueue` with
 * `status=draft` and the files as `file[global][<kind>]`, and its page is the
 * studio page with `?id=<draft>` — the very page the recorder loads, which is
 * what lets a draft be looked at frame by frame and recorded unchanged.
 *
 * Pure helpers here; the commands are `draftCommands.ts`.
 */
import {
  CommandError, isRecord
} from "./registry.ts";
import {
  mergeOptions
} from "./sketchForm.ts";

export type MediaKind = "images" | "videos" | "audios";

/** By extension: the kinds the studio's asset pools hold (`Assets` in `sketch.types.ts`). */
const EXTENSIONS: Record<MediaKind, string[]> = {
  images: [
    "png",
    "jpg",
    "jpeg",
    "webp",
    "gif",
    "avif",
    "svg"
  ],
  videos: [
    "mp4",
    "webm",
    "mov",
    "m4v"
  ],
  audios: [
    "mp3",
    "wav",
    "ogg",
    "m4a",
    "aac",
    "flac"
  ]
};

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  m4v: "video/mp4",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac"
};

function extensionOf( name: string ): string {
  return ( name.split( "." ).pop() ?? "" ).toLowerCase();
}

export function mediaKind( name: string ): MediaKind | null {
  const extension = extensionOf( name );

  for ( const [
    kind,
    extensions
  ] of Object.entries( EXTENSIONS ) ) {
    if ( extensions.includes( extension ) ) {
      return kind as MediaKind;
    }
  }

  return null;
}

export function mimeType( name: string ): string {
  return MIME[ extensionOf( name ) ] ?? "application/octet-stream";
}

export const MEDIA_EXTENSIONS = Object.values( EXTENSIONS ).flat();

/**
 * The name a file is stored under: the base name, reduced to what an asset
 * path admits (`isSafeObjectPath`) — letters, digits, `.`, `-`, `_`.
 */
export function storedName( fileName: string ): string {
  const base = fileName.split( /[\\/]/ ).pop() ?? fileName;
  const cleaned = base.replace(
    /[^A-Za-z0-9._-]+/g,
    "-"
  ).replace(
    /^[.-]+/,
    ""
  );

  if ( !cleaned || !mediaKind( cleaned ) ) {
    throw new CommandError(
      "invalid",
      `"${ fileName }" is not a media file — ${ MEDIA_EXTENSIONS.join( ", " ) }`
    );
  }

  return cleaned;
}

/** What a document references the file by (`getScopeAssetPath`, global scope). */
export function assetPath(
  kind: MediaKind, name: string
): string {
  return `global/${ kind }/${ name }`;
}

export interface ListedAsset {
  /** `global`, or the slide index. */
  scope: "global" | number;
  kind: MediaKind;
  /** As stored and referenced: `global/images/a.jpg`. */
  path: string;
}

function listed(
  assets: unknown, scope: ListedAsset[ "scope" ]
): ListedAsset[] {
  if ( !isRecord( assets ) ) {
    return [];
  }

  return ( [
    "images",
    "videos",
    "audios"
  ] as MediaKind[] ).flatMap( ( kind ) => ( Array.isArray( assets[ kind ] ) ? assets[ kind ] as unknown[] : [] )
    .filter( ( path ): path is string => typeof path === "string" && path !== "" )
    .map( ( path ) => ( {
      scope,
      kind,
      path
    } ) ) );
}

/** Every asset a stored document lists, global pool and per slide. */
export function listedAssets( options: Record<string, unknown> ): ListedAsset[] {
  const slides = Array.isArray( options.slides ) ? options.slides : [];

  return [
    ...listed(
      options.assets,
      "global"
    ),
    ...slides.flatMap( (
      slide, i
    ) => isRecord( slide ) ? listed(
      slide.assets,
      i
    ) : [] )
  ];
}

/** The form key a stored asset is re-posted under (`enqueue/route.ts`). */
export function uploadKey( asset: Pick<ListedAsset, "scope" | "kind"> ): string {
  return `file[${ asset.scope === "global" ? "global" : `slide-${ asset.scope }` }][${ asset.kind }]`;
}

/** Keys an agent may not set in `document`, and where they go instead. */
const RESERVED: Record<string, string> = {
  sketch: "pass the sketch's parameters as `options`",
  assets: "add media with `files`, remove with `removeFiles`",
  id: "the draft id is the server's"
};

export function checkDocumentKeys( document: Record<string, unknown> ): void {
  for ( const key of Object.keys( document ) ) {
    if ( key in RESERVED ) {
      throw new CommandError(
        "invalid",
        `document.${ key } is not set here — ${ RESERVED[ key ] }`
      );
    }
  }
}

/**
 * The document to store: `base` (the stored draft, or the sketch's own
 * `options.json` for a new one) with the agent's `document` merged over it
 * (objects key by key, arrays whole — a `content` or `slides` list given is
 * the list), and the sketch's parameters as a WHOLE object, because the
 * capture page assigns `sketch` over its defaults rather than merging it.
 */
export function composeDocument(
  base: Record<string, unknown>, document: Record<string, unknown>, sketchValues: Record<string, unknown>
): Record<string, unknown> {
  const merged = mergeOptions(
    base,
    document
  );

  merged.sketch = sketchValues;
  delete merged.id;

  return merged;
}
