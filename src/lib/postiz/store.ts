/**
 * The Postiz this browser has connected — ONE, kept in `localStorage` like
 * Atelier's (`src/shared/sources/postiz/store.ts`): the API's address, the API
 * key the person pasted (a key to their own scheduler, revoked in Postiz,
 * dropped here by Forget), the accounts it listed, the ones Export ticks by
 * default, the collaborator it proposes, and the person's rhythm.
 *
 * Never sent to Sketchbook's server: this module makes no request, and the
 * client talks to the Postiz straight from the tab (`client.ts`).
 */

import {
  readChannels, type PostizChannel
} from "./client";
import {
  DEFAULT_RHYTHM, readRhythm, type Rhythm
} from "./rhythm";

export interface PostizConnection {
  /** The public API's base, as found on connect: `https://postiz.example/api/public/v1`. */
  apiBase: string;
  apiKey: string;
  channels: PostizChannel[];
  /** The accounts Export ticks for a new post. */
  defaultChannelIds: string[];
  /** An Instagram handle proposed as collaborator (without @), or ''. */
  collaborator: string;
  /**
   * The Instagram username of each of HIS accounts, by account id, as typed in
   * Publishing — Postiz lists an account by its display name and may not give
   * the username a collaborator invite needs. Wins over the channel's own.
   */
  handles: Record<string, string>;
  rhythm: Rhythm;
  connectedAt: number;
}

const KEY = "sketchbook.postiz.v1";
let cache: PostizConnection | null | undefined;
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function readConnection( raw: unknown ): PostizConnection | null {
  if ( !raw || typeof raw !== "object" ) {
    return null;
  }

  const r = raw as Record<string, unknown>;

  if ( typeof r.apiBase !== "string" || typeof r.apiKey !== "string" || !r.apiBase || !r.apiKey ) {
    return null;
  }

  const channels = readChannels( r.channels );
  const ids = Array.isArray( r.defaultChannelIds ) ? r.defaultChannelIds.filter( ( id ): id is string => typeof id === "string" && channels.some( ( c ) => c.id === id ) ) : [];

  return {
    apiBase: r.apiBase,
    apiKey: r.apiKey,
    channels,
    defaultChannelIds: [
      ...new Set( ids )
    ],
    collaborator: typeof r.collaborator === "string" ? r.collaborator.trim().replace(
      /^@/,
      ""
    )
      .slice(
        0,
        60
      ) : "",
    handles: readHandles(
      r.handles,
      channels
    ),
    rhythm: readRhythm( r.rhythm ),
    connectedAt: typeof r.connectedAt === "number" ? r.connectedAt : 0
  };
}

/** `@studio.loops ` → `studio.loops`; what Instagram's usernames allow, nothing else. Pure. */
export function cleanHandle( raw: string ): string {
  return raw.trim().replace(
    /^@/,
    ""
  )
    .replace(
      /[^A-Za-z0-9._]/g,
      ""
    )
    .slice(
      0,
      30
    );
}

function readHandles(
  raw: unknown, channels: readonly PostizChannel[]
): Record<string, string> {
  const out: Record<string, string> = {};

  if ( raw && typeof raw === "object" ) {
    for ( const [
      id,
      value
    ] of Object.entries( raw as Record<string, unknown> ) ) {
      const handle = typeof value === "string" ? cleanHandle( value ) : "";

      if ( handle && channels.some( ( c ) => c.id === id ) ) {
        out[ id ] = handle;
      }
    }
  }

  return out;
}

/** An account's Instagram username: the one he typed, else the one Postiz gave, else null. */
export function handleOf(
  conn: Pick<PostizConnection, "handles">, channel: PostizChannel
): string | null {
  return conn.handles[ channel.id ] || channel.handle || null;
}

export function getPostiz(): PostizConnection | null {
  if ( cache !== undefined ) {
    return cache;
  }

  try {
    cache = readConnection( JSON.parse( storage()?.getItem( KEY ) ?? "null" ) );
  } catch {
    cache = null;
  }

  return cache;
}

/** What the server renders: nothing is connected there. */
export function getServerPostiz(): PostizConnection | null {
  return null;
}

function write( next: PostizConnection | null ): void {
  cache = next;

  try {
    if ( next ) {
      storage()?.setItem(
        KEY,
        JSON.stringify( next )
      );
    } else {
      storage()?.removeItem( KEY );
    }
  } catch {
    // A private window keeps it for this visit only.
  }

  for ( const listener of listeners ) {
    listener();
  }
}

export function putPostiz( conn: PostizConnection ): void {
  write( readConnection( conn ) );
}

/** A change to the kept connection (accounts, rhythm, collaborator…); nothing when none is kept. */
export function updatePostiz( patch: Partial<Omit<PostizConnection, "apiBase" | "apiKey">> ): void {
  const current = getPostiz();

  if ( current ) {
    write( readConnection( {
      ...current,
      ...patch
    } ) );
  }
}

export function forgetPostiz(): void {
  write( null );
}

export function subscribePostiz( listener: () => void ): () => void {
  listeners.add( listener );

  return () => {
    listeners.delete( listener );
  };
}

/** Drop the cache — for specs, which swap `localStorage` underneath. */
export function resetPostizCache(): void {
  cache = undefined;
}

/** A first connection's defaults: every live Instagram account when there is one, else every live account. */
export function initialDefaults( channels: readonly PostizChannel[] ): string[] {
  const live = channels.filter( ( c ) => !c.disabled );
  const instagram = live.filter( ( c ) => /^instagram/.test( c.identifier ) );

  return ( instagram.length === 1 ? instagram : live.length === 1 ? live : [] ).map( ( c ) => c.id );
}

export {
  DEFAULT_RHYTHM
};
