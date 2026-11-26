import {
  SESAME_CLIENT_ID, STOCKAGE_URL
} from "./config";
import {
  accessToken
} from "./session";

/**
 * The store's two spaces, as Sketchbook calls them (CostardRouge/stockage,
 * Winnow's `apps/[app]/docs` and `apps/[app]/files` contracts): documents with
 * revisions, files by their SHA-256. Sketchbook's namespace is its Sésame app
 * id; the store checks it against the token.
 */

export class StockageError extends Error {
  constructor(
    readonly status: number, message: string, readonly etag: string | null = null
  ) {
    super( message );
  }
}

export interface RemoteDoc<T = unknown> {
  id: string;
  kind: string;
  version: number;
  etag: string;
  updated_at: string;
  doc?: T;
  summary?: Record<string, unknown>;
}

const base = () => `${ STOCKAGE_URL }/api/apps/${ SESAME_CLIENT_ID }`;

async function call(
  path: string, init: RequestInit = {}
): Promise<Response> {
  const token = await accessToken();

  if ( !token ) {
    throw new StockageError(
      401,
      "Signed out of Sésame"
    );
  }

  const headers = new Headers( init.headers );

  headers.set(
    "Authorization",
    `Bearer ${ token }`
  );

  const response = await fetch(
    `${ base() }${ path }`,
    {
      ...init,
      headers
    }
  );

  if ( !response.ok && response.status !== 304 ) {
    let message = `the store answered ${ response.status }`;
    let etag: string | null = null;

    try {
      const body = await response.json() as { error?: string;
        etag?: string };

      message = body.error ? `the store answered ${ response.status }: ${ body.error }` : message;
      etag = body.etag ?? null;
    } catch {
      // Not JSON: the status says enough.
    }
    throw new StockageError(
      response.status,
      message,
      etag
    );
  }

  return response;
}

export async function listDocs( kind: string ): Promise<RemoteDoc[]> {
  const response = await call( `/docs?kind=${ encodeURIComponent( kind ) }&fields=summary` );

  return ( await response.json() as { docs: RemoteDoc[] } ).docs;
}

/** One document, or null when it is not there. */
export async function getDoc<T>( id: string ): Promise<RemoteDoc<T> | null> {
  try {
    return await ( await call( `/docs/${ encodeURIComponent( id ) }` ) ).json() as RemoteDoc<T>;
  } catch( error ) {
    if ( error instanceof StockageError && error.status === 404 ) {
      return null;
    }
    throw error;
  }
}

/** Write a document; `etag` null creates it. Answers the new revision; a stale one throws a 412 carrying the current. */
export async function putDoc(
  id: string, body: { kind: string;
    version: number;
    doc: unknown;
    summary?: Record<string, unknown> }, etag: string | null
): Promise<string> {
  const response = await call(
    `/docs/${ encodeURIComponent( id ) }`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...( etag
          ? {
            "If-Match": `"${ etag }"`
          }
          : {} )
      },
      body: JSON.stringify( body )
    }
  );

  return ( await response.json() as { etag: string } ).etag;
}

export async function deleteDoc(
  id: string, etag: string
): Promise<void> {
  try {
    await call(
      `/docs/${ encodeURIComponent( id ) }`,
      {
        method: "DELETE",
        headers: {
          "If-Match": `"${ etag }"`
        }
      }
    );
  } catch( error ) {
    // Already gone is what was asked.
    if ( !( error instanceof StockageError && error.status === 404 ) ) {
      throw error;
    }
  }
}

export async function listFileIds(): Promise<Set<string>> {
  const response = await call( "/files" );

  return new Set( ( await response.json() as { files: { id: string }[] } ).files.map( ( f ) => f.id ) );
}

export async function sha256Hex( blob: Blob ): Promise<string> {
  const digest = new Uint8Array( await crypto.subtle.digest(
    "SHA-256",
    await blob.arrayBuffer()
  ) );

  return Array.from(
    digest,
    ( b ) => b.toString( 16 ).padStart(
      2,
      "0"
    )
  ).join( "" );
}

export async function putFile(
  id: string, blob: Blob
): Promise<void> {
  await call(
    `/files/${ id }`,
    {
      method: "PUT",
      headers: {
        "Content-Type": blob.type || "application/octet-stream"
      },
      body: blob
    }
  );
}

/** A file's bytes, or null when the store has none. */
export async function getFile( id: string ): Promise<Blob | null> {
  try {
    return await ( await call( `/files/${ id }` ) ).blob();
  } catch( error ) {
    if ( error instanceof StockageError && error.status === 404 ) {
      return null;
    }
    throw error;
  }
}
