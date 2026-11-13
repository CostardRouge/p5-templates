/**
 * *Send again* from the gallery (lab 3 Q4): the gallery keeps no video, so a
 * failed post is sent again by reopening its piece in the sketch, on Export ›
 * Publish, with only the accounts that failed ticked — Atelier's gesture
 * (`askSendAgain`, `publish-where.ts`). The ask crosses the navigation in
 * `sessionStorage`, beside the piece's own handoff (`pendingImportOptions`),
 * and is taken once by the sketch page it names.
 */

const KEY = "sketchbook.publish.sendAgain";
/** An ask older than this is a stale tab's, not the one just made. */
const FRESH_MS = 2 * 60 * 1000;

interface Ask {
  sketchKey: string;
  channelIds: string[];
  at: number;
}

function session(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** Ask the sketch `<engine>/<name>` to open Export › Publish with these accounts ticked. */
export function askSendAgain(
  sketchKey: string, channelIds: readonly string[]
): boolean {
  try {
    session()?.setItem(
      KEY,
      JSON.stringify( {
        sketchKey,
        channelIds: [
          ...new Set( channelIds )
        ],
        at: Date.now()
      } satisfies Ask )
    );

    return true;
  } catch {
    return false;
  }
}

/** A stored ask read back, whatever it holds. Pure. */
export function readAsk(
  raw: string | null, sketchKey: string, now: number
): string[] | null {
  try {
    const ask = JSON.parse( raw ?? "null" ) as Partial<Ask> | null;

    if ( !ask || ask.sketchKey !== sketchKey || typeof ask.at !== "number" || now - ask.at > FRESH_MS || !Array.isArray( ask.channelIds ) ) {
      return null;
    }

    const ids = ask.channelIds.filter( ( id ): id is string => typeof id === "string" );

    return ids.length ? ids : null;
  } catch {
    return null;
  }
}

/** The accounts to tick, when the gallery asked THIS sketch to send again — taken once. */
export function takeSendAgain( sketchKey: string ): string[] | null {
  const store = session();
  const ids = readAsk(
    store?.getItem( KEY ) ?? null,
    sketchKey,
    Date.now()
  );

  if ( ids ) {
    store?.removeItem( KEY );
  }

  return ids;
}
