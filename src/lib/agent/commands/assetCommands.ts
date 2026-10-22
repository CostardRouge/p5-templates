/**
 * Media: put a file the agent has (base64) or can point at (a URL the tab may
 * fetch) into the piece's assets, the way the asset picker does — registered
 * as a blob in this tab, its path added to the root's or a slide's `assets`
 * list — so an `image` / `images-stack` item can show it (`content.add` with
 * `source` / `sources`). Assets live in the tab, like a picked file: they are saved with the
 * piece, not uploaded anywhere by these commands.
 */
import {
  CommandError, isRecord, type CommandSpec
} from "../../../../scripts/mcp/registry.ts";
import type {
  StudioHandles
} from "../handles";
import {
  targetSlide
} from "./sketchCommands";

export const ASSET_TYPES = [
  "images",
  "videos",
  "audios",
  "json"
] as const;

export type AssetKind = typeof ASSET_TYPES[ number ];

/** Decoded size cap: a piece's media, not a library. */
export const MAX_ASSET_BYTES = 50 * 1024 * 1024;

const EXTENSIONS: Record<AssetKind, RegExp> = {
  images: /\.(png|jpe?g|gif|webp|avif|svg|bmp|heic|heif|tiff?)$/i,
  videos: /\.(mp4|webm|mov|m4v|ogv)$/i,
  audios: /\.(mp3|wav|ogg|m4a|aac|flac)$/i,
  json: /\.json$/i
};

/** Which asset list a file belongs to, from its MIME type or its name. */
export function assetKindOf(
  name: string, mimeType: string
): AssetKind | null {
  if ( mimeType.startsWith( "image/" ) ) {
    return "images";
  }
  if ( mimeType.startsWith( "video/" ) ) {
    return "videos";
  }
  if ( mimeType.startsWith( "audio/" ) ) {
    return "audios";
  }
  if ( mimeType === "application/json" ) {
    return "json";
  }

  return ( Object.keys( EXTENSIONS ) as AssetKind[] ).find( ( kind ) => EXTENSIONS[ kind ].test( name ) ) ?? null;
}

/** A file name the asset path can carry: no folders, no oddities. */
export function safeAssetName( name: string ): string {
  const base = name.split( /[\\/]/ ).pop() ?? "";
  const clean = base.replace(
    /[^\w.-]+/g,
    "-"
  ).replace(
    /^[-.]+/,
    ""
  );

  if ( !clean || !/\.[a-z0-9]+$/i.test( clean ) ) {
    throw new CommandError(
      "invalid",
      `"${ name }" needs a file name with an extension, e.g. "logo.png"`
    );
  }

  return clean.slice( -120 );
}

function decodeBase64( data: string ): Uint8Array<ArrayBuffer> {
  const clean = data.replace(
    /^data:[^,]*,/,
    ""
  ).replace(
    /\s+/g,
    ""
  );

  if ( !/^[A-Za-z0-9+/]*={0,2}$/.test( clean ) ) {
    throw new CommandError(
      "invalid",
      "data is not base64"
    );
  }
  if ( clean.length * 0.75 > MAX_ASSET_BYTES ) {
    throw new CommandError(
      "invalid",
      `a file is at most ${ MAX_ASSET_BYTES / 1024 / 1024 } MB`
    );
  }

  const binary = atob( clean );
  const bytes = new Uint8Array( binary.length );

  for ( let index = 0; index < binary.length; index++ ) {
    bytes[ index ] = binary.charCodeAt( index );
  }

  return bytes;
}

function assetsBase( slide: number | undefined ): string {
  return slide === undefined ? "assets" : `slides.${ slide }.assets`;
}

/** Every content item, anywhere, that shows `path`. */
function referencesTo(
  h: StudioHandles, path: string
): string[] {
  const found: string[] = [];
  const scan = (
    list: unknown, base: string
  ) => {
    if ( !Array.isArray( list ) ) {
      return;
    }
    list.forEach( (
      item, index
    ) => {
      if ( isRecord( item ) && ( item.source === path || ( Array.isArray( item.sources ) && item.sources.includes( path ) ) ) ) {
        found.push( `${ base }.${ index }` );
      }
    } );
  };
  const slides = h.getValues( "slides" );

  scan(
    h.getValues( "content" ),
    "content"
  );
  if ( Array.isArray( slides ) ) {
    slides.forEach( (
      slide, index
    ) => scan(
      isRecord( slide ) ? slide.content : null,
      `slides.${ index }.content`
    ) );
  }

  return found;
}

const SLIDE_OR_ROOT = {
  slide: {
    type: "number" as const,
    description: "Slide whose assets (default: the active slide, or the root)",
    min: 0,
    max: 999,
    integer: true,
    optional: true
  },
  root: {
    type: "boolean" as const,
    description: "true: the root's assets, shared by every slide",
    optional: true
  }
};

function scopeOf(
  h: StudioHandles, params: Record<string, unknown>
): number | undefined {
  if ( params.root ) {
    if ( params.slide !== undefined ) {
      throw new CommandError(
        "invalid",
        "give slide or root, not both"
      );
    }

    return undefined;
  }

  return targetSlide(
    h,
    params.slide
  );
}

export function assetCommands( h: StudioHandles ): CommandSpec[] {
  return [
    {
      id: "assets.list",
      title: "List media",
      description: "The media a slide (or the root) holds, by kind — the paths an image item's source (an images-stack's sources) takes.",
      params: SLIDE_OR_ROOT,
      run( params ) {
        const slide = scopeOf(
          h,
          params
        );
        const assets = h.getValues( assetsBase( slide ) );

        return {
          scope: slide === undefined ? "the root" : `slide ${ slide }`,
          ...Object.fromEntries( ASSET_TYPES.map( ( kind ) => [
            kind,
            isRecord( assets ) && Array.isArray( assets[ kind ] ) ? assets[ kind ] : []
          ] ) )
        };
      }
    },
    {
      id: "assets.add",
      title: "Add media",
      description: "Add an image, video, audio or JSON file to a slide's (or the root's) media, from base64 `data` or a `url` the tab fetches (the server must allow it: CORS). Answers its path — give it as `source` to content.add { kind: \"image\" }.",
      params: {
        name: {
          type: "string",
          description: "File name with its extension, e.g. \"logo.png\""
        },
        data: {
          type: "string",
          description: "The file, base64 (a data: URL works too)",
          optional: true
        },
        url: {
          type: "string",
          description: "An http(s) URL to fetch instead",
          optional: true
        },
        mimeType: {
          type: "string",
          description: "The file's type, when the name does not say it",
          optional: true
        },
        ...SLIDE_OR_ROOT
      },
      async run( params ) {
        const slide = scopeOf(
          h,
          params
        );
        const name = safeAssetName( String( params.name ) );

        if ( ( params.data === undefined ) === ( params.url === undefined ) ) {
          throw new CommandError(
            "invalid",
            "give one of data or url"
          );
        }

        let blob: Blob;

        if ( params.data !== undefined ) {
          blob = new Blob( [
            decodeBase64( String( params.data ) )
          ] );
        } else {
          const url = String( params.url );

          if ( !/^https?:\/\//i.test( url ) ) {
            throw new CommandError(
              "invalid",
              "url must be http(s)"
            );
          }

          let response: Response;

          try {
            response = await fetch(
              url,
              {
                credentials: "omit"
              }
            );
          } catch {
            throw new CommandError(
              "failed",
              `the tab could not fetch ${ url } — the server may not allow it (CORS); send the file as data instead`
            );
          }
          if ( !response.ok ) {
            throw new CommandError(
              "failed",
              `${ url } answered ${ response.status }`
            );
          }
          blob = await response.blob();
          if ( blob.size > MAX_ASSET_BYTES ) {
            throw new CommandError(
              "invalid",
              `a file is at most ${ MAX_ASSET_BYTES / 1024 / 1024 } MB`
            );
          }
        }

        const mimeType = String( params.mimeType ?? blob.type ?? "" );
        const kind = assetKindOf(
          name,
          mimeType
        );

        if ( !kind ) {
          throw new CommandError(
            "invalid",
            `cannot tell what "${ name }" is — use an image, video, audio or JSON extension, or give mimeType`
          );
        }

        const path = await h.addAsset(
          new File(
            [
              blob
            ],
            name,
            {
              type: mimeType || blob.type
            }
          ),
          kind,
          slide
        );

        return {
          path,
          kind,
          bytes: blob.size,
          scope: slide === undefined ? "the root" : `slide ${ slide }`,
          ...( kind === "images" ? {
            next: `content.add { kind: "image", fields: { source: "${ path }" } }`
          } : {} )
        };
      }
    },
    {
      id: "assets.remove",
      title: "Remove media",
      description: "Take a file out of a slide's (or the root's) media. Refused while a content item still shows it (remove or repoint that item first).",
      params: {
        path: {
          type: "string",
          description: "The asset's path (assets.list)"
        },
        ...SLIDE_OR_ROOT
      },
      run( params ) {
        const slide = scopeOf(
          h,
          params
        );
        const path = String( params.path );
        const base = assetsBase( slide );
        const assets = h.getValues( base );
        const kind = ASSET_TYPES.find( ( candidate ) => isRecord( assets ) && Array.isArray( assets[ candidate ] ) && ( assets[ candidate ] as string[] ).includes( path ) );

        if ( !kind || !isRecord( assets ) ) {
          throw new CommandError(
            "invalid",
            `${ path } is not in ${ slide === undefined ? "the root's" : `slide ${ slide }'s` } media (assets.list)`
          );
        }

        const users = referencesTo(
          h,
          path
        );

        if ( users.length ) {
          throw new CommandError(
            "invalid",
            `${ path } is still shown by ${ users.join( ", " ) }`
          );
        }
        h.setValue(
          `${ base }.${ kind }`,
          ( assets[ kind ] as string[] ).filter( ( candidate ) => candidate !== path )
        );

        return {
          removed: path
        };
      }
    }
  ];
}
